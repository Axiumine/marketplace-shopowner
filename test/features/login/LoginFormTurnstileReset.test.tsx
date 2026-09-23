import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider as UrqlProvider } from 'urql'
import type { Mock } from 'vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createGraphQLClient } from '@/api/client'

import { stubGraphQL } from '../../helpers/graphql'

/**
 * The regression test for B2: a failed, Turnstile-guarded login has to leave the next attempt able to
 * carry a *fresh* token, not the one the backend already spent verifying the rejected attempt.
 *
 * ⚠️ Requires an actual site key, unlike every other test that touches `LoginForm` — with none
 * configured `Turnstile` never mounts a widget at all (see `Turnstile.test.tsx`), so the bug this guards
 * against cannot be demonstrated there. `VITE_TURNSTILE_SITE_KEY` is read once into the `@/env` module
 * singleton, so it has to be stubbed and the module graph reset *before* anything that transitively
 * imports it — `@/router`, here — is loaded, exactly as `Turnstile.test.tsx` does for the component
 * alone.
 */
const SITE_KEY = '0x4AAAAAAABBBBBBBBCCCCCC'
const SCRIPT_ID = 'cf-turnstile-script'

type RenderFn = NonNullable<typeof globalThis.turnstile>['render']
type RenderOptions = Parameters<RenderFn>[1]

/** A stand-in for the widget, in the same shape `Turnstile.test.tsx` gives it — one call per mount. */
const widgetApi = () => {
	let mounted = 0
	const render = vi.fn<RenderFn>(() => `widget-${++mounted}`)
	const remove = vi.fn()

	vi.stubGlobal('turnstile', { render, remove })

	return {
		render,
		remove,
		/** The options a given `render` call (0-based, in call order) was given. */
		optionsAt: (call: number) => (render as Mock<RenderFn>).mock.calls[call]?.[1] as RenderOptions
	}
}

afterEach(() => {
	vi.unstubAllEnvs()
	document.getElementById(SCRIPT_ID)?.remove()
})

describe('LoginForm, with a Turnstile site key configured', () => {
	it('remounts the widget after a refused submit and sends the fresh token it issues', async () => {
		vi.stubEnv('VITE_TURNSTILE_SITE_KEY', SITE_KEY)
		vi.resetModules()

		// A script already in the document resolves `loadScript()` immediately — see the same technique
		// in `Turnstile.test.tsx` — so the widget renders without a `load` event to fire by hand.
		const existing = document.createElement('script')
		existing.id = SCRIPT_ID
		document.head.append(existing)

		const api = widgetApi()
		const { createAppRouter } = await import('@/router')
		const router = createAppRouter(createMemoryHistory({ initialEntries: ['/'] }))

		const stub = stubGraphQL({
			Login: [
				{ data: { login: { accessToken: '', onboardingStep: '', onboardingDone: false } } },
				{ data: { login: { accessToken: 'tok-2', onboardingStep: '', onboardingDone: false } } }
			],
			ShopOwnerCompanies: { data: { shopOwnerCompanies: [] } }
		})

		render(
			<UrqlProvider value={createGraphQLClient({ onSessionLost: vi.fn() })}>
				<RouterProvider router={router as never} />
			</UrqlProvider>
		)

		await waitFor(() => {
			expect(router.state.status).toBe('idle')
		})
		await waitFor(() => {
			expect(api.render).toHaveBeenCalledTimes(1)
		})

		// The shop owner solves the challenge and submits with a wrong password.
		act(() => {
			api.optionsAt(0).callback('token-1')
		})
		await userEvent.type(screen.getByLabelText('Email'), 'owner@marketplace.test')
		await userEvent.type(screen.getByLabelText('Password'), 'wrong-password')
		await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

		await waitFor(() => {
			expect(stub.calls.filter((call) => call.operationName === 'Login')).toHaveLength(1)
		})
		expect(stub.calls[0]?.variables).toMatchObject({ turnstileToken: 'token-1' })
		await screen.findByText('Invalid credentials')

		// The rejected attempt already spent `token-1` against Cloudflare's siteverify. Without a reset
		// the widget would still be sitting there holding it, and the corrected resubmit below would go
		// out carrying the same, already-spent token.
		await waitFor(() => {
			expect(api.remove).toHaveBeenCalledWith('widget-1')
		})
		await waitFor(() => {
			expect(api.render).toHaveBeenCalledTimes(2)
		})

		// The fresh widget solves on its own and hands up a new token.
		act(() => {
			api.optionsAt(1).callback('token-2')
		})
		await userEvent.clear(screen.getByLabelText('Password'))
		await userEvent.type(screen.getByLabelText('Password'), 'password123')
		await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

		await waitFor(() => {
			expect(stub.calls.filter((call) => call.operationName === 'Login')).toHaveLength(2)
		})
		expect(stub.calls[1]?.variables).toMatchObject({ turnstileToken: 'token-2' })
	})
})
