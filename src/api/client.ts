import { cacheExchange, Client, fetchExchange, mapExchange } from '@urql/core'
import { authExchange } from '@urql/exchange-auth'

import { CTX_SHOP_OWNER_AUTHORIZATION, ENDPOINT, requiresAuth } from '@/api/endpoints'
import { isAuthExpired, isRefreshRaceRetry, isSessionGone, statusOf } from '@/api/errors'
import { RefreshDocument } from '@/api/operations/shopOwnerAuthorization/refresh'
import { clearAccessToken, getAccessToken, setAccessToken } from '@/api/tokenStore'

/**
 * How many times a `refresh` refused with `REFRESH_RACE_RETRY` is sent again before the session is treated
 * as lost. Retries, not attempts: the first send is not one, so this is three calls at worst.
 */
const REFRESH_RACE_RETRIES = 2

/**
 * The refresh circuit breaker's cooldown after the n-th consecutive *transport* failure — no HTTP or
 * GraphQL response at all, not a request the server answered and refused.
 *
 * `min(30_000, 1_000 * 2 ** (n - 1))`: 1s, 2s, 4s, … doubling, capped at 30s. During a sustained outage
 * this is what stops every single operation from firing its own refresh attempt back-to-back — without
 * it, a dead network turns into a tight loop of doomed requests instead of a session that quietly waits.
 */
const breakerCooldownMs = (consecutiveTransportFailures: number): number =>
	Math.min(30_000, 1_000 * 2 ** (consecutiveTransportFailures - 1))

export interface CreateGraphQLClientOptions {
	/**
	 * Called when the refresh mutation cannot mint a new access token. The session is over: the caller
	 * drops the shop owner back to the login page. Kept as a callback rather than a router import so the
	 * API layer stays independent of TanStack Router, and so a test can observe it directly.
	 */
	onSessionLost: () => void
	/**
	 * The clock the refresh circuit breaker reads its cooldown window against. Defaults to `Date.now`;
	 * a test injects its own so the window is deterministic instead of racing the real clock.
	 */
	now?: () => number
}

/**
 * The single urql client.
 *
 * `cacheExchange` is the document cache, not Graphcache: results are keyed by query + variables, and
 * a mutation invalidates every cached query that returned one of the `__typename`s the mutation
 * touched. That falls down in exactly one case — a mutation that creates or deletes, where the
 * response mentions no typename of the list it changed — and this app's create/delete mutations
 * return a bare `Boolean`, so every one of them has to name the affected types explicitly through
 * `additionalTypenames` at the call site. See src/features/companies.
 *
 * `fetchOptions.credentials: 'include'` is what carries the refresh cookie. It works because the app
 * and the services share one origin; see the comment in vite.config.ts.
 */
