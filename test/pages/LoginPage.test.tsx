import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ENDPOINT } from '@/api/endpoints'
import { getAccessToken } from '@/api/tokenStore'
import { getPendingEmail, getSession } from '@/auth/session'

import { graphQLError, stubGraphQL } from '../helpers/graphql'
import { renderRoute } from '../helpers/render'

const signedOut = { token: null, session: null } as const

/** The bootstrap probe `/loading` runs once the token is stored — the sign-in is two pages long. */
const PROBE = { ShopOwnerCompanies: { data: { shopOwnerCompanies: [] } } }

const OK_LOGIN = { Login: { data: { login: { accessToken: 'tok-1', onboardingStep: '', onboardingDone: false } } } }

const fillIn = async (email: string, password: string) => {
	await userEvent.type(screen.getByLabelText('Email'), email)
	await userEvent.type(screen.getByLabelText('Password'), password)
}

const submit = async () => {
	await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('LoginPage', () => {
	it('renders the login card', async () => {
		stubGraphQL({})
		const { container } = await renderRoute('/', signedOut)

		expect(screen.getByRole('heading', { name: 'Marketplace — shop owner area' })).toBeInTheDocument()
		expect(container).toMatchSnapshot()
	})

	/*
	 * ⚠️ The note is the **opposite** of the admin app's, and the difference is asserted rather than
	 * left to the wording. `resetPwd` / `updatePwd` on public-resource are bound to the `ShopOwner` model,
	 * so recovery answers for exactly the accounts that sign in here — it is missing from this app because
	 * the screens are not built, not because the backend refuses it. A note claiming the backend cannot do
	 * it would send an owner to the admin forever.
	 */
	it('says recovery is not built yet rather than claiming it is unavailable', async () => {
		stubGraphQL({})
		await renderRoute('/', signedOut)

		expect(screen.getByText(/Self-service recovery is not available from this screen yet/)).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: /recovery|reset/i })).not.toBeInTheDocument()
	})

	// ⚠️ Asserted, not assumed. A "development only" default email and password is substituted into the
	// client bundle statically by Vite, so it ships to production in plain text; this test is what stops
	// one being added for convenience.
	it('pre-fills nothing', async () => {
		stubGraphQL({})
		await renderRoute('/', signedOut)

		expect(screen.getByLabelText('Email')).toHaveValue('')
		expect(screen.getByLabelText('Password')).toHaveValue('')
		expect(screen.getByLabelText('Remember me on this device')).not.toBeChecked()
	})

	// `owner@marketplace`, not `owner`: the field is `type="email"`, so a value with no `@` fails the
	// browser's own constraint validation and the submit event never fires — nothing to assert about this
	// app. A missing TLD is the gap between the two checks: the HTML validator accepts it, the zod schema
	// does not, and that is the branch under test.
	it('refuses a malformed email without a round-trip', async () => {
		const stub = stubGraphQL({})
		await renderRoute('/', signedOut)

		await fillIn('owner@marketplace', 'password123')
		await submit()

		expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
		expect(stub.calls).toHaveLength(0)
	})

	it('refuses an empty password without a round-trip', async () => {
		const stub = stubGraphQL({})
		await renderRoute('/', signedOut)

		await userEvent.type(screen.getByLabelText('Email'), 'owner@marketplace.test')
		await submit()

		expect(await screen.findByText('Enter the password')).toBeInTheDocument()
		expect(stub.calls).toHaveLength(0)
	})

	// No minimum length on the password: the rules live on the backend, and refusing to even try an
	// existing password because it is "too short" locks out anyone whose account predates the policy.
	it('sends a short password rather than rejecting it locally', async () => {
		const stub = stubGraphQL({ Login: { errors: [graphQLError('Invalid credentials', undefined, 400)], status: 400 } })
		await renderRoute('/', signedOut)

		await fillIn('owner@marketplace.test', 'short')
		await submit()

		await waitFor(() => {
			expect(stub.calls).toHaveLength(1)
		})
		expect(stub.calls[0]?.variables).toEqual({
			email: 'owner@marketplace.test',
			password: 'short',
			rememberMe: false,
			turnstileToken: null
		})
	})

	/*
	 * ⚠️ `turnstileToken: null` is the correct request here, not a gap in the test. The widget is disabled
	 * without a `VITE_TURNSTILE_SITE_KEY` — the state of every developer machine and of this suite — and
	 * the resolver verifies a token only where a secret key is configured, so the two halves agree on
	 * "off". What this asserts is that the variable is *sent*: an owner whose browser did solve a
	 * challenge has to have the token reach `guardPublicLogin`, and a form that dropped it would look
	 * identical on screen and fail only against a deployment that holds the secret.
	 */
	it('sends the Turnstile variable even when no widget is configured', async () => {
		const stub = stubGraphQL({ Login: { data: { login: { accessToken: '', onboardingStep: '', onboardingDone: false } } } })
		await renderRoute('/', signedOut)

		await fillIn('owner@marketplace.test', 'password123')
		await submit()

		await waitFor(() => {
			expect(stub.calls).toHaveLength(1)
		})
		expect(stub.calls[0]?.variables).toHaveProperty('turnstileToken', null)
	})

	// The widget renders nothing without a site key, so the login card must not reach for the third-party
	// script either — a dev box that cannot use the widget should not be asking Cloudflare for it.
	it('loads no verification script when no site key is configured', async () => {
		stubGraphQL({})
		await renderRoute('/', signedOut)

		expect(document.getElementById('cf-turnstile-script')).toBeNull()
	})

	it('signs in, stores the token and lands on the dashboard', async () => {
		const stub = stubGraphQL({ ...OK_LOGIN, ...PROBE })
		const { router } = await renderRoute('/', signedOut)

		await fillIn('owner@marketplace.test', 'password123')
		await submit()

		expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
		expect(getAccessToken()).toBe('tok-1')
		expect(router.state.location.pathname).toBe('/home')
		expect(stub.calls[0]?.url).toBe(ENDPOINT.publicAuthorization)
	})

	/*
	 * ⚠️ The address goes to `/loading` through the session module and **not** through the URL, and both
	 * halves are asserted. This tier has no "who am I" query, so the form is the only place the owner's
	 * own address is ever known — and a query string carrying it would put it in the browser history, in
	 * every referrer this app leaks and in every access log in front of it.
	 */
	it('hands the address to the bootstrap page without putting it in the URL', async () => {
		stubGraphQL({ ...OK_LOGIN, ...PROBE })
		const { router } = await renderRoute('/', signedOut)

		await fillIn('owner@marketplace.test', 'password123')
		await submit()

		expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
		expect(getPendingEmail()).toBe('owner@marketplace.test')
		expect(getSession()).toEqual({ email: 'owner@marketplace.test' })
		expect(router.history.location.href).not.toContain('owner%40marketplace.test')
		expect(router.history.location.href).not.toContain('owner@marketplace.test')
	})

	// `rememberMe` controls the lifetime of the refresh-token cookie server-side, so the checkbox has to
	// reach the mutation — a form that renders it but hardcodes `false` looks identical on screen and
	// silently gives every owner a session that dies with the browser.
	it('sends rememberMe when the box is ticked', async () => {
		const stub = stubGraphQL({ ...OK_LOGIN, ...PROBE })
		await renderRoute('/', signedOut)

		await fillIn('owner@marketplace.test', 'password123')
		await userEvent.click(screen.getByLabelText('Remember me on this device'))
		await submit()

		await waitFor(() => {
			expect(stub.calls[0]?.variables).toEqual({
				email: 'owner@marketplace.test',
				password: 'password123',
				rememberMe: true,
				turnstileToken: null
			})
		})
	})

	it('reports the backend error and stays put', async () => {
		stubGraphQL({
			Login: {
				errors: [graphQLError('Invalid credentials', 'Wrong email or password', 400)],
				status: 400
			}
		})
		const { router } = await renderRoute('/', signedOut)

		await fillIn('owner@marketplace.test', 'password123')
		await submit()

		expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password')
		expect(getAccessToken()).toBeNull()
		expect(getPendingEmail()).toBeNull()
		expect(router.state.location.pathname).toBe('/')
	})

	// The one case the schema cannot express: `accessToken` is non-null, so an empty string is the
	// service answering without minting a session. Treating it as success stores `''`, and the owner
	// lands on a dashboard whose every query then fails with no explanation of why.
	it('reports an empty token as a failed login', async () => {
		stubGraphQL({ Login: { data: { login: { accessToken: '', onboardingStep: '', onboardingDone: false } } } })
		const { router } = await renderRoute('/', signedOut)

		await fillIn('owner@marketplace.test', 'password123')
		await submit()

		expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials')
		expect(getAccessToken()).toBeNull()
		expect(getPendingEmail()).toBeNull()
		expect(router.state.location.pathname).toBe('/')
	})

	/*
	 * ⚠️ `onboardingStep` and `onboardingDone` are selected by the document and nothing here may branch on
	 * them. `login.mts` declares them outside its transaction, computes the real step inside it, writes
	 * *that* into Redis and returns the untouched locals — so every shop owner is answered `''` and
	 * `false` regardless of state. A form that routed a "step 2" owner somewhere else would send all of
	 * them there. This asserts the sign-in ignores both, and is the test to delete the day the resolver is
	 * fixed and the branching is written on purpose.
	 */
	it('ignores the onboarding fields the resolver answers with', async () => {
		stubGraphQL({
			Login: { data: { login: { accessToken: 'tok-1', onboardingStep: '3', onboardingDone: false } } },
			...PROBE
		})
		const { router } = await renderRoute('/', signedOut)

		await fillIn('owner@marketplace.test', 'password123')
		await submit()

		expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
		expect(router.state.location.pathname).toBe('/home')
	})
})
