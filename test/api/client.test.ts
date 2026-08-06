import { describe, expect, it, vi } from 'vitest'

import { createGraphQLClient } from '@/api/client'
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
			legalName: 'Rossi Mario S.r.l.',
			vatNumber: '12345678901',
			taxCode: null,
			contactPerson: 'Mario Rossi',
			administrator: 'Mario Rossi',
			uniqueCode: null,
			certifiedEmail: 'rossi@pec.it',
			registryExtract: 'MI-123456',
			address: {
				street: 'Via Dante 3',
				postalCode: '20121',
				city: 'Milano',
				province: 'MI',
				position: { type: 'Point', coordinates: [9.1859, 45.4668] }
			}
		}
	]
}

const refreshed = (accessToken: string) => ({ data: { refresh: { status: true, accessToken } } })

const setup = () => {
	const onSessionLost = vi.fn()
	return { client: createGraphQLClient({ onSessionLost }), onSessionLost }
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
				{ email: 'owner@marketplace.it', password: 'password123', rememberMe: false },
				CTX_PUBLIC_AUTHORIZATION
			)
			.toPromise()

		expect(stub.calls).toHaveLength(1)
		expect(stub.calls[0]?.url).toBe(ENDPOINT.publicAuthorization)
		expect(stub.calls[0]?.authorization).toBeNull()
	})

	// The page-reload story: the access token lives in memory, a reload wipes it, and the first
	// authenticated operation after the reload re-mints it from the cookie instead of bouncing the
	// operator to the login page.
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
		stubGraphQL({
			ShopOwnerCompanies: { errors: [graphQLError('Invalid token', undefined, 498)], status: 498 },
			Refresh: { data: { refresh: { status: false, accessToken: '' } } }
		})
		setAccessToken('tok-1')

		const { client, onSessionLost } = setup()
		await info(client)

		expect(onSessionLost).toHaveBeenCalled()
		expect(getAccessToken()).toBeNull()
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
})
