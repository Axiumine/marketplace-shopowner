import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { stubGraphQL } from '../../helpers/graphql'
import { renderRoute } from '../../helpers/render'

describe('AppShell', () => {
	it('frames the page in the sidebar and the footer', async () => {
		stubGraphQL({})
		await renderRoute('/home')

		expect(screen.getByRole('navigation', { name: 'Main menu' })).toBeInTheDocument()
		expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { name: 'Dashboard' }))
		expect(screen.getByText('Marketplace — shop owner area')).toBeInTheDocument()
	})

	// The frame belongs to the pathless `app` route, so the two pages outside it — login and loading —
	// get no sidebar. An owner who is not signed in should not be shown the sections they cannot open.
	it('does not frame the login page', async () => {
		stubGraphQL({})
		await renderRoute('/', { token: null, session: null })

		expect(screen.queryByRole('navigation', { name: 'Main menu' })).not.toBeInTheDocument()
	})

	it('does not frame the loading page', async () => {
		stubGraphQL({ ShopOwnerCompanies: { pending: true } })
		await renderRoute('/loading')

		expect(screen.queryByRole('navigation', { name: 'Main menu' })).not.toBeInTheDocument()
	})

	it('renders', async () => {
		stubGraphQL({})
		const { container } = await renderRoute('/home')

		expect(container).toMatchSnapshot()
	})
})
