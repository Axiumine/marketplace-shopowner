import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { createGraphQLClient, type CreateGraphQLClientOptions } from '@/api/client'
import { CTX_PUBLIC_AUTHORIZATION, CTX_SHOP_OWNER_RESOURCE, ENDPOINT } from '@/api/endpoints'
import { LoginDocument } from '@/api/operations/publicAuthorization/login'
import { ShopOwnerCompaniesDocument } from '@/api/operations/shopOwnerResource/queries'
import { clearAccessToken, getAccessToken, setAccessToken } from '@/api/tokenStore'

import { graphQLError, stubGraphQL } from '../helpers/graphql'

/**
 * The one query this tier exposes, as the wire answers it — the app's session probe as well as its
 * companies list, which is why every test below drives the client with it.
 *
 * ⚠️ `__typename` is not decoration here: urql's document cache keys a response by the typenames it
 * mentions, and a fixture without one is cached under nothing at all — the second execution of the
 * same document would then hit the network again and every call-count assertion in this file would be
 * off by one for a reason that has nothing to do with the exchange being tested.
 */
const COMPANIES = {
	shopOwnerCompanies: [
		{
			__typename: 'GraphQLCompany',
			_id: '65f0000000000000000000a1',
			legalName: 'Rivers Trading Ltd',
			vatNumber: '12345678901',
			taxCode: null,
			contactPerson: 'Mark Rivers',
			administrator: 'Mark Rivers',
			uniqueCode: null,
			certifiedEmail: 'certified@rivers.test',
			registryExtract: 'MA-123456',
			address: {
				street: '3 Oak Street',
				postalCode: '02108',
				city: 'Boston',
				province: 'MA',
				position: { type: 'Point', coordinates: [-71.0636, 42.3626] }
			}
		}
	]
}

const refreshed = (accessToken: string) => ({ data: { refresh: { status: true, accessToken } } })

/**
 * What the backend answers the loser of a multi-tab refresh race: a 409 carrying the one
 * `extensions.code` on the platform, and no token of any kind — the grace branch mints nothing.
 */
const raceLost = {
	errors: [graphQLError('Refresh In Progress', 'Retry with the current cookie.', 409, 'REFRESH_RACE_RETRY')],
	status: 409
}

// A fresh `AbortController` per client, aborted once the test finishes — otherwise every test in this
// file leaves its own `online` listener behind on the shared jsdom `window`, and they pile up across
// the whole suite. A test exercising the `signal` option itself passes its own through `overrides`.
const setup = (overrides: Partial<CreateGraphQLClientOptions> = {}) => {
	const onSessionLost = vi.fn()
	const controller = new AbortController()
	onTestFinished(() => controller.abort())

	return { client: createGraphQLClient({ onSessionLost, signal: controller.signal, ...overrides }), onSessionLost }
}

const info = (client: ReturnType<typeof setup>['client']) =>
	client.query(ShopOwnerCompaniesDocument, {}, CTX_SHOP_OWNER_RESOURCE).toPromise()

