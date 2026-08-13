import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DISCARD_WARNING } from '@/features/saving'

import { stubGraphQL } from '../helpers/graphql'
import { renderRoute } from '../helpers/render'

const PAGE = '/items'

const ID_COMPANY = '65f0000000000000000000a1'
const ID_TOP = '65f0000000000000000000c1'

const shop = { __typename: 'GraphQLCompany', _id: ID_COMPANY, legalName: 'Rivers Trading Ltd' }

const item = {
	__typename: 'GraphQLItem',
	_id: '65f0000000000000000000b1',
	idCompany: ID_COMPANY,
	idCategory: ID_TOP,
	name: 'Blue enamel mug',
	description: 'Half a litre, dishwasher safe.',
	slug: 'blue-enamel-mug',
	published: true
}

const category = {
	__typename: 'GraphQLItemCategory',
	_id: ID_TOP,
	idParent: null,
	name: 'Homeware',
	slug: 'homeware',
	position: 1
}

const SHOPS = { ShopOwnerCompanies: { data: { shopOwnerCompanies: [shop] } } }

const LOADED = {
	...SHOPS,
	CompanyItems: { data: { companyItems: [item] } },
	ItemCategories: { data: { itemCategories: [category] } }
}

const OK = { ItemUpdate: { data: { itemUpdate: true } } }

const chooseShop = async () => {
	fireEvent.change(await screen.findByLabelText('Shop'), { target: { value: ID_COMPANY } })
}

/**
 * jsdom has no `window.confirm` worth calling — the real one throws `Not implemented` — so every test
 * that reaches the guard has to say what the owner answered. The spy is also what proves the question
 * was asked at all.
 */
const respond = (response: boolean) => vi.spyOn(window, 'confirm').mockReturnValue(response)

const dirty = async () => {
	await userEvent.click(screen.getByRole('button', { name: 'Change Description' }))
	fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Half a litre, enamelled steel.' } })
	await waitFor(() => {
		expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
	})
}

afterEach(() => {
	vi.restoreAllMocks()
})

/**
 * ⚠️ The chosen shop is page state and not a URL segment. `companyItems` takes an `idCompany`, so
 * `/items/$idCompany` would have worked — and it would have put an id a stranger can paste into the one
 * place this app has always kept free of them. The resolver refuses a shop the session does not hold
 * either way; what the URL decides is whether a wrong id is something an owner can be handed in a link.
 */
describe('ItemsPage — before a shop is chosen', () => {
	it('asks for one instead of showing an empty catalogue', async () => {
		const stub = stubGraphQL(SHOPS)
		await renderRoute(PAGE)

		expect(await screen.findByText('Select a shop to see its items.')).toBeInTheDocument()
		// No catalogue means nothing to save either: the button belongs to the cards, and there are none.
		expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
		// Neither read is sent for a shop nobody named. An unconfigured operation throws in the stub, so
		// this is asserted twice over — once here and once by the test not failing.
		expect(stub.calls.map((call) => call.operationName)).toEqual(['ShopOwnerCompanies'])
	})

	it('renders', async () => {
		stubGraphQL(SHOPS)
		await renderRoute(PAGE)

		await screen.findByText('Select a shop to see its items.')
		expect(screen.getByRole('main')).toMatchSnapshot()
	})
})

/*
 * Nothing on this page is written until Save is pressed, so every edit lives in the browser and nowhere
 * else. A stray click on the breadcrumb throws away every box that was typed into, on however many
 * cards, with no undo — the values never reached the server, so there is nothing to re-read them from.
 */
