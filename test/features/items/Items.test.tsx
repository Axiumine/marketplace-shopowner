import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { VALIDATION_HEADER } from '@/components/ui/ToastValidation'

import type { GraphQLStub } from '../../helpers/graphql'
import { graphQLError, stubGraphQL } from '../../helpers/graphql'
import { page } from '../../helpers/page'
import { renderRoute } from '../../helpers/render'

/**
 * ⚠️ No id in the URL here either, and this page is the one that could have had one: `companyItems`
 * takes an `idCompany`, so `/items/$idCompany` would work. The shop is page state instead — see the
 * note on `ItemsPage` — so the only place an id appears in this file is a variable set.
 */
const PAGE = '/items'

const ID_COMPANY = '65f0000000000000000000a1'
const ID_COMPANY_TWO = '65f0000000000000000000a2'
const ID_ITEM = '65f0000000000000000000b1'
const ID_ITEM_TWO = '65f0000000000000000000b2'
const ID_TOP = '65f0000000000000000000c1'
const ID_CHILD = '65f0000000000000000000c2'

/**
 * The picker reads two fields of a company and the page reads none, so the fixture carries two — the
 * whole document is what `/companies` is about, and asserting it again here would be that page's test
 * written twice.
 *
 * ⚠️ The `__typename` is load-bearing on the item fixtures below rather than on these: urql's document
 * cache invalidates by the typenames a cached *response* carries, and `additionalTypenames` on the item
 * writes can only match a response that names `GraphQLItem`.
 */
const shop = { __typename: 'GraphQLCompany', _id: ID_COMPANY, legalName: 'Rivers Trading Ltd' }
const shopTwo = { __typename: 'GraphQLCompany', _id: ID_COMPANY_TWO, legalName: 'White Trading Ltd' }

const item = {
	__typename: 'GraphQLItem',
	_id: ID_ITEM,
	idCompany: ID_COMPANY,
	idCategory: ID_CHILD,
	name: 'Blue enamel mug',
	description: 'Half a litre, dishwasher safe.',
	slug: 'blue-enamel-mug',
	published: true
}

/** A second item of the same shop — unpublished, which is the draft a catalogue page exists to finish. */
const itemTwo = {
	...item,
	_id: ID_ITEM_TWO,
	idCategory: ID_TOP,
	name: 'Garden trowel',
	description: 'Stainless steel, ash handle.',
	// Unique per company, which is the whole of what `itemAdd` and `itemUpdate` answer 409 about.
	slug: 'garden-trowel',
	published: false
}

const categoryTop = {
	__typename: 'GraphQLItemCategory',
	_id: ID_TOP,
	idParent: null,
	name: 'Homeware',
	slug: 'homeware',
	position: 1
}

const categoryChild = { ...categoryTop, _id: ID_CHILD, idParent: ID_TOP, name: 'Mugs', slug: 'mugs', position: 2 }

const shops = (list: unknown[]) => ({ ShopOwnerCompanies: { data: { shopOwnerCompanies: list } } })
const catalogue = (list: unknown[]) => ({ CompanyItems: { data: { companyItems: list } } })
const taxonomy = (list: unknown[]) => ({ ItemCategories: { data: { itemCategories: list } } })

/** The three reads a chosen shop produces, with one shop, one item and the two-level taxonomy. */
const LOADED = { ...shops([shop]), ...catalogue([item]), ...taxonomy([categoryTop, categoryChild]) }

const OK = { ItemUpdate: { data: { itemUpdate: true } } }
/**
 * ⚠️ An object with an `_id`, not `true`. `itemAdd` answers `OnlyIdType`, as `companyAdd` does on this
 * tier — the call site tests the field rather than the object, so it stays honest if it ever goes
 * nullable.
 */
const OK_ADD = { ItemAdd: { data: { itemAdd: { _id: '65f0000000000000000000b9' } } } }
const OK_DEL = { ItemDel: { data: { itemDel: true } } }

const NEW = 'New item'

/** The shop select, which is the only control on the page before a catalogue is on screen. */
const shopPicker = () => screen.getByLabelText('Shop')

const chooseShop = async (id = ID_COMPANY) => {
	fireEvent.change(await screen.findByLabelText('Shop'), { target: { value: id } })
}

/**
 * One item's block, by the heading — which is the item's *stored* name, and the only thing that tells
 * two cards apart.
 *
 * `closest('section')`, not `parentElement`: the heading shares a flex row with the trash icon.
 */
const card = (name = item.name) =>
	within(screen.getByRole('heading', { name: name, level: 3 }).closest('section') as HTMLElement)

const box = (name?: string) => within(card(name).getByRole('region', { name: 'Item data' }))

/** The right-hand half of an `EditableRow` while it is closed. */
const rowValue = (label: string, name?: string): string => {
	const row = box(name).getByText(label, { selector: 'span' }).parentElement as HTMLElement
	return row.lastElementChild?.textContent ?? ''
}

const open = async (label: string, name?: string) => {
	await userEvent.click(box(name).getByRole('button', { name: `Change ${label}` }))
}

/** `fireEvent.change`, never `userEvent.type`: every text box on this form carries a `maxLength`. */
const write = (label: string, value: string, name?: string) => {
	fireEvent.change(box(name).getByLabelText(label), { target: { value: value } })
}

const save = () => screen.getByRole('button', { name: 'Save' })

const plus = () => screen.getByRole('button', { name: 'Add item' })

/** The overlay a queued deletion draws over an item's fields, or `null` when there is none. */
const mask = () => screen.queryByText('It will be withdrawn on save.')?.parentElement ?? null

