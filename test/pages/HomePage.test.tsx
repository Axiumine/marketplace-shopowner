import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { stubGraphQL } from '../helpers/graphql'
import { renderRoute } from '../helpers/render'

const noCompanies = { ShopOwnerCompanies: { data: { shopOwnerCompanies: [] } } }

describe('HomePage', () => {
	it('shows the dashboard title and no breadcrumbs', async () => {
		stubGraphQL({})
		await renderRoute('/home')

		expect(screen.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument()
		// `PageHeader` renders the breadcrumb list only when there is a trail. The dashboard is the top
		// of the tree, and a one-item trail pointing at the page you are on is noise.
		expect(screen.queryByRole('navigation', { name: 'Path' })).not.toBeInTheDocument()
	})

	/*
	 * ⚠️ One tile, and the assertion is that there is exactly one. The operator app's dashboard carries
	 * counters and a period chart fed by `shopOwnersStats` / `shopOwnersPerPeriod`, and this tier has no
	 * counterpart to either — a tile copied across would either query an endpoint that does not implement
	 * it or count an array the page would have to fetch in full to say a number about.
	 */
	it('carries the companies tile and nothing else', async () => {
		stubGraphQL({})
		await renderRoute('/home')

		// Scoped to `main`: the sidebar is part of the same frame and carries a link per section, so an
		// unscoped count is a count of the shell rather than of the dashboard.
		expect(within(screen.getByRole('main')).getAllByRole('link')).toHaveLength(1)
	})

	// The tile's `to` is typed as the router's own union of route paths, so a destination that serves no
	// page fails `tsc` rather than 404ing at run time. Both halves are still asserted — the href it
	// renders, and that clicking it actually lands there.
	it('opens the companies page from the tile', async () => {
		stubGraphQL(noCompanies)
		const { router } = await renderRoute('/home')

		const tile = screen.getByRole('link', { name: /Companies\s*Manage your companies/ })
		expect(tile).toHaveAttribute('href', '/companies')

		await userEvent.click(tile)
		expect(router.state.location.pathname).toBe('/companies')
	})

	// The dashboard itself asks for nothing: it has no query of its own, and a tile that eagerly fetched
	// the list it links to would pay for the companies page on a screen that never shows a company.
	it('sends no request of its own', async () => {
		const stub = stubGraphQL({})
		await renderRoute('/home')

		expect(stub.calls).toHaveLength(0)
	})

	it('renders', async () => {
		stubGraphQL({})
		await renderRoute('/home')

		expect(screen.getByRole('main')).toMatchSnapshot()
	})
})
