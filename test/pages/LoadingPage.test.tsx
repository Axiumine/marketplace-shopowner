import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { getAccessToken } from '@/api/tokenStore'
import { getPendingEmail, getSession, setPendingEmail } from '@/auth/session'
import { DEFAULT_REDIRECT, safeRedirect } from '@/pages/LoadingPage'

import { graphQLError, stubGraphQL } from '../helpers/graphql'
import { renderRoute } from '../helpers/render'

/**
 * The probe's answer. `shopOwnerCompanies` and not an identity query — the ShopOwner resource service
 * exposes exactly one query, so this is the only authenticated request there is to make.
 */
const signedIn = { data: { shopOwnerCompanies: [] } }

describe('safeRedirect', () => {
	it('keeps a same-site path', () => {
		expect(safeRedirect('/companies')).toBe('/companies')
	})

	it('falls back when there is no target', () => {
		expect(safeRedirect(undefined)).toBe(DEFAULT_REDIRECT)
	})

	// The open-redirect cases. The target arrives in a query string, so anyone can hand an owner a link
	// to `/loading?redirect=…` and have this app forward them somewhere else wearing a trusted domain —
	// after a successful login, which is exactly when a phishing page is most convincing.
	it('refuses an absolute URL', () => {
		expect(safeRedirect('https://evil.example/login')).toBe(DEFAULT_REDIRECT)
	})

	// `//evil.example` is a protocol-relative URL, not a path — and it starts with a slash, so a
	// `startsWith('/')` check on its own lets it through.
	it('refuses a protocol-relative URL', () => {
		expect(safeRedirect('//evil.example')).toBe(DEFAULT_REDIRECT)
	})

	it('refuses a relative path', () => {
		expect(safeRedirect('companies')).toBe(DEFAULT_REDIRECT)
	})

	it('refuses an empty target', () => {
		expect(safeRedirect('')).toBe(DEFAULT_REDIRECT)
	})
})