const adds = (stub: GraphQLStub) => stub.calls.filter((call) => call.operationName === 'ItemAdd')
const writes = (stub: GraphQLStub) => stub.calls.filter((call) => call.operationName === 'ItemUpdate')
const deletes = (stub: GraphQLStub) => stub.calls.filter((call) => call.operationName === 'ItemDel')

/** Every request sent for one operation — a refetch is counted here, not read off the screen. */
const reads = (stub: GraphQLStub, name: string) => stub.calls.filter((call) => call.operationName === name)

/** The stored item as both writes send it back: the parsed fields, plus the shop the list was drawn in. */
const SENT = {
	idCompany: ID_COMPANY,
	idCategory: ID_CHILD,
	name: 'Blue enamel mug',
	description: 'Half a litre, dishwasher safe.',
	slug: 'blue-enamel-mug',
	published: true
}

/**
 * Which shop's catalogue is on screen — the one place in this app where the browser names something
 * instead of letting the session name it.
 */
describe('Items — the shop picker', () => {
	it('waits before offering a choice', async () => {
		stubGraphQL({ ShopOwnerCompanies: { pending: true } })
		await renderRoute(PAGE)

		expect(screen.getByText('Loading shops')).toBeInTheDocument()
		expect(screen.queryByLabelText('Shop')).not.toBeInTheDocument()
	})

	it('reports a failed read instead of an empty list of shops', async () => {
		stubGraphQL({
			ShopOwnerCompanies: { errors: [graphQLError('Server error', 'Companies unavailable', 500)], status: 500 }
		})
		await renderRoute(PAGE)

		expect(await screen.findByRole('alert')).toHaveTextContent('Companies unavailable')
		expect(screen.queryByLabelText('Shop')).not.toBeInTheDocument()
		// The page frame is still there: the picker failed, the route did not.
		expect(screen.getByRole('heading', { name: 'Items', level: 1 })).toBeInTheDocument()
	})

	/*
	 * An owner with no company has nothing an item could be filed into either — `itemAdd` takes an
	 * `idCompany` and there is none — so the answer is where that starts, not an empty dropdown.
	 */
	it('sends an owner with no company to register one first', async () => {
		stubGraphQL(shops([]))
		await renderRoute(PAGE)

		expect(await screen.findByRole('status')).toHaveTextContent(
			'Register a company first — an item belongs to one of your shops.'
		)
		expect(screen.queryByLabelText('Shop')).not.toBeInTheDocument()
	})

	/*
	 * `data: null` with no error beside it — the query resolved and answered nothing, which is the shape a
	 * partial GraphQL response has and the one the `?? []` behind this picker exists for. The answer is the
	 * same as for an owner with no company: a picker offering an option built from nothing would be worse
	 * than none, and it would be pointed at a shop id that does not exist.
	 */
	it('says the same when the query resolves with no data at all', async () => {
		stubGraphQL({ ShopOwnerCompanies: { data: null } })
		await renderRoute(PAGE)

		expect(await screen.findByRole('status')).toHaveTextContent(
			'Register a company first — an item belongs to one of your shops.'
		)
		expect(screen.queryByLabelText('Shop')).not.toBeInTheDocument()
	})

	// The placeholder is an option of its own, and it is what the page opens on: a select that started on
	// the first shop would load a catalogue the owner never asked for.
	it('offers every shop of the owner, under a placeholder', async () => {
		stubGraphQL(shops([shop, shopTwo]))
		await renderRoute(PAGE)

		const options = within(await screen.findByLabelText('Shop')).getAllByRole('option')
		expect(options.map((option) => option.textContent)).toEqual(['Select a shop', 'Rivers Trading Ltd', 'White Trading Ltd'])
		expect(shopPicker()).toHaveValue('')
	})

	// The shop is state and the URL is not: choosing one loads a catalogue and leaves the address bar
	// exactly where it was.
	it('leaves the chosen shop out of the URL', async () => {
		stubGraphQL(LOADED)
		const { router } = await renderRoute(PAGE)
		await chooseShop()

		expect(await screen.findByRole('heading', { name: item.name, level: 3 })).toBeInTheDocument()
		expect(router.state.location.pathname).toBe(PAGE)
		expect(router.state.location.search).toEqual({})
	})

	/*
	 * ⚠️ Locked while anything on the page is dirty, and the discard guard cannot do this job: `useBlocker`
	 * sees navigations, and switching shop is a `useState` on a page that never moves. Every card would be
	 * replaced at once, with no question asked and no undo.
	 */
	it('locks the choice while the page holds unsaved edits, and says why', async () => {
		stubGraphQL(LOADED)
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })

		expect(shopPicker()).toBeEnabled()
		expect(screen.queryByText('Save or leave the page before changing shop.')).not.toBeInTheDocument()

		await open('Name')
		write('Name', 'Blue enamel mug, large')

		await waitFor(() => {
			expect(shopPicker()).toBeDisabled()
		})
		expect(screen.getByText('Save or leave the page before changing shop.')).toBeInTheDocument()
	})

	// A different shop is a different set of cards, and the ones on screen are not reused: an open editor
	// carried across would be one shop's typing on another shop's item.
	it('replaces the catalogue when the shop changes', async () => {
		const stub = stubGraphQL({
			...shops([shop, shopTwo]),
			...taxonomy([categoryTop, categoryChild]),
			CompanyItems: [{ data: { companyItems: [item] } }, { data: { companyItems: [itemTwo] } }]
		})
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })

		await chooseShop(ID_COMPANY_TWO)

		expect(await screen.findByRole('heading', { name: itemTwo.name, level: 3 })).toBeInTheDocument()
		expect(screen.queryByRole('heading', { name: item.name, level: 3 })).toBeNull()
		expect(reads(stub, 'CompanyItems').map((call) => call.variables)).toEqual([
			{ idCompany: ID_COMPANY },
			{ idCompany: ID_COMPANY_TWO }
		])
	})
})

