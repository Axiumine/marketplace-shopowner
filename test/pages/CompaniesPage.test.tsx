import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DISCARD_WARNING } from '@/features/companies/saving'

import { stubGraphQL } from '../helpers/graphql'
import { renderRoute } from '../helpers/render'

const PAGE = '/companies'

const company = {
	__typename: 'GraphQLCompany',
	_id: '65f0000000000000000000a1',
	legalName: 'Rivers Trading Ltd',
	vatNumber: '12345678901',
	taxCode: null,
	contactPerson: 'Mark Rivers',
	administrator: 'Mark Rivers',
	uniqueCode: null,
	certifiedEmail: 'certified@rivers.test',
	registryExtract: 'MA-123456',
	address: {
		street: '3 Oak Street',
		postalCode: '02108',
		city: 'Boston',
		province: 'MA',
		position: { type: 'Point', coordinates: [-71.0636, 42.3626] }
	}
}

const list = { ShopOwnerCompanies: { data: { shopOwnerCompanies: [company] } } }
const OK = { CompanyUpdate: { data: { companyUpdate: true } } }

/**
 * jsdom has no `window.confirm` worth calling — the real one throws `Not implemented` — so every test
 * that reaches the guard has to say what the owner answered. The spy is also what proves the question
 * was asked at all, which is the half a `location.pathname` assertion cannot tell apart from a route
 * that simply did not go anywhere.
 */
const respond = (response: boolean) => vi.spyOn(window, 'confirm').mockReturnValue(response)

const dirty = async () => {
	await userEvent.click(screen.getByRole('button', { name: 'Change Contact person' }))
	fireEvent.change(screen.getByLabelText('Contact person'), { target: { value: 'Anna White' } })
	await waitFor(() => {
		expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
	})
}

afterEach(() => {
	vi.restoreAllMocks()
})

/*
 * Nothing on this page is written until Save is pressed, so every edit lives in the browser and nowhere
 * else. A stray click on the breadcrumb throws away every box that was typed into, on however many
 * cards, with no undo — the values never reached the server, so there is nothing to re-read them from.
 */
describe('CompaniesPage — unsaved edits', () => {
	it('asks before leaving a page holding unsaved edits, and stays when the answer is no', async () => {
		stubGraphQL(list)
		const { router } = await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })
		await dirty()

		const confirm = respond(false)
		// ⚠️ Not awaited. A blocked `navigate()` never settles — the promise resolves when the navigation
		// completes, and this one never does — so awaiting it here is a five-second test timeout, not a
		// failed assertion. The `waitFor` below is what makes the test wait for the right thing.
		void router.navigate({ to: '/home' })

		// Spelled out rather than compared against the exported constant: asserting the constant against
		// itself passes whatever it holds, and this string is the whole of what the owner is told before an
		// edit is thrown away.
		await waitFor(() => {
			expect(confirm).toHaveBeenCalledWith('There are unsaved changes. Do you really want to leave the page?')
		})
		expect(DISCARD_WARNING).toBe('There are unsaved changes. Do you really want to leave the page?')
		expect(router.state.location.pathname).toBe(PAGE)
		// The edit is still there to go back to — a guard that held the navigation but dropped the form
		// state would be worse than no guard at all.
		expect(screen.getByLabelText('Contact person')).toHaveValue('Anna White')
	})

	it('leaves when the answer is yes', async () => {
		stubGraphQL(list)
		const { router } = await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })
		await dirty()

		const confirm = respond(true)
		await router.navigate({ to: '/home' })

		expect(confirm).toHaveBeenCalledWith(DISCARD_WARNING)
		expect(router.state.location.pathname).toBe('/home')
	})

	/*
	 * The question is the cost of the guard, and a page nobody touched must not pay it: an owner who came
	 * only to read has done nothing that leaving would lose.
	 *
	 * ⚠️ This is `disabled: !changed` and not a `shouldBlockFn` that answers false. The two look identical
	 * from here — nobody is asked either way — and differ on reload: the beforeunload listener is
	 * registered by the blocker's *presence*, so an installed blocker that merely declines makes the
	 * browser prompt on every refresh of a page with nothing to lose.
	 */
	it('says nothing when the page is untouched', async () => {
		stubGraphQL(list)
		const { router } = await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })

		const confirm = respond(false)
		await router.navigate({ to: '/home' })

		expect(confirm).not.toHaveBeenCalled()
		expect(router.state.location.pathname).toBe('/home')
	})

	// The guard follows the state rather than the mount: a save empties the dirty set, and the page it
	// leaves behind has nothing left to warn about.
	it('stops asking once the edits are saved', async () => {
		stubGraphQL({ ...list, ...OK })
		const { router } = await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })
		await dirty()
		await userEvent.click(screen.getByRole('button', { name: 'Save' }))
		await screen.findByText('Changes saved.')

		const confirm = respond(false)
		await router.navigate({ to: '/home' })

		expect(confirm).not.toHaveBeenCalled()
		expect(router.state.location.pathname).toBe('/home')
	})
})

/*
 * A save leaves the page looking the way it loaded: every row the owner opened is a value and a pen
 * again. Done by remounting the section on a counter the successful save bumps, because `EditableRow`
 * has no close of its own — a row that closed while react-hook-form still held its edited value would
 * show the server's value and save a different one.
 */
describe('CompaniesPage — after the save', () => {
	it('puts every row it opened back to read-only', async () => {
		stubGraphQL({ ...list, ...OK })
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })
		await dirty()

		expect(screen.queryByRole('button', { name: 'Change Contact person' })).not.toBeInTheDocument()

		await userEvent.click(screen.getByRole('button', { name: 'Save' }))

		// The pen is back, the editor is gone, and the row shows what the server has — not the value that
		// was typed into a form which no longer exists.
		expect(await screen.findByRole('button', { name: 'Change Contact person' })).toBeInTheDocument()
		expect(screen.queryByLabelText('Contact person')).not.toBeInTheDocument()
	})

	// A failed save must not remount anything: the counter is bumped only when every section answered yes,
	// and a page that closed its rows on a refusal would throw away the edits the owner still has to fix.
	it('keeps the rows open when the save fails', async () => {
		stubGraphQL({ ...list, CompanyUpdate: { data: { companyUpdate: false } } })
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })
		await dirty()
		await userEvent.click(screen.getByRole('button', { name: 'Save' }))

		expect(await screen.findByText('Save failed.')).toBeInTheDocument()
		expect(screen.getByLabelText('Contact person')).toHaveValue('Anna White')
	})
})

describe('CompaniesPage — the frame', () => {
	// The title and the trail come from the page, not from the section: `Companies` is an `<h1>` here and
	// an `<h2>` inside the feature, and the crumb pointing at the dashboard is the only way back out that
	// does not go through the sidebar.
	it('carries the page title and a trail back to the dashboard', async () => {
		stubGraphQL({ ShopOwnerCompanies: { data: { shopOwnerCompanies: [] } } })
		await renderRoute(PAGE)

		expect(screen.getByRole('heading', { name: 'Companies', level: 1 })).toBeInTheDocument()

		const trail = screen.getByRole('navigation', { name: 'Path' })
		expect(within(trail).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/home')
		// The last crumb is the page itself and carries no link — a breadcrumb pointing at where you already
		// are is noise.
		expect(within(trail).getAllByRole('link')).toHaveLength(1)
		expect(trail).toHaveTextContent('Companies')
	})

	it('renders', async () => {
		stubGraphQL({ ShopOwnerCompanies: { data: { shopOwnerCompanies: [] } } })
		await renderRoute(PAGE)

		expect(screen.getByRole('main')).toMatchSnapshot()
	})
})
