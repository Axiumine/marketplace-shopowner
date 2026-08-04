import { cacheExchange, Client, fetchExchange, mapExchange } from '@urql/core'
import { authExchange } from '@urql/exchange-auth'

import { CTX_SHOP_OWNER_AUTHORIZATION, ENDPOINT, requiresAuth } from '@/api/endpoints'
import { isAuthExpired, isSessionGone } from '@/api/errors'
import { RefreshDocument } from '@/api/operations/shopOwnerAuthorization/refresh'
import { clearAccessToken, getAccessToken, setAccessToken } from '@/api/tokenStore'

export interface CreateGraphQLClientOptions {
	/**
	 * Called when the refresh mutation cannot mint a new access token. The session is over: the caller
	 * drops the shop owner back to the login page. Kept as a callback rather than a router import so the
	 * API layer stays independent of TanStack Router, and so a test can observe it directly.
	 */
	onSessionLost: () => void
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
export const createGraphQLClient = ({ onSessionLost }: CreateGraphQLClientOptions): Client =>
	new Client({
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

				async refreshAuth() {
					const result = await utils.mutate(RefreshDocument, {}, CTX_SHOP_OWNER_AUTHORIZATION)
					const refresh = result.data?.refresh

					if (refresh !== undefined && refresh.status && refresh.accessToken !== '') {
						setAccessToken(refresh.accessToken)
						return
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