/**
 * ⚠️ The catalogue itself. `idCompany` is the one variable this app ever sends and it is not a tenant
 * boundary: the resolver runs `throwIfShopOwnerDontOwnCompany` before it reads anything, so an id
 * belonging to someone else answers 403 rather than a list. Nothing here enforces it, and nothing here
 * should try to.
 */
describe('Items — the catalogue', () => {
	it('waits before claiming the shop is empty', async () => {
		stubGraphQL({ ...shops([shop]), CompanyItems: { pending: true }, ...taxonomy([categoryTop]) })
		await renderRoute(PAGE)
		await chooseShop()

		expect(await screen.findByText('Loading items')).toBeInTheDocument()
		expect(screen.queryByText('No item in this shop.')).not.toBeInTheDocument()
	})

	// The taxonomy is the other half of the wait: cards drawn before it arrives would offer an empty
	// picker and read every stored category as retired.
	it('waits for the taxonomy as well as for the items', async () => {
		stubGraphQL({ ...shops([shop]), ...catalogue([item]), ItemCategories: { pending: true } })
		await renderRoute(PAGE)
		await chooseShop()

		expect(await screen.findByText('Loading items')).toBeInTheDocument()
		expect(screen.queryByRole('heading', { name: item.name, level: 3 })).toBeNull()
	})

	it('says so when the shop has no item', async () => {
		stubGraphQL({ ...shops([shop]), ...catalogue([]), ...taxonomy([categoryTop]) })
		await renderRoute(PAGE)
		await chooseShop()

		expect(await screen.findByText('No item in this shop.')).toBeInTheDocument()
	})

	/*
	 * `data: null` with no error beside it: the query resolved and answered with nothing, which is a shape
	 * the wire allows and urql passes straight through. Read as the empty list it is — anything else puts a
	 * card on screen for an item that does not exist.
	 */
	it('says so when the query resolves with no data at all', async () => {
		stubGraphQL({ ...shops([shop]), CompanyItems: { data: null }, ...taxonomy([categoryTop]) })
		await renderRoute(PAGE)
		await chooseShop()

		expect(await screen.findByText('No item in this shop.')).toBeInTheDocument()
	})

	// "None" is a statement about the catalogue, and a failed read knows nothing about it: an owner with
	// thirty items would be told the shop is empty, which reads as data loss rather than as an error.
	it('reports a failed items read without claiming the shop is empty', async () => {
		stubGraphQL({
			...shops([shop]),
			CompanyItems: { errors: [graphQLError('Server error', 'Items unavailable', 500)], status: 500 },
			...taxonomy([categoryTop])
		})
		await renderRoute(PAGE)
		await chooseShop()

		expect(await screen.findByRole('alert')).toHaveTextContent('Items unavailable')
		expect(screen.queryByText('No item in this shop.')).not.toBeInTheDocument()
	})

	// One failure line for two queries: either one missing leaves a page that cannot save anything, so a
	// taxonomy that failed is reported even though the items arrived.
	it('reports a failed taxonomy read', async () => {
		stubGraphQL({
			...shops([shop]),
			...catalogue([item]),
			ItemCategories: { errors: [graphQLError('Server error', 'Categories unavailable', 500)], status: 500 }
		})
		await renderRoute(PAGE)
		await chooseShop()

		expect(await screen.findByRole('alert')).toHaveTextContent('Categories unavailable')
		expect(screen.queryByRole('heading', { name: item.name, level: 3 })).toBeNull()
	})

	/*
	 * ⚠️ A taxonomy nobody has filled in yet, which is a state only the Admin tier can leave this page in.
	 * `itemAdd` refuses a category that does not exist, so a card opened here could never be saved — the
	 * plus is dead and the reason is on screen rather than under it.
	 */
	it('refuses to open a card while the taxonomy is empty', async () => {
		stubGraphQL({ ...shops([shop]), ...catalogue([]), ...taxonomy([]) })
		await renderRoute(PAGE)
		await chooseShop()

		// By text rather than by role: `Spinner` is a `role="status"` too, so the first status on the page
		// while the taxonomy is still in flight is the spinner and not this.
		expect(
			await screen.findByText('No category exists yet. An operator has to fill in the taxonomy before an item can be filed.')
		).toBeInTheDocument()
		expect(plus()).toBeDisabled()
		expect(screen.queryByText('No item in this shop.')).not.toBeInTheDocument()
	})

	/*
	 * The same refusal for a taxonomy read that resolved with nothing at all rather than with an empty
	 * list. The distinction matters here and not on the items query: `options` is computed *above* the
	 * fetching branch, because the plus is drawn outside it, so an `?? []` that let anything through
	 * would arm the one button that must not be armed.
	 */
	it('refuses to open a card when the taxonomy resolves with no data at all', async () => {
		stubGraphQL({ ...shops([shop]), ...catalogue([]), ItemCategories: { data: null } })
		await renderRoute(PAGE)
		await chooseShop()

		expect(
			await screen.findByText('No category exists yet. An operator has to fill in the taxonomy before an item can be filed.')
		).toBeInTheDocument()
		expect(plus()).toBeDisabled()
	})

	it('names the shop it is asking about, and nothing else', async () => {
		const stub = stubGraphQL(LOADED)
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })

		expect(reads(stub, 'CompanyItems')[0]?.variables).toEqual({ idCompany: ID_COMPANY })
		// The taxonomy is the platform's, not the shop's: a shop id here would ask for a per-owner
		// taxonomy, which is the one thing a shared one must never become.
		expect(reads(stub, 'ItemCategories')[0]?.variables).toEqual({})
	})

	it('shows every field the collection holds', async () => {
		stubGraphQL(LOADED)
		await renderRoute(PAGE)
		await chooseShop()

		expect(await screen.findByRole('heading', { name: item.name, level: 3 })).toBeInTheDocument()
		expect(rowValue('Name')).toBe('Blue enamel mug')
		expect(rowValue('Description')).toBe('Half a litre, dishwasher safe.')
		expect(rowValue('Slug')).toBe('blue-enamel-mug')
		// The label the picker offers, not the stored id: an owner has never seen an ObjectId and could not
		// tell two apart.
		expect(rowValue('Category')).toBe('Homeware / Mugs')
		expect(rowValue('Published')).toBe('Yes')
	})

	// ⚠️ There is no price row and none is missing: `item` carries no `price`, because cart, order,
	// delivery and payment have no model anywhere on this platform.
	it('has no price to show', async () => {
		stubGraphQL(LOADED)
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })

		expect(box().queryByText('Price')).toBeNull()
	})

	it('renders every item of the shop, drafts included', async () => {
		stubGraphQL({ ...shops([shop]), ...catalogue([item, itemTwo]), ...taxonomy([categoryTop, categoryChild]) })
		await renderRoute(PAGE)
		await chooseShop()

		expect(await screen.findByRole('heading', { name: item.name, level: 3 })).toBeInTheDocument()
		expect(screen.getByRole('heading', { name: itemTwo.name, level: 3 })).toBeInTheDocument()
		// A draft is exactly what the owner opened this page to finish, so it is on the list and says so.
		expect(rowValue('Published', itemTwo.name)).toBe('No')
		expect(rowValue('Category', itemTwo.name)).toBe('Homeware')
	})

	/*
	 * ⚠️ A category retired under the owner. The row shows the placeholder rather than a stale name, and
	 * the editor opens on the empty option — so the schema refuses the save until a category is chosen,
	 * instead of silently re-filing the item under whichever option happens to be first.
	 */
	it('shows the placeholder for an item whose category is gone', async () => {
		stubGraphQL({
			...shops([shop]),
			...catalogue([{ ...item, idCategory: '65f0000000000000000000c9' }]),
			...taxonomy([categoryTop, categoryChild])
		})
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })

		expect(rowValue('Category')).toBe('---')

		await open('Category')

		expect(box().getByLabelText('Category')).toHaveValue('')
	})

	it('renders', async () => {
		stubGraphQL(LOADED)
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })
		expect(screen.getByRole('main')).toMatchSnapshot()
	})
})

