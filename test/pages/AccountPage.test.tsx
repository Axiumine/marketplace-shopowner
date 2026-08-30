import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { stubGraphQL } from '../helpers/graphql'
import { renderRoute } from '../helpers/render'

const PAGE = '/account'

describe('AccountPage', () => {
	it('shows the title and the trail back to the dashboard', async () => {
		stubGraphQL({})
		await renderRoute(PAGE)

		expect(screen.getByRole('heading', { name: 'Account', level: 1 })).toBeInTheDocument()

		const trail = within(screen.getByRole('navigation', { name: 'Path' }))
		expect(trail.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/home')
		// The current page is a crumb without a link: one pointing at where you already are is noise.
		expect(trail.queryByRole('link', { name: 'Account' })).not.toBeInTheDocument()
	})

	it('walks back to the dashboard from the trail', async () => {
		stubGraphQL({})
		const { router } = await renderRoute(PAGE)

		await userEvent.click(within(screen.getByRole('navigation', { name: 'Path' })).getByRole('link', { name: 'Dashboard' }))

		expect(router.state.location.pathname).toBe('/home')
	})

	/*
	 * ⚠️ One card, and the assertion is that there is exactly one. This is not a settings screen: the
	 * ShopOwner tier has no `shopOwnerUpdatePwd` and no self-service personal-data mutation, so a password
	 * box or a details form copied over from the admin app would have nowhere to submit.
	 */
	it('carries the close-account card and nothing else', async () => {
		stubGraphQL({})
		await renderRoute(PAGE)

		const main = within(screen.getByRole('main'))
		expect(main.getByRole('region', { name: 'Close my account' })).toBeInTheDocument()
		expect(main.getAllByRole('region')).toHaveLength(1)
	})

	// No Save bar either, unlike the other two domain pages: closing an account is not a draft collected
	// with other edits and written on Save. It is one press with its own confirmation.
	it('offers no page-wide save', async () => {
		stubGraphQL({})
		await renderRoute(PAGE)

		expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
	})

	// The page reads nothing. There is no ShopOwner-tier query that answers "who am I", and a page that
	// invented one would be asking for a resolver that does not exist.
	it('sends no request of its own', async () => {
		const stub = stubGraphQL({})
		await renderRoute(PAGE)

		expect(stub.calls).toHaveLength(0)
	})

	it('renders', async () => {
		stubGraphQL({})
		await renderRoute(PAGE)

		expect(screen.getByRole('main')).toMatchSnapshot()
	})
})