describe('createGraphQLClient', () => {
	it('defaults to the shopOwner-resource endpoint and sends the refresh cookie', async () => {
		const stub = stubGraphQL({ ShopOwnerCompanies: { data: COMPANIES } })
		setAccessToken('tok-1')

		const { client } = setup()
		await client.query(ShopOwnerCompaniesDocument, {}).toPromise()

		expect(stub.calls[0]?.url).toBe(ENDPOINT.shopOwnerResource)
		// Without `credentials: 'include'` the httpOnly refresh cookie never leaves the browser and every
		// reload ends at the login page.
		expect(stub.calls[0]?.credentials).toBe('include')
	})

	// urql defaults queries to GET (`preferGetMethod: 'within-url-limit'`), and every service builds its
	// ApolloServer with `csrfPrevention: true` — which rejects a GET carrying none of the preflight
	// headers urql omits. Left at the default, every query short enough to fit in a URL fails while
	// mutations succeed.
	it('sends queries as POST, not GET', async () => {
		const stub = stubGraphQL({ ShopOwnerCompanies: { data: COMPANIES } })
		setAccessToken('tok-1')

		const { client } = setup()
		await info(client)

		expect(stub.calls[0]?.method).toBe('POST')
		expect(stub.calls[0]?.url).toBe(ENDPOINT.shopOwnerResource)
	})

	it('sends the access token as `Bearer access:<token>`', async () => {
		const stub = stubGraphQL({ ShopOwnerCompanies: { data: COMPANIES } })
		setAccessToken('tok-1')

		const { client } = setup()
		await info(client)

		// The `access:` prefix is part of the Redis key the backend looks the token up under, not
		// decoration: without it the lookup misses and the service answers 498.
		expect(stub.calls[0]?.authorization).toBe('Bearer access:tok-1')
	})

	it('sends no Authorization header to the public endpoint', async () => {
		const stub = stubGraphQL({ Login: { data: { login: { accessToken: 'tok-1' } } } })
		clearAccessToken()

		const { client } = setup()
		await client
			.mutation(
				LoginDocument,
				{ email: 'owner@marketplace.test', password: 'password123', rememberMe: false },
				CTX_PUBLIC_AUTHORIZATION
			)
			.toPromise()

		expect(stub.calls).toHaveLength(1)
		expect(stub.calls[0]?.url).toBe(ENDPOINT.publicAuthorization)
		expect(stub.calls[0]?.authorization).toBeNull()
	})

	// The page-reload story: the access token lives in memory, a reload wipes it, and the first
	// authenticated operation after the reload re-mints it from the cookie instead of bouncing the
	// admin to the login page.
	it('refreshes before sending when there is no token yet', async () => {
		const stub = stubGraphQL({ Refresh: refreshed('tok-2'), ShopOwnerCompanies: { data: COMPANIES } })
		clearAccessToken()

		const { client, onSessionLost } = setup()
		const result = await info(client)

		expect(stub.calls.map((call) => call.operationName)).toEqual(['Refresh', 'ShopOwnerCompanies'])
		expect(stub.calls[0]?.url).toBe(ENDPOINT.shopOwnerAuthorization)
		expect(stub.calls[1]?.authorization).toBe('Bearer access:tok-2')
		expect(result.data).toEqual(COMPANIES)
		expect(getAccessToken()).toBe('tok-2')
		expect(onSessionLost).not.toHaveBeenCalled()
	})

	it('refreshes and retries when the token has expired', async () => {
		const stub = stubGraphQL({
			ShopOwnerCompanies: [{ errors: [graphQLError('Invalid token', undefined, 498)], status: 498 }, { data: COMPANIES }],
			Refresh: refreshed('tok-2')
		})
		setAccessToken('tok-1')

		const { client, onSessionLost } = setup()
		const result = await info(client)

		expect(stub.calls.map((call) => call.operationName)).toEqual(['ShopOwnerCompanies', 'Refresh', 'ShopOwnerCompanies'])
		expect(stub.calls[0]?.authorization).toBe('Bearer access:tok-1')
		expect(stub.calls[2]?.authorization).toBe('Bearer access:tok-2')
		expect(result.error).toBeUndefined()
		expect(result.data).toEqual(COMPANIES)
		expect(onSessionLost).not.toHaveBeenCalled()
	})

	it('does not retry a failure that is not 498', async () => {
		const stub = stubGraphQL({
			ShopOwnerCompanies: { errors: [graphQLError('Invalid data', undefined, 400)], status: 400 },
			Refresh: refreshed('tok-2')
		})
		setAccessToken('tok-1')

		const { client, onSessionLost } = setup()
		const result = await info(client)

		expect(stub.calls.map((call) => call.operationName)).toEqual(['ShopOwnerCompanies'])
		expect(result.error?.message).toContain('Invalid data')
		expect(getAccessToken()).toBe('tok-1')
		expect(onSessionLost).not.toHaveBeenCalled()
	})

	it('ends the session when the refresh mutation reports failure', async () => {
		const stub = stubGraphQL({
			ShopOwnerCompanies: { errors: [graphQLError('Invalid token', undefined, 498)], status: 498 },
			Refresh: { data: { refresh: { status: false, accessToken: '' } } }
		})
		setAccessToken('tok-1')

		const { client, onSessionLost } = setup()
		await info(client)

		expect(onSessionLost).toHaveBeenCalled()
		expect(getAccessToken()).toBeNull()
		// Sent once. The retry loop is for the lost race and nothing else: re-sending a cookie
		// the backend has already refused would triple the cost of every genuine expiry.
		expect(stub.calls.filter((call) => call.operationName === 'Refresh')).toHaveLength(1)
	})

	// `status: false` with a token in the same payload is a contradiction, and the reason the check is
	// an `&&` chain rather than a token test alone: the flag is the service's answer, the token is only
	// what it hands over when the answer was yes. Taking the token here would revive a session the
	// backend has just said is over.
	it('ends the session when the refresh reports failure but still returns a token', async () => {
		stubGraphQL({
			ShopOwnerCompanies: { errors: [graphQLError('Invalid token', undefined, 498)], status: 498 },
			Refresh: { data: { refresh: { status: false, accessToken: 'tok-2' } } }
		})
		setAccessToken('tok-1')

		const { client, onSessionLost } = setup()
		await info(client)

		expect(onSessionLost).toHaveBeenCalled()
		expect(getAccessToken()).toBeNull()
	})

	// A body with no `data` at all: the field is non-null in the schema, so Apollo nulls the whole
	// response rather than the one field. Nothing is left to read the status off.
	it('ends the session when the refresh answers without data', async () => {
		stubGraphQL({
			ShopOwnerCompanies: { errors: [graphQLError('Invalid token', undefined, 498)], status: 498 },
			Refresh: {}
		})
		setAccessToken('tok-1')

		const { client, onSessionLost } = setup()
		await info(client)

		expect(onSessionLost).toHaveBeenCalled()
		expect(getAccessToken()).toBeNull()
	})

	// `status: true` with an empty token is the one case the schema cannot express — the field is
	// non-null, so a blank string is the service saying it minted nothing.
	it('ends the session when the refresh returns an empty token', async () => {
		stubGraphQL({
			ShopOwnerCompanies: { errors: [graphQLError('Invalid token', undefined, 498)], status: 498 },
			Refresh: { data: { refresh: { status: true, accessToken: '' } } }
		})
		setAccessToken('tok-1')

		const { client, onSessionLost } = setup()
		await info(client)

		expect(onSessionLost).toHaveBeenCalled()
		expect(getAccessToken()).toBeNull()
	})

	/*
	 * ⚠️ The refresh mutation's own transport failure, not the domain query's. `mapExchange` already keeps
	 * the session on a dropped connection for an ordinary query (see "keeps the session on a transport
	 * failure" below) — this is the same policy applied to the one path that used to skip it: the refresh
	 * cookie was never spent, since the request never reached the server, and logging the owner out over a
	 * wifi blip would lose whatever they were doing.
	 */
	it('keeps the session when the refresh mutation itself is a transport failure', async () => {
		const stub = stubGraphQL({
			// Repeats: the query the network error hands back to is retried once the loop gives up on the
			// refresh, and the fixture answers 498 again both times — nothing about that retry is this
			// test's concern, only that the *session* survives it.
			ShopOwnerCompanies: { errors: [graphQLError('Invalid token', undefined, 498)], status: 498 },
			Refresh: { networkError: 'offline' }
		})
		setAccessToken('tok-1')

		const { client, onSessionLost } = setup()
		await info(client)

		// Once, not the three attempts a lost race gets: a bare network error is not `REFRESH_RACE_RETRY`,
		// and the whole point of the fix is leaving the session alone rather than hammering an endpoint
		// that is not answering anyone.
		expect(stub.calls.filter((call) => call.operationName === 'Refresh')).toHaveLength(1)
		expect(onSessionLost).not.toHaveBeenCalled()
		// Not cleared either: nothing came back to say the token itself is bad, only that the attempt to
		// refresh it never reached anywhere.
		expect(getAccessToken()).toBe('tok-1')
	})

	it('ends the session when the refresh itself errors', async () => {
		stubGraphQL({
			ShopOwnerCompanies: { errors: [graphQLError('Invalid token', undefined, 498)], status: 498 },
			Refresh: { errors: [graphQLError('Session not found', undefined, 401)], status: 401 }
		})
		setAccessToken('tok-1')

		const { client, onSessionLost } = setup()
		await info(client)

		expect(onSessionLost).toHaveBeenCalled()
		expect(getAccessToken()).toBeNull()
	})

	/*
	 * The lost refresh race, the whole point of the grace window. Two tabs reload together, both send the
	 * same refresh cookie, one loses — and the loser must not be logged out of every session it has. The
	 * backend answers a code rather than a 498, and the client sends the refresh again with the cookie the
	 * winner has by then written into the shared jar.
	 */
	it('retries a refresh that lost a multi-tab race and keeps the session', async () => {
		const stub = stubGraphQL({
			ShopOwnerCompanies: [{ errors: [graphQLError('Invalid token', undefined, 498)], status: 498 }, { data: COMPANIES }],
			Refresh: [raceLost, refreshed('tok-2')]
		})
		setAccessToken('tok-1')

		const { client, onSessionLost } = setup()
		const result = await info(client)

		expect(stub.calls.map((call) => call.operationName)).toEqual([
			'ShopOwnerCompanies',
			'Refresh',
			'Refresh',
			'ShopOwnerCompanies'
		])
		expect(result.error).toBeUndefined()
		expect(result.data).toEqual(COMPANIES)
		expect(getAccessToken()).toBe('tok-2')
		expect(onSessionLost).not.toHaveBeenCalled()
	})

	// Two retries, not one: a tab can lose twice in a row when three are open, and the second retry is the
	// difference between an unlucky owner staying signed in and being sent back to the login page.
	it('retries a second time and still keeps the session', async () => {
		const stub = stubGraphQL({
			ShopOwnerCompanies: [{ errors: [graphQLError('Invalid token', undefined, 498)], status: 498 }, { data: COMPANIES }],
			Refresh: [raceLost, raceLost, refreshed('tok-2')]
		})
		setAccessToken('tok-1')

		const { client, onSessionLost } = setup()
		const result = await info(client)

		expect(stub.calls.filter((call) => call.operationName === 'Refresh')).toHaveLength(3)
		expect(result.data).toEqual(COMPANIES)
		expect(getAccessToken()).toBe('tok-2')
		expect(onSessionLost).not.toHaveBeenCalled()
	})

	// And it stops. A backend answering the same code forever is not a race any more, and a client that
	// keeps asking would hammer the refresh endpoint into its own rate limiter on every operation.
	it('gives up after two retries and ends the session', async () => {
		const stub = stubGraphQL({
			ShopOwnerCompanies: { errors: [graphQLError('Invalid token', undefined, 498)], status: 498 },
			Refresh: raceLost
		})
		setAccessToken('tok-1')

		const { client, onSessionLost } = setup()
		await info(client)

		expect(stub.calls.filter((call) => call.operationName === 'Refresh')).toHaveLength(3)
		expect(onSessionLost).toHaveBeenCalled()
		expect(getAccessToken()).toBeNull()
	})

	it.each([
		['401 no session', 401],
		['412 account disabled', 412],
		['499 missing token', 499]
	])('ends the session on %s', async (_label, status) => {
		stubGraphQL({ ShopOwnerCompanies: { errors: [graphQLError('Session over', undefined, status)], status } })
		setAccessToken('tok-1')

		const { client, onSessionLost } = setup()
		await info(client)

		expect(onSessionLost).toHaveBeenCalledTimes(1)
		expect(getAccessToken()).toBeNull()
	})

	it('keeps the session on an ordinary domain failure', async () => {
		stubGraphQL({ ShopOwnerCompanies: { errors: [graphQLError('Invalid data', undefined, 400)], status: 400 } })
		setAccessToken('tok-1')

		const { client, onSessionLost } = setup()
		await info(client)

		expect(onSessionLost).not.toHaveBeenCalled()
		expect(getAccessToken()).toBe('tok-1')
	})

	// A dropped connection is not a dead session: the owner is almost certainly still signed in and
	// the wifi is not. Logging them out here would lose whatever they were typing.
	it('keeps the session on a transport failure', async () => {
		stubGraphQL({ ShopOwnerCompanies: { networkError: 'offline' } })
		setAccessToken('tok-1')

		const { client, onSessionLost } = setup()
		const result = await info(client)

		expect(result.error?.networkError).toBeDefined()
		expect(onSessionLost).not.toHaveBeenCalled()
		expect(getAccessToken()).toBe('tok-1')
	})

	describe('refresh circuit breaker', () => {
		const refreshCalls = (stub: ReturnType<typeof stubGraphQL>) =>
			stub.calls.filter((call) => call.operationName === 'Refresh').length

		// The whole point of the breaker: during a sustained outage every operation hitting the stale
		// token would otherwise refresh immediately, one after another with nothing between them. Each
		// consecutive transport failure opens a longer cooldown — 1s, 2s, 4s, … — capped at 30s, and no
		// `Refresh` is sent at all while one is open.
		it('opens a doubling cooldown after each consecutive refresh transport failure, capped at 30s', async () => {
			const stub = stubGraphQL({
				ShopOwnerCompanies: { errors: [graphQLError('Invalid token', undefined, 498)], status: 498 },
				Refresh: { networkError: 'offline' }
			})
			setAccessToken('tok-1')

			let clock = 0
			const { client, onSessionLost } = setup({ now: () => clock })

			// 1st failure (n=1): hits the network, opens a 1s window.
			await info(client)
			expect(refreshCalls(stub)).toBe(1)

			// Still inside the 1s window: no network call for the refresh at all.
			clock = 999
			await info(client)
			expect(refreshCalls(stub)).toBe(1)

			// The window has elapsed: hits the network again. 2nd consecutive failure (n=2) opens a 2s window.
			clock = 1_000
			await info(client)
			expect(refreshCalls(stub)).toBe(2)

			clock = 2_999
			await info(client)
			expect(refreshCalls(stub)).toBe(2)

			// 3rd consecutive failure (n=3) opens a 4s window.
			clock = 3_000
			await info(client)
			expect(refreshCalls(stub)).toBe(3)

			clock = 6_999
			await info(client)
			expect(refreshCalls(stub)).toBe(3)

			// 4th failure (n=4, 8s), 5th (n=5, 16s), 6th (n=6, min(30_000, 32_000) = 30s, the cap).
			clock = 7_000
			await info(client)
			expect(refreshCalls(stub)).toBe(4)

			clock = 15_000
			await info(client)
			expect(refreshCalls(stub)).toBe(5)

			clock = 31_000
			await info(client)
			expect(refreshCalls(stub)).toBe(6)

			// Right up against the 30s cap: still inside it, then just past it.
			clock = 60_999
			await info(client)
			expect(refreshCalls(stub)).toBe(6)

			clock = 61_000
			await info(client)
			expect(refreshCalls(stub)).toBe(7)

			// None of this is a lost session — every failure here is transport-level, so the token this
			// app already has is never touched.
			expect(onSessionLost).not.toHaveBeenCalled()
			expect(getAccessToken()).toBe('tok-1')
		})

		it('resets the counter and window on a successful refresh', async () => {
			const stub = stubGraphQL({
				ShopOwnerCompanies: { errors: [graphQLError('Invalid token', undefined, 498)], status: 498 },
				Refresh: [{ networkError: 'offline' }, refreshed('tok-2'), { networkError: 'offline' }]
			})
			setAccessToken('tok-1')

			let clock = 0
			const { client, onSessionLost } = setup({ now: () => clock })

			await info(client) // Refresh #1: transport failure, opens a 1s window (n=1).

			clock = 1_000 // window elapsed
			await info(client) // Refresh #2: succeeds — resets the breaker.
			expect(getAccessToken()).toBe('tok-2')

			clock = 1_001
			await info(client) // Refresh #3: transport failure again, right after the reset.

			// A fresh n=1 window opened at 1_001 elapses at 2_001. Had the counter kept counting from
			// before the reset instead (n=3), the window would still be open until 5_001.
			clock = 2_000
			await info(client)
			expect(refreshCalls(stub)).toBe(3)

			clock = 2_001
			await info(client)
			expect(refreshCalls(stub)).toBe(4)

			expect(onSessionLost).not.toHaveBeenCalled()
		})

		it('resets the window when the browser reports coming back online, even before it would have elapsed', async () => {
			const stub = stubGraphQL({
				ShopOwnerCompanies: { errors: [graphQLError('Invalid token', undefined, 498)], status: 498 },
				Refresh: { networkError: 'offline' }
			})
			setAccessToken('tok-1')

			let clock = 0
			const { client } = setup({ now: () => clock })

			await info(client) // Refresh #1: opens a 1s window, due to elapse at 1_000.
			expect(refreshCalls(stub)).toBe(1)

			clock = 500 // well inside the window
			window.dispatchEvent(new Event('online'))

			await info(client)
			expect(refreshCalls(stub)).toBe(2)
		})

		// The same reconnect signal, with no `signal` option at all — the shape every production caller
		// uses. Confirms the new option is additive: leaving it out keeps the listener registered exactly
		// as before.
		it('resets the window on `online` when no signal is given', async () => {
			const stub = stubGraphQL({
				ShopOwnerCompanies: { errors: [graphQLError('Invalid token', undefined, 498)], status: 498 },
				Refresh: { networkError: 'offline' }
			})
			setAccessToken('tok-1')

			let clock = 0
			const client = createGraphQLClient({ onSessionLost: vi.fn(), now: () => clock })

			await info(client) // Refresh #1: opens a 1s window, due to elapse at 1_000.
			expect(refreshCalls(stub)).toBe(1)

			clock = 500 // well inside the window
			window.dispatchEvent(new Event('online'))

			await info(client)
			expect(refreshCalls(stub)).toBe(2)
		})

		// The fix itself: once the caller aborts, the breaker must stop hearing `online` — otherwise the
		// listener a per-test client registers outlives the test and keeps firing against every client
		// built afterwards on the same shared jsdom `window`.
		it('no longer resets the window on `online` once the signal is aborted', async () => {
			const stub = stubGraphQL({
				ShopOwnerCompanies: { errors: [graphQLError('Invalid token', undefined, 498)], status: 498 },
				Refresh: { networkError: 'offline' }
			})
			setAccessToken('tok-1')

			let clock = 0
			const controller = new AbortController()
			const client = createGraphQLClient({ onSessionLost: vi.fn(), now: () => clock, signal: controller.signal })

			await info(client) // Refresh #1: opens a 1s window, due to elapse at 1_000.
			expect(refreshCalls(stub)).toBe(1)

			controller.abort()

			clock = 500 // well inside the window — an unaborted signal would have reset it by now
			window.dispatchEvent(new Event('online'))

			await info(client)
			// Still inside the window: the abort means `online` no longer reaches the breaker.
			expect(refreshCalls(stub)).toBe(1)

			clock = 1_000 // the window elapses on its own instead
			await info(client)
			expect(refreshCalls(stub)).toBe(2)
		})

		// The other end of the same option: a signal that is already aborted when the client is built
		// must never add the listener in the first place, not add-then-immediately-remove it.
		it('registers no `online` listener when the signal is already aborted', async () => {
			const stub = stubGraphQL({
				ShopOwnerCompanies: { errors: [graphQLError('Invalid token', undefined, 498)], status: 498 },
				Refresh: { networkError: 'offline' }
			})
			setAccessToken('tok-1')

			let clock = 0
			const controller = new AbortController()
			controller.abort()
			const client = createGraphQLClient({ onSessionLost: vi.fn(), now: () => clock, signal: controller.signal })

			await info(client) // Refresh #1: opens a 1s window, due to elapse at 1_000.
			expect(refreshCalls(stub)).toBe(1)

			clock = 500 // well inside the window
			window.dispatchEvent(new Event('online'))

			await info(client)
			expect(refreshCalls(stub)).toBe(1)
		})

		// ADR-019: marketplace-user builds a fresh urql client per SSR request, where there is no
		// `window` at all. The breaker has to build (and keep working) without one rather than throwing,
		// and it simply never hears an early reconnect there.
		it('builds without touching window when there is none (SSR / non-browser build)', async () => {
			vi.stubGlobal('window', undefined)

			const stub = stubGraphQL({
				ShopOwnerCompanies: [{ errors: [graphQLError('Invalid token', undefined, 498)], status: 498 }, { data: COMPANIES }],
				Refresh: refreshed('tok-2')
			})
			setAccessToken('tok-1')

			const { client } = setup()
			const result = await info(client)

			expect(refreshCalls(stub)).toBe(1)
			expect(result.data).toEqual(COMPANIES)
		})
	})
})
