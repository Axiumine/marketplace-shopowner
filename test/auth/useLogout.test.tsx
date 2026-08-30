import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ENDPOINT } from '@/api/endpoints'
import { getAccessToken } from '@/api/tokenStore'
import { getSession } from '@/auth/session'

import { graphQLError, stubGraphQL } from '../helpers/graphql'
import { renderRoute } from '../helpers/render'

const logout = async () => {
	await userEvent.click(screen.getByRole('button', { name: 'Logout' }))
}

/**
 * Exercised through the button that calls it. The hook's whole job is the order of four side effects —
 * mutate, clear, clear, navigate — and calling it from a bare `renderHook` would leave the navigation
 * mocked, which is the half most likely to be wrong.
 */
describe('useLogout', () => {
	it('sends logout to the logout endpoint, clears everything and returns to the login page', async () => {
		const stub = stubGraphQL({ Logout: { data: { logout: true } } })
		const { router } = await renderRoute('/home')

		await logout()

		await waitFor(() => {
			expect(router.state.location.pathname).toBe('/')
		})
		expect(stub.calls.map((call) => call.operationName)).toEqual(['Logout'])
		expect(stub.calls[0]?.url).toBe(ENDPOINT.logout)
		// The endpoint is bearer-authenticated: a logout with no token deletes nobody's session.
		expect(stub.calls[0]?.authorization).toBe('Bearer access:tok-1')
		expect(getAccessToken()).toBeNull()
		expect(getSession()).toBeNull()
	})

	// A logout that failed server-side still has to log the admin out of this browser. Keeping the
	// token because a request went wrong is the opposite of what the button promises.
	it('logs out locally even when the mutation fails', async () => {
		stubGraphQL({ Logout: { errors: [graphQLError('Session not found', undefined, 401)], status: 401 } })
		const { router } = await renderRoute('/home')

		await logout()

		await waitFor(() => {
			expect(router.state.location.pathname).toBe('/')
		})
		expect(getAccessToken()).toBeNull()
		expect(getSession()).toBeNull()
	})

	it('logs out locally even when the request never reaches the server', async () => {
		stubGraphQL({ Logout: { networkError: 'offline' } })
		const { router } = await renderRoute('/home')

		await logout()

		await waitFor(() => {
			expect(router.state.location.pathname).toBe('/')
		})
		expect(getAccessToken()).toBeNull()
		expect(getSession()).toBeNull()
	})
})