/**
 * An item edited in place: one form, one Save, one `$set`.
 *
 * ⚠️ Every write sends `idCompany`, and on this mutation that is a *transfer instruction*: `itemUpdate`
 * reads the shop out of the input and moves the item to it. The card sends the shop whose list it was
 * drawn in, which for a stored item is the shop it is already in — wiring the picker to that field would
 * make every save of an open card a move.
 */
describe('Items — editing', () => {
	const editBothNames = async () => {
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: itemTwo.name, level: 3 })
		await open('Name')
		write('Name', 'Blue enamel mug, large')
		await open('Name', itemTwo.name)
		write('Name', 'Garden trowel, wide', itemTwo.name)
		await userEvent.click(save())
	}

	it('turns a row into its editor, seeded with the stored value', async () => {
		stubGraphQL(LOADED)
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })
		await open('Description')

		expect(box().getByLabelText('Description')).toHaveValue('Half a litre, dishwasher safe.')
		expect(save()).toBeDisabled()
	})

	// The heading follows the stored name rather than the box: it is what tells two cards apart, and a
	// heading that followed the keystrokes would rename the card the owner is still deciding about.
	it('leaves the heading on the stored name while the box is edited', async () => {
		stubGraphQL(LOADED)
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })
		await open('Name')
		write('Name', 'Blue enamel mug, large')

		expect(screen.getByRole('heading', { name: item.name, level: 3 })).toBeInTheDocument()
		expect(screen.queryByRole('heading', { name: 'Blue enamel mug, large', level: 3 })).toBeNull()
	})

	it('sends the whole item, with the shop of the list it was drawn in', async () => {
		const stub = stubGraphQL({ ...LOADED, ...OK })
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })
		await open('Description')
		write('Description', 'Half a litre, enamelled steel.')
		await userEvent.click(save())

		expect(await screen.findByText('Changes saved.')).toBeInTheDocument()
		expect(writes(stub)).toEqual([
			expect.objectContaining({
				variables: { _id: ID_ITEM, item: { ...SENT, description: 'Half a litre, enamelled steel.' } }
			})
		])
	})

	// The picker writes the id, and the two levels are one flat list of options: a subcategory is chosen
	// the same way a top-level category is.
	it('re-files the item under the category that was picked', async () => {
		const stub = stubGraphQL({ ...LOADED, ...OK })
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })
		await open('Category')
		fireEvent.change(box().getByLabelText('Category'), { target: { value: ID_TOP } })
		await userEvent.click(save())

		await screen.findByText('Changes saved.')
		expect(writes(stub)[0]?.variables).toMatchObject({ item: { idCategory: ID_TOP } })
	})

	// `published` travels in the same `$set` as everything else, which is why it is a checkbox inside the
	// card rather than a control of its own.
	it('withdraws an item from the public site through its own checkbox', async () => {
		const stub = stubGraphQL({ ...LOADED, ...OK })
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })
		await open('Published')
		await userEvent.click(box().getByLabelText('Published'))
		await userEvent.click(save())

		await screen.findByText('Changes saved.')
		expect(writes(stub)[0]?.variables).toMatchObject({ item: { published: false } })
	})

	/*
	 * ⚠️ The save context names `GraphQLItem` and nothing else, so the refresh rests entirely on the cached
	 * items response carrying that typename — `itemUpdate` answers a bare `Boolean` and mentions none.
	 *
	 * Counted as requests rather than read off the screen: the page remounts its sections after a save and
	 * a remount re-executes the query, off the cache and silently, unless the mutation invalidated it.
	 */
	it('refetches the items after a rename', async () => {
		const stub = stubGraphQL({ ...LOADED, ...OK })
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })

		expect(reads(stub, 'CompanyItems')).toHaveLength(1)

		await open('Name')
		write('Name', 'Blue enamel mug, large')
		await userEvent.click(save())

		await screen.findByText('Changes saved.')
		await waitFor(() => {
			expect(reads(stub, 'CompanyItems')).toHaveLength(2)
		})
		// The taxonomy is not invalidated by anything this app can do — it is the Admin tier's, and a
		// refetch of it on every save would be a request per press for a list that cannot have changed.
		expect(reads(stub, 'ItemCategories')).toHaveLength(1)
	})

	/*
	 * An item nobody touched is not merely nothing to send — it must not be *validated* either, or a
	 * stored item the current rules would reject blocks a save the owner made on a different card. A slug
	 * stored before the shape was enforced is what such an item looks like.
	 */
	it('leaves an untouched item alone while another is saved', async () => {
		const stub = stubGraphQL({
			...shops([shop]),
			...catalogue([{ ...item, slug: 'Blue_Enamel_Mug' }, itemTwo]),
			...taxonomy([categoryTop, categoryChild]),
			...OK
		})
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: itemTwo.name, level: 3 })
		await open('Name', itemTwo.name)
		write('Name', 'Garden trowel, wide', itemTwo.name)
		await userEvent.click(save())

		await screen.findByText('Changes saved.')
		expect(writes(stub)).toHaveLength(1)
		expect(writes(stub)[0]?.variables).toMatchObject({ _id: ID_ITEM_TWO })
		expect(screen.queryByText('The slug is lowercase letters and digits, joined by single hyphens')).not.toBeInTheDocument()
	})

	// One item refusing must not swallow the other's edit, which is why each card is its own section.
	it('stops at the item that was refused', async () => {
		const stub = stubGraphQL({
			...shops([shop]),
			...catalogue([item, itemTwo]),
			...taxonomy([categoryTop, categoryChild]),
			ItemUpdate: { errors: [graphQLError('Server error', 'Slug already used in this shop', 409)], status: 409 }
		})
		await editBothNames()

		expect(await screen.findByRole('alert')).toHaveTextContent('Slug already used in this shop')
		expect(writes(stub)).toHaveLength(1)
		expect(save()).toBeEnabled()
	})

	/*
	 * The card's toast belongs to the card, and a save that fixed it has to take it down.
	 *
	 * ⚠️ Not something the page's remount does for it: the remount only happens when *every* section
	 * succeeded, so the interesting case is exactly this one — the first item is written on the second
	 * press while the second is refused, nothing remounts, and the first card's old refusal would still be
	 * on screen next to the new one.
	 */
	it('clears its own refusal when the retry goes through', async () => {
		stubGraphQL({
			...shops([shop]),
			...catalogue([item, itemTwo]),
			...taxonomy([categoryTop, categoryChild]),
			ItemUpdate: [
				{ errors: [graphQLError('Server error', 'Slug already used in this shop', 409)], status: 409 },
				{ data: { itemUpdate: true } },
				{ errors: [graphQLError('Server error', 'Category no longer exists', 404)], status: 404 }
			]
		})
		await editBothNames()

		expect(await screen.findByText('Slug already used in this shop')).toBeInTheDocument()

		await userEvent.click(save())

		expect(await screen.findByText('Category no longer exists')).toBeInTheDocument()
		expect(screen.queryByText('Slug already used in this shop')).not.toBeInTheDocument()
	})

	// `false` with no error at all: no resolver answers that way, but `Boolean!` says it could, and a save
	// reported as successful would be worse than a generic line.
	it('reports a bare refusal', async () => {
		stubGraphQL({ ...LOADED, ItemUpdate: { data: { itemUpdate: false } } })
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })
		await open('Name')
		write('Name', 'Blue enamel mug, large')
		await userEvent.click(save())

		expect(await screen.findByRole('alert')).toHaveTextContent('Save failed.')
		expect(screen.queryByText('Changes saved.')).not.toBeInTheDocument()
	})

	/*
	 * The whitespace is the point: the schema trims before it validates, so a required box holding three
	 * spaces is empty — and the parsed value is what reaches the wire, so it cannot be padded either.
	 */
	it.each([
		['Name', '   ', 'Name is required'],
		['Description', '   ', 'Description is required'],
		['Slug', '   ', 'The slug is at least 2 characters'],
		['Slug', 'Blue Enamel Mug', 'The slug is lowercase letters and digits, joined by single hyphens'],
		['Name', 'x'.repeat(151), 'Name cannot exceed 150 characters']
	])('refuses %s holding %s', async (field, value, message) => {
		const stub = stubGraphQL({ ...LOADED, ...OK })
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })
		await open(field)
		write(field, value)
		await userEvent.click(save())

		expect(await page().findByText(message)).toBeInTheDocument()
		expect(writes(stub)).toEqual([])
	})

	/*
	 * The retired category, from the owner's side: the card cannot be saved until one is chosen.
	 *
	 * ⚠️ Read off the toast rather than off the card, and that is the case the toast exists for — the
	 * Category row is closed, so there is no box on screen for the message to sit under, and the owner
	 * would otherwise be looking at a refused save with nothing on the page saying why.
	 */
	it('refuses to save an item back under no category at all', async () => {
		const stub = stubGraphQL({
			...shops([shop]),
			...catalogue([{ ...item, idCategory: '65f0000000000000000000c9' }]),
			...taxonomy([categoryTop, categoryChild]),
			...OK
		})
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })
		await open('Name')
		write('Name', 'Blue enamel mug, large')
		await userEvent.click(save())

		expect(await screen.findByRole('alert')).toHaveTextContent('Category is required')
		expect(writes(stub)).toEqual([])
	})
})