export const createGraphQLClient = ({ onSessionLost, now = Date.now }: CreateGraphQLClientOptions): Client => {
	/**
	 * The refresh circuit breaker's state.
	 *
	 * Scoped to this client's closure rather than module scope. This app builds exactly one client for
	 * its whole lifetime, but marketplace-user builds a fresh urql client per SSR request (ADR-019) —
	 * a module-global counter there would let one visitor's outage silence refreshes for every other
	 * request the server handles. Keeping the state here means the same shape is safe in both apps.
	 */
	let consecutiveTransportFailures = 0
	let cooldownUntil = 0

	const resetBreaker = (): void => {
		consecutiveTransportFailures = 0
		cooldownUntil = 0
	}

	// The network coming back is the clearest signal there is, and it can arrive well before the
	// current cooldown window would have elapsed on its own. No `window` outside a browser (SSR, a
	// non-browser build) — the breaker still works there, it just waits out its window instead of
	// hearing about a reconnect early.
	if (typeof window !== 'undefined') window.addEventListener('online', resetBreaker)

	return new Client({
		url: ENDPOINT.shopOwnerResource,
		fetchOptions: { credentials: 'include' },
		/**
		 * POST for queries too, against urql's default of `'within-url-limit'`.
		 *
		 * Every service constructs its `ApolloServer` with `csrfPrevention: true`, which rejects a GET
		 * that carries none of the preflight-forcing headers (`apollo-require-preflight`,
		 * `x-apollo-operation-name`) — and urql sends none of them. Left at the default, every query
		 * short enough to fit in a URL comes back as "This operation has been blocked as a potential
		 * Cross-Site Request Forgery" while mutations work, which reads as a schema problem.
		 *
		 * It is also the right call independently of Apollo: `credentials: 'include'` plus a GET is the
		 * exact shape CSRF prevention exists to stop, and a query string ends up in nginx access logs
		 * and browser history — an owner searching for a person would log that person's name.
		 */
		preferGetMethod: false,
		exchanges: [
			cacheExchange,
			authExchange(async (utils) => ({
				addAuthToOperation(operation) {
					const token = getAccessToken()
					if (token === null) return operation

					// `Bearer access:<token>` — the `access:` prefix is part of the Redis key the backend
					// looks the token up under, not decoration. Without it the lookup misses and the
					// service answers 498.
					return utils.appendHeaders(operation, { Authorization: `Bearer access:${token}` })
				},

				/**
				 * Refresh *before* sending, when there is no token to send and the endpoint needs one.
				 * This is the whole page-reload story: the access token lives in memory, a reload wipes
				 * it, and the first authenticated operation after the reload silently re-mints it from
				 * the httpOnly cookie instead of bouncing the owner to the login page.
				 */
				willAuthError(operation) {
					return getAccessToken() === null && requiresAuth(operation.context.url)
				},

				/** 498 is the platform's "access token expired or deleted". Nothing else is retryable. */
				didAuthError(error) {
					return isAuthExpired(error)
				},

				/**
				 * Mint a new access token from the refresh cookie, retrying the one failure that is not a
				 * failure.
				 *
				 * Two tabs reloading at the same moment both send the same refresh cookie. One wins and
				 * rotates it; the other presents a token the backend consumed milliseconds ago, and inside
				 * the grace window it answers `REFRESH_RACE_RETRY` instead of revoking the family. By then
				 * the winner's `Set-Cookie` is in the jar both tabs share, so the retry sends the current
				 * token and succeeds — which is why the race-retry loop below has no backoff of its own: the
				 * thing being waited for has already happened, and a timer would only delay the owner's first
				 * screen. The breaker below is a different failure entirely — no response at all, not a
				 * losing race — and that one does get a backoff, because the thing it is waiting for has not
				 * happened yet and asking again immediately cannot make it happen sooner.
				 *
				 * Bounded at `REFRESH_RACE_RETRIES` because the loop is otherwise unbounded on a backend
				 * that keeps answering the same code. Two is a race lost twice in a row; a third is not a
				 * race any more, and a logout is the honest answer.
				 */
				async refreshAuth() {
					// The circuit breaker. A sustained outage means every operation hitting a stale token
					// fires its own refresh attempt, one after another with nothing between them; this skips
					// the network entirely until the cooldown a previous transport failure opened has
					// elapsed. The session is kept exactly as a transport failure below keeps it — this just
					// avoids spending a round trip to find out again what the last one already answered.
					if (now() < cooldownUntil) return

					for (let attempt = 0; attempt <= REFRESH_RACE_RETRIES; attempt++) {
						const result = await utils.mutate(RefreshDocument, {}, CTX_SHOP_OWNER_AUTHORIZATION)
						const refresh = result.data?.refresh

						if (refresh !== undefined && refresh.status && refresh.accessToken !== '') {
							setAccessToken(refresh.accessToken)
							resetBreaker()
							return
						}

						// A transport failure never reached the server at all — offline, DNS, a connection dropped
						// mid-reload — so the refresh cookie was never spent and the owner is almost certainly
						// still signed in. The same policy `mapExchange` applies to ordinary queries below: a
						// dropped connection is not a dead session, and ending it here would be a logout over a
						// wifi blip. Leave the session alone rather than falling through to the terminal path.
						//
						// `result.error !== undefined` first: a *clean* response that simply reports failure
						// (`status: false`, no data, an empty token) has no error at all, and `statusOf(undefined)`
						// is `undefined` too — that case is not a transport failure and must keep falling through.
						//
						// Trips the breaker rather than returning bare: on its own this branch already keeps
						// the session, but with nothing to slow the *next* operation down it would fire another
						// refresh attempt straight away, and the one after that — every operation touching the
						// network during the outage, back to back.
						if (result.error !== undefined && statusOf(result.error) === undefined) {
							consecutiveTransportFailures += 1
							cooldownUntil = now() + breakerCooldownMs(consecutiveTransportFailures)
							return
						}

						// Every other failure is terminal: a second attempt would present the same cookie to a
						// backend that has already refused it.
						if (!isRefreshRaceRetry(result.error)) break
					}

					clearAccessToken()
					onSessionLost()
				}
			})),

			/**
			 * The other way a session ends.
			 *
			 * `authExchange` only knows about 498, because 498 is the only status a refresh can fix. The
			 * three in `isSessionGone` — 401 no session, 412 account disabled/deleted/awaiting approval,
			 * 499 token required — are terminal, and they arrive on ordinary domain operations rather
			 * than on the refresh. Without this the owner would sit on a screen showing a red Alert,
			 * still nominally "logged in", with every subsequent action failing the same way.
			 *
			 * Placed below `authExchange` in the chain, so results reach it on the way back up before the
			 * retry logic sees them. A 498 passes straight through — it is not in `SESSION_GONE`, and
			 * whether to retry it is `authExchange`'s decision, not this one's.
			 */
			mapExchange({
				onError(error) {
					if (!isSessionGone(error)) return

					clearAccessToken()
					onSessionLost()
				}
			}),
			fetchExchange
		]
	})
}
