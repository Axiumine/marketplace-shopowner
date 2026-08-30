import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ENDPOINT } from '@/api/endpoints'
import { getAccessToken } from '@/api/tokenStore'
import { getSession } from '@/auth/session'

import { graphQLError, stubGraphQL } from '../helpers/graphql'
import { stubLocationAssign } from '../helpers/location'
import { renderRoute } from '../helpers/render'

const logout = async () => {
	await userEvent.click(screen.getByRole('button', { name: 'Logout' }))
}

/**
 * Exercised through the button that calls it. The hook's whole job is the order of five side effects —
 * mutate, clear, clear, clear, leave the page — and calling it from a bare `renderHook` would leave the
 * last one mocked, which is the half most likely to be wrong.
 *
 * The exit is asserted as a `location.assign`, not as a router pathname, because a router navigation is
 * precisely what this must not be: the urql client is a module singleton holding a document cache, so only
 * a real page load guarantees the next sign-in starts with nothing of this one's.
 */
describe('useLogout', () => {
	it('sends logout to the logout endpoint, clears everything and leaves the page', async () => {
		const stub = stubGraphQL({ Logout: { data: { logout: true } } })
		const assign = stubLocationAssign()
		await renderRoute('/home')

		await logout()

		expect(assign).toHaveBeenCalledExactlyOnceWith('/')
		expect(stub.calls.map((call) => call.operationName)).toEqual(['Logout'])
		expect(stub.calls[0]?.url).toBe(ENDPOINT.logout)
		// The endpoint is bearer-authenticated: a logout with no token deletes nobody's session.
		expect(stub.calls[0]?.authorization).toBe('Bearer access:tok-1')
		expect(getAccessToken()).toBeNull()
		expect(getSession()).toBeNull()
	})

	// A logout that failed server-side still has to log the owner out of this browser. Keeping the
	// token because a request went wrong is the opposite of what the button promises.
	it('logs out locally even when the mutation fails', async () => {
		stubGraphQL({ Logout: { errors: [graphQLError('Session not found', undefined, 401)], status: 401 } })
		const assign = stubLocationAssign()
		await renderRoute('/home')

		await logout()

		expect(assign).toHaveBeenCalledExactlyOnceWith('/')
		expect(getAccessToken()).toBeNull()
		expect(getSession()).toBeNull()
	})

	it('logs out locally even when the request never reaches the server', async () => {
		stubGraphQL({ Logout: { networkError: 'offline' } })
		const assign = stubLocationAssign()
		await renderRoute('/home')

		await logout()

		expect(assign).toHaveBeenCalledExactlyOnceWith('/')
		expect(getAccessToken()).toBeNull()
		expect(getSession()).toBeNull()
	})
})