/**
 * A withdrawal, queued rather than written on the spot and masked while it is: everything on this page
 * waits for the one Save button, and a trash icon that wrote immediately would be the only control here
 * that did not.
 */
describe('Items — deletion', () => {
	const trash = (name?: string) => card(name).getByRole('button', { name: 'Delete item' })

	it('queues the deletion behind the mask instead of writing it', async () => {
		const stub = stubGraphQL({ ...LOADED, ...OK_DEL })
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })

		expect(mask()).toBeNull()

		await userEvent.click(trash())

		expect(mask()).toHaveClass('backdrop-blur-sm')
		expect(deletes(stub)).toEqual([])
		expect(save()).toBeEnabled()
	})

	// The one way back out, and the reason the title row stays sharp: the trash the owner has to press
	// again is the only control the mask must not cover.
	it('takes the deletion back', async () => {
		stubGraphQL(LOADED)
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })
		await userEvent.click(trash())
		await userEvent.click(card().getByRole('button', { name: 'Cancel item deletion' }))

		expect(mask()).toBeNull()
		expect(save()).toBeDisabled()
	})

	// The heading is the one part of the card the mask does not cover, so it is the only place the queued
	// state can be read at all.
	it('strikes the name through while the deletion is queued', async () => {
		stubGraphQL(LOADED)
		await renderRoute(PAGE)
		await chooseShop()

		const title = await screen.findByRole('heading', { name: item.name, level: 3 })

		// The whole class list, not just the absence of `line-through`: the queued state is expressed by
		// what the ternary adds, so its empty alternative is as much a part of the rule as the struck one.
		expect(title.className.trim()).toBe('text-lg font-bold')

		await userEvent.click(trash())

		expect(title).toHaveClass('text-tip', 'line-through')
	})

	it('withdraws the item on Save', async () => {
		const stub = stubGraphQL({ ...LOADED, ...OK_DEL })
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })
		await userEvent.click(trash())
		await userEvent.click(save())

		await waitFor(() => {
			expect(deletes(stub)).toHaveLength(1)
		})
		expect(deletes(stub)[0]?.variables).toEqual({ _id: ID_ITEM })
		expect(writes(stub)).toEqual([])
		expect(await screen.findByText('Changes saved.')).toBeInTheDocument()
		expect(screen.queryByRole('alert')).toBeNull()
	})

	// Deletion wins over an edit made in the same press — asserted with both queued at once, because
	// "nothing was written" is otherwise indistinguishable from "nothing was edited".
	it('does not write the fields of a card it is about to withdraw', async () => {
		const stub = stubGraphQL({ ...LOADED, ...OK, ...OK_DEL })
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })
		await open('Name')
		write('Name', 'Blue enamel mug, large')
		await userEvent.click(trash())
		await userEvent.click(save())

		await waitFor(() => {
			expect(deletes(stub)).toHaveLength(1)
		})
		expect(writes(stub)).toEqual([])
	})

	it('reports a bare refusal', async () => {
		stubGraphQL({ ...LOADED, ItemDel: { data: { itemDel: false } } })
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })
		await userEvent.click(trash())
		await userEvent.click(save())

		expect(await screen.findByRole('alert')).toHaveTextContent('Deletion failed.')
	})

	/*
	 * The 403 a second withdrawal answers with — `funItemDel` refuses an item already carrying `deleted`,
	 * which is what two tabs on the same catalogue produce. The toast is outside the mask for exactly
	 * this: the owner has to read why while the card is still queued.
	 */
	it('surfaces the server message and leaves the card queued', async () => {
		stubGraphQL({
			...LOADED,
			ItemDel: { errors: [graphQLError('Forbidden', 'Item not found in this company', 403)], status: 403 }
		})
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })
		await userEvent.click(trash())
		await userEvent.click(save())

		expect(await screen.findByRole('alert')).toHaveTextContent('Item not found in this company')
		expect(mask()).not.toBeNull()
		expect(mask()).not.toContainElement(card().getByRole('button', { name: 'Cancel item deletion' }))
	})
})