describe('ItemsPage — unsaved edits', () => {
	it('asks before leaving a page holding unsaved edits, and stays when the answer is no', async () => {
		stubGraphQL(LOADED)
		const { router } = await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })
		await dirty()

		const confirm = respond(false)
		// ⚠️ Not awaited. A blocked `navigate()` never settles — the promise resolves when the navigation
		// completes, and this one never does — so awaiting it here is a test timeout rather than a failed
		// assertion.
		void router.navigate({ to: '/home' })

		await waitFor(() => {
			expect(confirm).toHaveBeenCalledWith(DISCARD_WARNING)
		})
		expect(router.state.location.pathname).toBe(PAGE)
		// The edit is still there to go back to — a guard that held the navigation but dropped the form
		// state would be worse than no guard at all.
		expect(screen.getByLabelText('Description')).toHaveValue('Half a litre, enamelled steel.')
	})

	it('leaves when the answer is yes', async () => {
		stubGraphQL(LOADED)
		const { router } = await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })
		await dirty()

		const confirm = respond(true)
		await router.navigate({ to: '/home' })

		expect(confirm).toHaveBeenCalledWith(DISCARD_WARNING)
		expect(router.state.location.pathname).toBe('/home')
	})

	/*
	 * The question is the cost of the guard, and a page nobody touched must not pay it — an owner who came
	 * only to read has done nothing that leaving would lose. Choosing a shop is not an edit either: it
	 * loads a catalogue and writes nothing.
	 */
	it('says nothing when the page is untouched', async () => {
		stubGraphQL(LOADED)
		const { router } = await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })

		const confirm = respond(false)
		await router.navigate({ to: '/home' })

		expect(confirm).not.toHaveBeenCalled()
		expect(router.state.location.pathname).toBe('/home')
	})

	// The guard follows the state rather than the mount: a save empties the dirty set, and the page it
	// leaves behind has nothing left to warn about.
	it('stops asking once the edits are saved', async () => {
		stubGraphQL({ ...LOADED, ...OK })
		const { router } = await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })
		await dirty()
		await userEvent.click(screen.getByRole('button', { name: 'Save' }))
		await screen.findByText('Changes saved.')

		const confirm = respond(false)
		await router.navigate({ to: '/home' })

		expect(confirm).not.toHaveBeenCalled()
		expect(router.state.location.pathname).toBe('/home')
	})
})

/**
 * A save leaves the page looking the way it loaded: every row the owner opened is a value and a pen
 * again. Done by remounting the catalogue on a counter the successful save bumps, because `EditableRow`
 * has no close of its own — a row that closed while react-hook-form still held its edited value would
 * show the server's value and save a different one.
 */
describe('ItemsPage — after the save', () => {
	it('puts every row it opened back to read-only', async () => {
		stubGraphQL({ ...LOADED, ...OK })
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })
		await dirty()

		expect(screen.queryByRole('button', { name: 'Change Description' })).not.toBeInTheDocument()

		await userEvent.click(screen.getByRole('button', { name: 'Save' }))

		expect(await screen.findByRole('button', { name: 'Change Description' })).toBeInTheDocument()
		expect(screen.queryByLabelText('Description')).not.toBeInTheDocument()
	})

	/*
	 * ⚠️ The picker sits outside the remount key, and this is what says so. Inside it, every save would
	 * drop the chosen shop and send the owner back to "Select a shop to see its items." — a page emptied
	 * by the press that was meant to keep it.
	 */
	it('keeps the chosen shop', async () => {
		stubGraphQL({ ...LOADED, ...OK })
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })
		await dirty()
		await userEvent.click(screen.getByRole('button', { name: 'Save' }))

		await screen.findByText('Changes saved.')
		expect(screen.getByLabelText('Shop')).toHaveValue(ID_COMPANY)
		expect(screen.getByRole('heading', { name: item.name, level: 3 })).toBeInTheDocument()
		expect(screen.queryByText('Select a shop to see its items.')).not.toBeInTheDocument()
	})

	// A failed save must not remount anything: the counter is bumped only when every section answered yes,
	// and a page that closed its rows on a refusal would throw away the edits the owner still has to fix.
	it('keeps the rows open when the save fails', async () => {
		stubGraphQL({ ...LOADED, ItemUpdate: { data: { itemUpdate: false } } })
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })
		await dirty()
		await userEvent.click(screen.getByRole('button', { name: 'Save' }))

		expect(await screen.findByText('Save failed.')).toBeInTheDocument()
		expect(screen.getByLabelText('Description')).toHaveValue('Half a litre, enamelled steel.')
	})
})

describe('ItemsPage — the frame', () => {
	// The title and the trail come from the page, not from the section: `Items` is an `<h1>` here and an
	// `<h2>` inside the feature, and the crumb pointing at the dashboard is the only way back out that
	// does not go through the sidebar.
	it('carries the page title and a trail back to the dashboard', async () => {
		stubGraphQL(SHOPS)
		await renderRoute(PAGE)

		expect(screen.getByRole('heading', { name: 'Items', level: 1 })).toBeInTheDocument()

		const trail = screen.getByRole('navigation', { name: 'Path' })
		expect(within(trail).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/home')
		// The last crumb is the page itself and carries no link — a breadcrumb pointing at where you
		// already are is noise.
		expect(within(trail).getAllByRole('link')).toHaveLength(1)
		expect(trail).toHaveTextContent('Items')
	})
})