describe('LoadingPage', () => {
	it('shows a spinner while the session is being restored', async () => {
		stubGraphQL({ ShopOwnerCompanies: { pending: true } })
		await renderRoute('/loading')

		expect(screen.getByText('Loading session')).toBeInTheDocument()
	})

	/*
	 * ⚠️ `[]` is the interesting answer, not the empty one. An owner with no company yet is authenticated
	 * exactly as much as one with three, and every falsy test — `result.data?.shopOwnerCompanies ?`,
	 * `.length > 0`, a bare truthiness check — would bounce them straight back to the login page with no
	 * error to explain it. The stub above answers with the empty list for that reason.
	 */
	it('establishes the session and lands on the dashboard', async () => {
		stubGraphQL({ ShopOwnerCompanies: signedIn })
		const { router } = await renderRoute('/loading', { session: null })

		await waitFor(() => {
			expect(router.state.location.pathname).toBe('/home')
		})
		expect(getSession()).not.toBeNull()
	})

	// The address the sign-in form put aside, turned into the session's own. It is the only way this app
	// ever learns who is signed in: no ShopOwner-tier query answers "who am I".
	it('names the session with the address the login form left behind', async () => {
		setPendingEmail('owner@marketplace.it')
		stubGraphQL({ ShopOwnerCompanies: signedIn })
		const { router } = await renderRoute('/loading', { session: null })

		await waitFor(() => {
			expect(router.state.location.pathname).toBe('/home')
		})
		expect(getSession()).toEqual({ email: 'owner@marketplace.it' })
	})

	/*
	 * ⚠️ The reload path, and the reason the address is read without being cleared.
	 *
	 * A session restored from the cookie has no address to carry — nobody typed one — and it is a session
	 * all the same: `email: null`, never a redirect back to the login page. What must *not* happen is the
	 * page storing `undefined` or leaving the session unset because the address was missing.
	 */
	it('establishes a nameless session when nobody typed an address', async () => {
		stubGraphQL({ ShopOwnerCompanies: signedIn })
		const { router } = await renderRoute('/loading', { session: null })

		await waitFor(() => {
			expect(router.state.location.pathname).toBe('/home')
		})
		expect(getSession()).toEqual({ email: null })
	})

	/*
	 * ⚠️ Reading the address must not consume it. This page establishes the session from inside an
	 * effect, React runs every effect twice under StrictMode, and a read-and-clear would let the second
	 * run overwrite the session with a nameless one — the owner would sign in and watch their address
	 * disappear from the sidebar for no reason they could see. Clearing belongs to `useLogout`.
	 */
	it('leaves the pending address where it found it', async () => {
		setPendingEmail('owner@marketplace.it')
		stubGraphQL({ ShopOwnerCompanies: signedIn })
		const { router } = await renderRoute('/loading', { session: null })

		await waitFor(() => {
			expect(router.state.location.pathname).toBe('/home')
		})
		expect(getPendingEmail()).toBe('owner@marketplace.it')
	})

	it('honours a same-site redirect target', async () => {
		stubGraphQL({ ShopOwnerCompanies: signedIn })
		const { router } = await renderRoute('/loading?redirect=%2Fcompanies', { session: null })

		await waitFor(() => {
			expect(router.state.location.pathname).toBe('/companies')
		})
	})

	/**
	 * The router parses search values with `JSON.parse`, so `?redirect=123` arrives as the number 123 and
	 * not as the string "123". `safeRedirect` is typed for `string | undefined` and would call
	 * `.startsWith` on it; the route's search schema is what keeps that from ever happening, by rejecting
	 * anything that is not a string into `undefined` before the page is rendered.
	 *
	 * Rejecting has to mean *replacing*, not dropping: a route's search is merged over its parent's, and
	 * the root route validates nothing — so a key the loading schema simply omitted would come back
	 * through unvalidated from above.
	 */
	it('ignores a redirect target that is not a string', async () => {
		stubGraphQL({ ShopOwnerCompanies: signedIn })
		const { router } = await renderRoute('/loading?redirect=123', { session: null })

		await waitFor(() => {
			expect(router.state.location.pathname).toBe('/home')
		})
	})

	it('sends an off-site redirect target to the dashboard instead', async () => {
		stubGraphQL({ ShopOwnerCompanies: signedIn })
		const { router } = await renderRoute('/loading?redirect=https%3A%2F%2Fevil.example', { session: null })

		await waitFor(() => {
			expect(router.state.location.pathname).toBe('/home')
		})
	})

	/**
	 * The page-reload story, end to end. The access token lives in memory, so a reload has none: issuing
	 * this query is what re-mints it — urql's `willAuthError` sees a null token, runs `refresh` against
	 * the httpOnly cookie, and only then sends the query.
	 *
	 * The order of the two calls is asserted for that reason. A cheaper "is a cookie there?" check would
	 * pass for an expired or revoked session — the cookie is httpOnly, so presence is all a browser can
	 * see — and the app would render in full before failing on the first piece of data it wanted.
	 */
	it('refreshes from the cookie when there is no token in memory', async () => {
		const stub = stubGraphQL({
			Refresh: { data: { refresh: { status: true, accessToken: 'tok-2' } } },
			ShopOwnerCompanies: signedIn
		})
		const { router } = await renderRoute('/loading', { token: null, session: null })

		await waitFor(() => {
			expect(router.state.location.pathname).toBe('/home')
		})
		expect(stub.calls.map((call) => call.operationName)).toEqual(['Refresh', 'ShopOwnerCompanies'])
		expect(getAccessToken()).toBe('tok-2')
	})

	it('clears everything and returns to the login page when the session is gone', async () => {
		stubGraphQL({ ShopOwnerCompanies: { errors: [graphQLError('No session', undefined, 401)], status: 401 } })
		const { router } = await renderRoute('/loading', { session: null })

		await waitFor(() => {
			expect(router.state.location.pathname).toBe('/')
		})
		expect(getAccessToken()).toBeNull()
		expect(getSession()).toBeNull()
	})

	it('renders', async () => {
		stubGraphQL({ ShopOwnerCompanies: { pending: true } })
		const { container } = await renderRoute('/loading')

		expect(container).toMatchSnapshot()
	})
})