/**
 * An item the owner is adding: the same fields as the card above it, driven by the same schema and the
 * same Save button, and sent to `itemAdd` with the shop whose catalogue is on screen.
 */
describe('Items — new item', () => {
	const newCard = () => screen.getByRole('heading', { name: NEW, level: 3 }).closest('section') as HTMLElement

	/** Both of them, in the order they were opened — two cards share one heading, so `card()` cannot. */
	const newCards = () =>
		screen.getAllByRole('heading', { name: NEW, level: 3 }).map((title) => title.closest('section') as HTMLElement)

	const add = async () => {
		await userEvent.click(plus())
	}

	/** A card filled the way an owner would: four boxes typed and a category picked. */
	const fill = () => {
		write('Name', 'Garden trowel', NEW)
		write('Description', 'Stainless steel, ash handle.', NEW)
		write('Slug', 'garden-trowel', NEW)
		fireEvent.change(box(NEW).getByLabelText('Category'), { target: { value: ID_TOP } })
	}

	/**
	 * One press carrying two sections: an edit to the item that exists, and a filled new card behind it.
	 * The order is the point — the stored item is written first, so what the stub answers to the *add* is
	 * what each test using this is asking about.
	 */
	const editAndAdd = async () => {
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })
		await add()
		await open('Description')
		write('Description', 'Half a litre, enamelled steel.')
		fill()
		await userEvent.click(save())
	}

	/*
	 * "No item in this shop." is about the catalogue, and an open card is the answer to it — the two on
	 * screen together would be the page contradicting itself.
	 *
	 * The card counts as a pending change from the moment it appears, before a character is typed: it is
	 * an item the owner asked for and the page has not written.
	 */
	it('replaces the empty-list message with a card, already worth saving', async () => {
		stubGraphQL({ ...shops([shop]), ...catalogue([]), ...taxonomy([categoryTop, categoryChild]) })
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByText('No item in this shop.')
		expect(save()).toBeDisabled()

		await add()

		expect(screen.getByRole('heading', { name: NEW, level: 3 })).toBeInTheDocument()
		expect(screen.queryByText('No item in this shop.')).not.toBeInTheDocument()
		expect(save()).toBeEnabled()
	})

	// New cards go under the items that exist: the list is the record, and what is being added to it does
	// not push the record down the page.
	it('adds the card below the items already stored', async () => {
		stubGraphQL(LOADED)
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })
		await add()

		// Filtered, because `Infobox` titles are `h3` too — every card contributes one of them.
		const titles = screen
			.getAllByRole('heading', { level: 3 })
			.map((title) => title.textContent)
			.filter((text) => text === item.name || text === NEW)
		expect(titles).toEqual([item.name, NEW])
	})

	// Every row opens on its editor, because there is no stored value for a closed row to show — a card of
	// dashes with a pen beside each would read as a rendering bug.
	it('opens every row of the card on its editor', async () => {
		stubGraphQL({ ...shops([shop]), ...catalogue([]), ...taxonomy([categoryTop, categoryChild]) })
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByText('No item in this shop.')
		await add()

		expect(box(NEW).getByLabelText('Name')).toHaveValue('')
		expect(box(NEW).getByLabelText('Description')).toHaveValue('')
		expect(box(NEW).getByLabelText('Slug')).toHaveValue('')
		// The placeholder, and a draft: neither default can publish something by accident.
		expect(box(NEW).getByLabelText('Category')).toHaveValue('')
		expect(box(NEW).getByLabelText('Published')).not.toBeChecked()
		// No pen anywhere on the card: a row that is already open has nothing to open.
		expect(within(newCard()).queryByRole('button', { name: 'Change Name' })).toBeNull()
	})

	// The one icon it carries, and it is not a delete: there is nothing stored to withdraw. It is also the
	// only way out of the leave guard the card arms the moment it appears.
	it('throws the card away when its trash is pressed', async () => {
		stubGraphQL({ ...shops([shop]), ...catalogue([]), ...taxonomy([categoryTop, categoryChild]) })
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByText('No item in this shop.')
		await add()
		await userEvent.click(within(newCard()).getByRole('button', { name: 'Cancel new item' }))

		expect(screen.queryByRole('heading', { name: NEW, level: 3 })).toBeNull()
		expect(screen.getByText('No item in this shop.')).toBeInTheDocument()
		expect(save()).toBeDisabled()
	})

	/*
	 * ⚠️ Each card is keyed by a uuid of its own, and this is what says so. Keyed by position instead,
	 * discarding the first of two would hand its React state — an empty form — to the second, and the
	 * typing would vanish from a card the owner never touched.
	 */
	it("keeps a second card's contents when the first is discarded", async () => {
		stubGraphQL({ ...shops([shop]), ...catalogue([]), ...taxonomy([categoryTop, categoryChild]) })
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByText('No item in this shop.')
		await add()
		await add()

		fireEvent.change(within(newCards()[1] as HTMLElement).getByLabelText('Name'), { target: { value: 'Garden trowel' } })
		await userEvent.click(within(newCards()[0] as HTMLElement).getByRole('button', { name: 'Cancel new item' }))

		expect(newCards()).toHaveLength(1)
		expect(within(newCards()[0] as HTMLElement).getByLabelText('Name')).toHaveValue('Garden trowel')
	})

	/*
	 * ⚠️ The card is seeded with an empty string per field rather than with nothing at all: react-hook-form
	 * hands the schema whatever it was given, and `''` fails the rule the form wrote under the box it
	 * belongs to — `undefined` fails zod's type check instead, with "expected string, received undefined"
	 * shown to an owner.
	 */
	it("refuses an untouched card in this form's own words", async () => {
		const stub = stubGraphQL({ ...shops([shop]), ...catalogue([]), ...taxonomy([categoryTop]), ...OK_ADD })
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByText('No item in this shop.')
		await add()
		await userEvent.click(save())

		expect(await page().findByText('Name is required')).toBeInTheDocument()
		expect(page().getByText('Description is required')).toBeInTheDocument()
		expect(page().getByText('The slug is at least 2 characters')).toBeInTheDocument()
		expect(page().getByText('Category is required')).toBeInTheDocument()
		expect(adds(stub)).toEqual([])
		expect(screen.queryByText('Changes saved.')).not.toBeInTheDocument()
	})

	/*
	 * The same refusal as the owner sees it: the boxes turn red and the toast in the corner lists the same
	 * sentences they carry — the Save button is below however many cards, and the box that refused may
	 * well be scrolled off the top of the page.
	 *
	 * ⚠️ Read through `within(warning)` and not `page()`: each sentence is on screen twice, and the toast
	 * stack is portalled to `document.body`, outside `main`.
	 */
	it('lists what has to be corrected, and drops each line as it is corrected', async () => {
		stubGraphQL({ ...shops([shop]), ...catalogue([]), ...taxonomy([categoryTop]), ...OK_ADD })
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByText('No item in this shop.')
		await add()
		await userEvent.click(save())

		const warning = await screen.findByRole('alert')
		const rows = () =>
			within(warning)
				.getAllByRole('listitem')
				.map((row) => row.textContent ?? '')
		const name = () => box(NEW).getByLabelText('Name')

		expect(warning).toHaveTextContent(VALIDATION_HEADER)
		expect(rows()).toContain('Name is required')
		expect(name()).toHaveClass('border-2', 'bg-app-error/10')

		write('Name', 'Garden trowel', NEW)

		await waitFor(() => {
			expect(rows()).not.toContain('Name is required')
		})
		expect(name()).toHaveClass('border', 'bg-white')
		// The rest of the list stays: one corrected box is not a saved form, and a toast that emptied
		// itself on the first fix would say the save is ready when it is not.
		expect(rows()).toContain('Description is required')
	})

	/*
	 * The whole point of the card.
	 *
	 * ⚠️ **The shop comes from the picker, not from a box.** `itemAdd` files the item into the `idCompany`
	 * it is given, and the only one this card can send is the shop whose catalogue is on screen.
	 *
	 * ⚠️ The shop starts with an item in it, and that is not decoration: `additionalTypenames` invalidates
	 * a cached response by the typenames the response *carries*, and an empty list carries none. A first
	 * shop is therefore the one case where the new item does not appear until something else refetches —
	 * which is why the card drops itself rather than waiting for the list to say it may.
	 */
	it('files the item into the chosen shop and drops the card once it is stored', async () => {
		const stub = stubGraphQL({
			...shops([shop]),
			CompanyItems: [{ data: { companyItems: [item] } }, { data: { companyItems: [item, itemTwo] } }],
			...taxonomy([categoryTop, categoryChild]),
			...OK_ADD
		})
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByRole('heading', { name: item.name, level: 3 })
		await add()
		fill()
		await userEvent.click(save())

		await screen.findByText('Changes saved.')
		expect(adds(stub)).toHaveLength(1)
		expect(adds(stub)[0]?.variables).toEqual({
			item: {
				idCompany: ID_COMPANY,
				idCategory: ID_TOP,
				name: 'Garden trowel',
				description: 'Stainless steel, ash handle.',
				slug: 'garden-trowel',
				// A new item is a draft until its owner says otherwise.
				published: false
			}
		})
		// The list refetches on `additionalTypenames` and the stored item takes the card's place. A
		// placeholder left behind would offer to add the same item a second time.
		expect(screen.queryByRole('heading', { name: NEW, level: 3 })).toBeNull()
		expect(await screen.findByRole('heading', { name: itemTwo.name, level: 3 })).toBeInTheDocument()
	})

	/*
	 * ⚠️ An `OnlyIdType` with nothing in it. The call site tests `itemAdd._id === undefined` rather than
	 * the object, because an object is truthy even when every field inside it is missing — a truthiness
	 * check would read this as a success, drop the card and throw away an item nobody stored.
	 */
	it('reports an answer carrying no id and keeps the card', async () => {
		stubGraphQL({
			...shops([shop]),
			...catalogue([]),
			...taxonomy([categoryTop]),
			ItemAdd: { data: { itemAdd: {} } }
		})
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByText('No item in this shop.')
		await add()
		fill()
		await userEvent.click(save())

		expect(await screen.findByRole('alert')).toHaveTextContent('Save failed.')
		expect(screen.getByRole('heading', { name: NEW, level: 3 })).toBeInTheDocument()
		expect(screen.queryByText('Changes saved.')).not.toBeInTheDocument()
		expect(save()).toBeEnabled()
	})

	// The duplicate slug is the refusal this mutation really answers with — unique per company, so two
	// shops may each hold a `garden-trowel` and one shop may not.
	it('surfaces the server message when the add fails', async () => {
		stubGraphQL({
			...shops([shop]),
			...catalogue([]),
			...taxonomy([categoryTop]),
			ItemAdd: { errors: [graphQLError('Server error', 'Slug already used in this shop', 409)], status: 409 }
		})
		await renderRoute(PAGE)
		await chooseShop()

		await screen.findByText('No item in this shop.')
		await add()
		fill()
		await userEvent.click(save())

		expect(await screen.findByRole('alert')).toHaveTextContent('Slug already used in this shop')
		expect(screen.getByRole('heading', { name: NEW, level: 3 })).toBeInTheDocument()
	})

	// The card is one more section of the page's save, registered after the items that exist: an edit to a
	// stored item and a new card are written in that order, by one press of one button.
	it('saves an edited item and a new card in the same press', async () => {
		const stub = stubGraphQL({ ...LOADED, ...OK, ...OK_ADD })
		await editAndAdd()

		await screen.findByText('Changes saved.')
		expect(writes(stub)[0]?.variables).toMatchObject({ _id: ID_ITEM, item: { description: 'Half a litre, enamelled steel.' } })
		expect(adds(stub)[0]?.variables).toMatchObject({ item: { slug: 'garden-trowel' } })
	})

	/*
	 * New cards are registered after the items that exist, and the page stops at the first section that
	 * refuses — so a card that fails does so with the item above it already written. That is not a
	 * rollback the page could offer: the two are separate mutations on separate documents. What it must do
	 * instead is say which half failed and keep the card, which is the half still unsaved.
	 */
	it('leaves the item above it written when the card is refused', async () => {
		const stub = stubGraphQL({ ...LOADED, ...OK, ItemAdd: { data: { itemAdd: {} } } })
		await editAndAdd()

		expect(await screen.findByRole('alert')).toHaveTextContent('Save failed.')
		expect(writes(stub)).toHaveLength(1)
		expect(adds(stub)).toHaveLength(1)
		expect(screen.getByRole('heading', { name: NEW, level: 3 })).toBeInTheDocument()
	})
})
