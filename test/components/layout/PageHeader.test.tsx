import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { stubGraphQL } from '../../helpers/graphql'
import { renderRoute } from '../../helpers/render'

const noCompanies = { ShopOwnerCompanies: { data: { shopOwnerCompanies: [] } } }

/*
 * ⚠️ Rendered through `renderRoute`, not a bare `render()`: a crumb with a `to` renders a router `Link`,
 * which reads the router context — a hand-built wrapper would test the header against a tree no page
 * actually mounts it in. `/home` and `/companies` are the app's own two callers, one with no trail and
 * one with a two-crumb trail, so the pair covers the branch that decides whether the `nav` renders at
 * all rather than reaching for props no page passes.
 */
describe('PageHeader', () => {
	it('renders the title alone, with no breadcrumb trail', async () => {
		stubGraphQL({})
		await renderRoute('/home')

		expect(screen.getByRole('heading', { name: 'Dashboard', level: 1 }).closest('header')).toMatchSnapshot()
	})

	// A distinct visual state from the title-alone render above: the breadcrumb `nav` only exists when a
	// page hands PageHeader a trail, and one crumb here carries a router `Link` while the other does not.
	it('renders the title with a breadcrumb trail', async () => {
		stubGraphQL(noCompanies)
		await renderRoute('/companies')

		expect(screen.getByRole('heading', { name: 'Companies', level: 1 }).closest('header')).toMatchSnapshot()
	})
})
