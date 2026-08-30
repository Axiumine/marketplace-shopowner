import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { stubGraphQL } from './helpers/graphql'
import { renderRoute } from './helpers/render'

const noCompanies = { ShopOwnerCompanies: { data: { shopOwnerCompanies: [] } } }

describe('route guard', () => {
	/**
	 * The guard redirects to `/loading`, not to `/`. An empty session means one of two things — never
	 * signed in, or signed in and reloaded — and only `/loading` can tell them apart, because only a
	 * round-trip can say whether the httpOnly refresh cookie is still good.
	 */
	it('sends an unauthenticated visitor to the bootstrap page, remembering where they were going', async () => {
		stubGraphQL({ ShopOwnerCompanies: { pending: true } })
		const { router } = await renderRoute('/companies', { session: null })

		expect(router.state.location.pathname).toBe('/loading')
		expect(router.state.location.search).toEqual({ redirect: '/companies' })
	})

	// Every guarded page, one at a time: the guard is on the pathless frame rather than on any single
	// page, so a child that had been hung off the root instead would be reachable with no session at all
	// and nothing about `/companies` alone would say so.
	it('guards the dashboard as well', async () => {
		stubGraphQL({ ShopOwnerCompanies: { pending: true } })
		const { router } = await renderRoute('/home', { session: null })

		expect(router.state.location.pathname).toBe('/loading')
		expect(router.state.location.search).toEqual({ redirect: '/home' })
	})

	it('guards the catalogue as well', async () => {
		stubGraphQL({ ShopOwnerCompanies: { pending: true } })
		const { router } = await renderRoute('/items', { session: null })

		expect(router.state.location.pathname).toBe('/loading')
		expect(router.state.location.search).toEqual({ redirect: '/items' })
	})

	it('guards the account page as well', async () => {
		stubGraphQL({ ShopOwnerCompanies: { pending: true } })
		const { router } = await renderRoute('/account', { session: null })

		expect(router.state.location.pathname).toBe('/loading')
		expect(router.state.location.search).toEqual({ redirect: '/account' })
	})

	it('lets a signed-in owner through', async () => {
		stubGraphQL(noCompanies)
		const { router } = await renderRoute('/companies')

		expect(router.state.location.pathname).toBe('/companies')
	})

	// The login and loading pages sit outside the guarded frame, so they are reachable with no session.
	it('does not guard the login page', async () => {
		stubGraphQL({})
		const { router } = await renderRoute('/', { token: null, session: null })

		expect(router.state.location.pathname).toBe('/')
	})

	it('does not guard the bootstrap page', async () => {
		stubGraphQL({ ShopOwnerCompanies: { pending: true } })
		const { router } = await renderRoute('/loading', { token: null, session: null })

		expect(router.state.location.pathname).toBe('/loading')
	})
})

/**
 * `/loading` is the only route here with search params, and it has exactly one.
 *
 * ⚠️ The schema `.catch()`es rather than throwing, and that is not tidiness: the parameter is a URL
 * this app puts in the address bar itself, and a hand-edited or truncated one is a typo rather than
 * something worth a crash screen. Where it is checked for being *safe* is `safeRedirect`, inside the
 * page — see its own tests; this is only about the parse surviving.
 */
describe('the bootstrap search param', () => {
	const searchOf = async (url: string) => {
		stubGraphQL({ ShopOwnerCompanies: { pending: true } })
		const { router } = await renderRoute(url, { token: null, session: null })
		return router.state.location.search as { redirect?: string }
	}

	it('reads the target out of the URL', async () => {
		expect((await searchOf('/loading?redirect=%2Fcompanies')).redirect).toBe('/companies')
	})

	it('leaves it undefined when the URL carries none', async () => {
		expect(await searchOf('/loading')).toEqual({})
	})

	// The `.catch(undefined)` arm. The router parses `?redirect=a&redirect=b` into an array, which the
	// string schema refuses — and a throw here would be a crash screen on a link somebody mangled.
	it('falls back on a target that is not a string', async () => {
		expect((await searchOf('/loading?redirect=%2Fhome&redirect=%2Fcompanies')).redirect).toBeUndefined()
	})
})

/**
 * The six routes, each rendering the page it names.
 *
 * ⚠️ There is no `$_id` segment anywhere, and that absence is the tenant boundary rather than an
 * omission: `shopOwnerCompanies` and the three company writes take no owner id, so no URL in this app
 * can name whose data is on screen. The admin app's equivalent page is `/p/shopOwners/id/$_id`.
 *
 * ⚠️ `/items` is the one that had a choice — `companyItems` takes an `idCompany`, so `/items/$idCompany`
 * would have worked. The shop is page state instead, which keeps *every* id out of this app's URL space
 * rather than most of them.
 */
describe('routes', () => {
	it('serves the login page at the root', async () => {
		stubGraphQL({})
		await renderRoute('/', { token: null, session: null })

		expect(screen.getByRole('heading', { name: 'Marketplace — shop owner area', level: 1 })).toBeInTheDocument()
	})

	it('serves the dashboard', async () => {
		stubGraphQL({})
		await renderRoute('/home')

		expect(screen.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument()
	})

	it('serves the companies page', async () => {
		stubGraphQL(noCompanies)
		await renderRoute('/companies')

		expect(screen.getByRole('heading', { name: 'Companies', level: 1 })).toBeInTheDocument()
	})

	it('serves the items page', async () => {
		stubGraphQL(noCompanies)
		await renderRoute('/items')

		expect(screen.getByRole('heading', { name: 'Items', level: 1 })).toBeInTheDocument()
	})

	// `/account` is parameterless for a reason of its own rather than by habit: `shopOwnerDel` takes no
	// argument at all, so there is nothing about it a URL could carry.
	it('serves the account page', async () => {
		stubGraphQL({})
		await renderRoute('/account')

		expect(screen.getByRole('heading', { name: 'Account', level: 1 })).toBeInTheDocument()
	})

	// The page sends the query with no variables at all — not with an empty object it built, and not
	// with an id read from anywhere. An owner id appearing here would mean the browser was being asked
	// to state something the session already proves.
	it('asks for the companies without naming an owner', async () => {
		const stub = stubGraphQL({ ShopOwnerCompanies: { pending: true } })
		await renderRoute('/companies')

		expect(stub.calls.map((call) => call.operationName)).toEqual(['ShopOwnerCompanies'])
		expect(stub.calls[0]?.variables).toEqual({})
	})
})
