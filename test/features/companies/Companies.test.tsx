import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { SEARCH_DEBOUNCE_MS } from '@/components/ui/AddressField'
import { VALIDATION_HEADER } from '@/components/ui/ToastValidation'

import type { GraphQLReplies, GraphQLStub } from '../../helpers/graphql'
import { graphQLError, stubGraphQL } from '../../helpers/graphql'
import type { ResponseOsm } from '../../helpers/nominatim'
import { osmStub, resultOsm } from '../../helpers/nominatim'
import { page } from '../../helpers/page'
import { renderRoute } from '../../helpers/render'

/**
 * ⚠️ No id in the URL, and none anywhere else in this file. The operator app renders this same section
 * at `/p/shopOwners/id/$_id`, below the shop owner it names; here the owner is the session's, so the
 * page has nothing to be told and the route has no segment to carry it.
 */
const PAGE = '/companies'

const ID_COMPANY = '65f0000000000000000000a1'

/**
 * ⚠️ The `__typename` is load-bearing. urql's document cache invalidates by the typenames a *response*
 * mentions, and none of the three writes here mentions one — two answer a bare `Boolean` and `companyAdd`
 * an `OnlyIdType` — so the call site names the types itself through `additionalTypenames`, which can only
 * match a cached result carrying them.
 *
 * `taxCode` and `uniqueCode` arrive `null`, which is the shape of every company stored before 20260803000000:
 * neither field existed on the shop's embedded object that the migration lifted out.
 */
const company = {
	__typename: 'GraphQLCompany',
	_id: ID_COMPANY,
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

/** A second company of the same owner, for the tests that need two cards on the page. */
const companyTwo = {
	...company,
	_id: '65f0000000000000000000a2',
	legalName: 'White Trading Ltd',
	// Both unique across the whole collection, so two companies seeded from one literal would be a pair
	// no database would ever hold.
	vatNumber: '10987654321',
	certifiedEmail: 'anna@pec.it'
}

/** The same company, already sitting on exactly the address the geocoder stub answers with. */
const companyGeocoded = {
	...company,
	address: {
		street: '1 Main Street',
		postalCode: '02108',
		city: 'Boston',
		province: 'MA',
		position: { type: 'Point', coordinates: [-71.0589, 42.3601] }
	}
}

/**
 * The page's one and only query — and it takes no variables at all, because the owner is the session's.
 */
const companies = (items: unknown[]) => ({
	ShopOwnerCompanies: { data: { shopOwnerCompanies: items } }
})

/**
 * One company's block, by its legal name — which is the heading, and the only thing that tells two
 * cards apart. Every card carries a "Registered office" box, so an unscoped lookup for an address row
 * finds whichever company happens to be first on the page.
 *
 * `closest('section')`, not `parentElement`: the heading shares a flex row with the trash icon, so its
 * immediate parent is that title row and not the card's outer `<section>`.
 */
const card = (name = 'Rivers Trading Ltd') =>
	within(screen.getByRole('heading', { name: name, level: 3 }).closest('section') as HTMLElement)

const box = (title: string, name?: string) => within(card(name).getByRole('region', { name: title }))

/** The right-hand half of an `EditableRow` while it is closed. */
const rowValue = (title: string, label: string, name?: string): string => {
	const row = box(title, name).getByText(label, { selector: 'span' }).parentElement as HTMLElement
	return row.lastElementChild?.textContent ?? ''
}

const open = async (title: string, label: string, name?: string) => {
	await userEvent.click(box(title, name).getByRole('button', { name: `Change ${label}` }))
}

/** `fireEvent.change`, never `userEvent.type`: every box on this form carries a `maxLength`. */
const write = (title: string, label: string, value: string, name?: string) => {
	fireEvent.change(box(title, name).getByLabelText(label), { target: { value: value } })
}

const save = () => screen.getByRole('button', { name: 'Save' })

/**
 * The overlay a queued deletion draws over a company's information, or `null` when there is none.
 *
 */
const mask = () => screen.queryByText('It will be deleted on save.')?.parentElement ?? null

/** A company's own map frame, titled after the company so one card's frame is not another's. */
const map = (name = 'Rivers Trading Ltd') => screen.queryByTitle(`Map of ${name}`)

/** The map `AddressField` brings with it, which follows what is being typed rather than what is stored. */
const mapEditor = () => screen.queryByTitle('Address map')

/**
 * Every test that opens the address row stubs the geocoder as well as GraphQL — typing into that row is
 * what the field debounces into a Nominatim request, and an unstubbed one falls through to the operation
 * queue and throws, in a test about something else entirely.
 */
const stubNetwork = (replies: GraphQLReplies, osm: ResponseOsm | readonly ResponseOsm[] = {}) =>
	stubGraphQL(replies, osmStub(osm).rest)

const hintOsm = (name: string) => screen.findByRole('button', { name: name }, { timeout: SEARCH_DEBOUNCE_MS + 2000 })

/** What `osmResult()` answers with, as the suggestion list spells it out. */
const HINT = 'Main Street, 1, Boston, MA, 02108, USA'

/** The same answer once picked, as the box spells it out. */
const PICKED = '1 Main Street, 02108 Boston (MA)'

const withAddress = { results: [resultOsm()] }

const adds = (stub: GraphQLStub) => stub.calls.filter((call) => call.operationName === 'CompanyAdd')
const writes = (stub: GraphQLStub) => stub.calls.filter((call) => call.operationName === 'CompanyUpdate')
const deletes = (stub: GraphQLStub) => stub.calls.filter((call) => call.operationName === 'CompanyDel')

/** Every request the page sent for one operation — the queries included, which is how a refetch is counted. */
const reads = (stub: GraphQLStub, name: string) => stub.calls.filter((call) => call.operationName === name)

/**
 * Every message the one address box can be showing.
 *
 * Only the first of the seven is ever on screen — `addressError` picks one — so a test that has to say
 * "no field behind the box is still refused" has to name all seven and find none of them.
 */
const MESSAGES_ADDRESS = [
	'Street is required',
	'The postal code must be 5 digits',
	'City is required',
	'The province is the 2-letter code',
	'Latitude must be a number',
	'Longitude must be a number',
	'Select the address from the list'
]

const OK = { CompanyUpdate: { data: { companyUpdate: true } } }
/**
 * ⚠️ An object with an `_id`, not `true`. `companyAdd` answers `OnlyIdType` here and `Boolean` on the
 * Admin tier — the owner's flow is "create the card, then edit it", so the id of the company just stored is
 * the one thing the response has to carry.
 */
const OK_ADD = { CompanyAdd: { data: { companyAdd: { _id: '65f0000000000000000000a9' } } } }
const OK_DEL = { CompanyDel: { data: { companyDel: true } } }

/**
 * ⚠️ This is the whole `/companies` page, and every request it makes is scoped by the session alone.
 * `shopOwnerCompanies`, `companyAdd`, `companyUpdate` and `companyDel` all read the owner from
 * `ctx.state.user._id`, so no assertion in this file may ever send an owner id — a variable set that
 * carried one would be asking the backend to accept from a browser the one thing the session proves.
 */
describe('Companies', () => {
	it('waits before claiming there are no companies', async () => {
		stubGraphQL({ ShopOwnerCompanies: { pending: true } })
		await renderRoute(PAGE)

		expect(screen.getByText('Loading companies')).toBeInTheDocument()
		expect(screen.queryByText('No company registered.')).not.toBeInTheDocument()
	})

	it('says so when the owner has none', async () => {
		stubGraphQL(companies([]))
		await renderRoute(PAGE)

		expect(await screen.findByText('No company registered.')).toBeInTheDocument()
	})

	/*
	 * `data: null` with no error beside it: the query resolved and answered with nothing, which is a shape
	 * the wire allows and urql passes straight through. The section reads it as the empty list it is —
	 * anything else would put a card on screen for a company that does not exist.
	 */
	it('says so when the query resolves with no data at all', async () => {
		stubGraphQL({ ShopOwnerCompanies: { data: null } })
		await renderRoute(PAGE)

		expect(await screen.findByText('No company registered.')).toBeInTheDocument()
	})

	/*
	 * The query's failure, reported without the page pretending the list is empty. "No company
	 * registered." is a statement about the collection and a failed read knows nothing about it — an
	 * owner with three companies would be told they have none, on the one screen where that reads as
	 * data loss rather than as an error.
	 */
	it('reports a failure without claiming there are no companies', async () => {
		stubGraphQL({
			ShopOwnerCompanies: { errors: [graphQLError('Server error', 'Companies unavailable', 500)], status: 500 }
		})
		await renderRoute(PAGE)

		expect(await screen.findByRole('alert')).toHaveTextContent('Companies unavailable')
		expect(screen.queryByText('No company registered.')).not.toBeInTheDocument()
		// The page frame is still there: the section failed, the route did not.
		expect(screen.getByRole('heading', { name: 'Companies', level: 1 })).toBeInTheDocument()
	})

	it('shows every field the collection holds', async () => {
		stubGraphQL(companies([company]))
		await renderRoute(PAGE)

		expect(await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })).toBeInTheDocument()
		expect(rowValue('Company data', 'VAT number')).toBe('12345678901')
		expect(rowValue('Company data', 'Contact person')).toBe('Mark Rivers')
		expect(rowValue('Company data', 'Administrator')).toBe('Mark Rivers')
		expect(rowValue('Company data', 'Certified email')).toBe('certified@rivers.test')
		expect(rowValue('Company data', 'Registry extract')).toBe('MA-123456')
		// The two fields the migration added, absent on every company lifted out of a shop: a dash,
		// never the word "null" nor an empty cell that reads as a rendering bug.
		expect(rowValue('Company data', 'Tax code')).toBe('---')
		expect(rowValue('Company data', 'Unique code')).toBe('---')
	})

	// The legal seat, composed on one line exactly as the shop card composes a shop's — and a map centred
	// on the stored pair, which is the only place those coordinates are ever displayed.
	it('composes the legal seat and draws it on a map', async () => {
		stubGraphQL(companies([company]))
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })

		expect(rowValue('Registered office', 'Address')).toBe('3 Oak Street, 02108 Boston (MA)')
		expect(map()).toHaveAttribute('src', expect.stringContaining('marker=42.36260,-71.06360'))
	})

	// A pair of the wrong length is the one broken shape `[Float!]!` can carry: the card has nowhere to put
	// a marker and draws no frame rather than one pointing at the Gulf of Guinea.
	it('draws no map for a missing coordinate pair', async () => {
		stubGraphQL(companies([{ ...company, address: { ...company.address, position: { type: 'Point', coordinates: [] } } }]))
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })

		expect(map()).not.toBeInTheDocument()
	})

	// Each company is its own card, and the heading is what tells them apart — the only field of the
	// collection that ever appears outside its own box.
	it('renders every company of the owner', async () => {
		stubGraphQL(companies([company, companyTwo]))
		await renderRoute(PAGE)

		expect(await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })).toBeInTheDocument()
		expect(screen.getByRole('heading', { name: 'White Trading Ltd', level: 3 })).toBeInTheDocument()
	})

	// One frame per company, each named after the company it belongs to: two frames sharing a title would
	// be two maps no reader could tell apart, and no test could either.
	it('names each map after the company it belongs to', async () => {
		stubGraphQL(companies([company, companyTwo]))
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })

		expect(map()).toBeInTheDocument()
		expect(map('White Trading Ltd')).toBeInTheDocument()
	})

	it('renders', async () => {
		stubGraphQL(companies([company]))
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })
		expect(screen.getByRole('main')).toMatchSnapshot()
	})
})

/**
 * A company edited in place: one form, one Save, and one `$set` covering the flat fields and the legal
 * seat together — the same shape the shop card has, deliberately, because the two sit on one page under
 * one button.
 */
describe('Companies — editing', () => {
	/**
	 * Both companies edited under one press: a contact person typed into each card, then Save. The tests
	 * that start here differ only in what the stub answers back, which is the whole of what they are about.
	 */
	const editBothContactPersons = async () => {
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'White Trading Ltd', level: 3 })
		await open('Company data', 'Contact person')
		write('Company data', 'Contact person', 'Anna White')
		await open('Company data', 'Contact person', 'White Trading Ltd')
		write('Company data', 'Contact person', 'Louis Green', 'White Trading Ltd')
		await userEvent.click(save())
	}

	it('turns a row into its editor, seeded with the stored value', async () => {
		stubGraphQL(companies([company]))
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })
		await open('Company data', 'Contact person')

		expect(box('Company data').getByLabelText('Contact person')).toHaveValue('Mark Rivers')
		expect(save()).toBeDisabled()
	})

	// A `null` seeds an empty box, never the word "null" for the owner to delete first, and seeding is
	// not an edit: Save stays dead until something is typed.
	it('seeds an empty box for a field the company has not got', async () => {
		stubGraphQL(companies([company]))
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })
		await open('Company data', 'Tax code')

		expect(box('Company data').getByLabelText('Tax code')).toHaveValue('')
		expect(save()).toBeDisabled()
	})

	// Latitude first in the geocoder, longitude first on the wire. The pair is reassembled on save, and a
	// form that sent them in reading order would put a company in the Southern Ocean.
	it('sends the whole company, with the coordinates back in GeoJSON order', async () => {
		const stub = stubGraphQL({ ...companies([company]), ...OK })
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })
		await open('Company data', 'Contact person')
		write('Company data', 'Contact person', 'Anna White')
		await userEvent.click(save())

		expect(await screen.findByText('Changes saved.')).toBeInTheDocument()
		expect(writes(stub)).toEqual([
			expect.objectContaining({
				variables: {
					_id: ID_COMPANY,
					company: {
						legalName: 'Rivers Trading Ltd',
						vatNumber: '12345678901',
						// Never `''`: the collection is `additionalProperties: false` with `bsonType: 'string'`,
						// so an empty string would be a stored value where the service is meant to drop the field.
						taxCode: null,
						contactPerson: 'Anna White',
						administrator: 'Mark Rivers',
						uniqueCode: null,
						certifiedEmail: 'certified@rivers.test',
						address: {
							street: '3 Oak Street',
							postalCode: '02108',
							city: 'Boston',
							province: 'MA',
							// ⚠️ `type` travels with the pair on this tier. `GraphQLInputCompanyPosition` declares it
							// `String!` here and does not declare it at all on the Admin tier, which stamps `'Point'`
							// inside `validateAddress` — `grep -rn "'Point'"` over this service's `src` finds nothing,
							// so a payload without it is refused by the schema before any resolver runs.
							position: { type: 'Point', coordinates: [-71.0636, 42.3626] }
						},
						registryExtract: 'MA-123456'
					}
				}
			})
		])
	})

	// The two optional fields, filled: what was `null` on the way in is a real value on the way out, and
	// the tax code is not checked for a format the collection does not have either.
	it('sends the optional fields once they are filled', async () => {
		const stub = stubGraphQL({ ...companies([company]), ...OK })
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })
		await open('Company data', 'Tax code')
		write('Company data', 'Tax code', '12345678901')
		await open('Company data', 'Unique code')
		write('Company data', 'Unique code', 'AB12CD3')
		await userEvent.click(save())

		await screen.findByText('Changes saved.')
		expect(writes(stub)[0]?.variables).toMatchObject({ company: { taxCode: '12345678901', uniqueCode: 'AB12CD3' } })
	})

	/*
	 * A company nobody touched is not merely nothing to send — it must not be *validated* either, or a
	 * stored company the current rules would reject blocks a save the owner made on a different card.
	 *
	 * The blank registryExtract is what such a company looks like: the field was unbounded and unchecked before
	 * the extraction, so companies lifted out of a shop can carry one this form would refuse.
	 */
	it('leaves an untouched company alone while another is saved', async () => {
		const stub = stubGraphQL({ ...companies([{ ...company, registryExtract: '' }, companyTwo]), ...OK })
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'White Trading Ltd', level: 3 })
		await open('Company data', 'Contact person', 'White Trading Ltd')
		write('Company data', 'Contact person', 'Louis Green', 'White Trading Ltd')
		await userEvent.click(save())

		await screen.findByText('Changes saved.')
		expect(writes(stub)).toHaveLength(1)
		expect(writes(stub)[0]?.variables).toMatchObject({ _id: companyTwo._id })
		expect(screen.queryByText('Registry extract is required')).not.toBeInTheDocument()
	})

	/*
	 * ⚠️ The save context names `GraphQLCompany` and nothing else, so the refresh rests entirely on the
	 * cached companies response carrying that typename.
	 *
	 * Counted as requests rather than read off the screen. The page remounts its sections after a save and a
	 * remount re-executes the query — off the cache, silently, unless the mutation invalidated it. The
	 * second request is the whole difference.
	 */
	it('refetches the companies after a rename', async () => {
		const stub = stubGraphQL({ ...companies([company]), ...OK })
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })

		expect(reads(stub, 'ShopOwnerCompanies')).toHaveLength(1)

		await open('Company data', 'Legal name')
		write('Company data', 'Legal name', 'Rivers Trading PLC')
		await userEvent.click(save())

		await screen.findByText('Changes saved.')
		await waitFor(() => {
			expect(reads(stub, 'ShopOwnerCompanies')).toHaveLength(2)
		})
	})

	// One company refusing must not swallow the other's edit, which is why each is its own section.
	it('stops at the company that was refused', async () => {
		const stub = stubGraphQL({
			...companies([company, companyTwo]),
			CompanyUpdate: { errors: [graphQLError('Server error', 'Certified email already registered', 409)], status: 409 }
		})
		await editBothContactPersons()

		expect(await screen.findByRole('alert')).toHaveTextContent('Certified email already registered')
		expect(writes(stub)).toHaveLength(1)
		expect(save()).toBeEnabled()
	})

	/*
	 * The card's toast belongs to the card, and a save that fixed it has to take it down.
	 *
	 * ⚠️ Not something the page's remount does for it. The remount only happens when *every* section
	 * succeeded, so the interesting case is exactly this one: the first company is written on the second
	 * press while the second company is refused, nothing remounts, and the first card's old refusal would
	 * otherwise still be on screen next to the new one — two failures reported for one.
	 */
	it('clears its own refusal when the retry goes through', async () => {
		stubGraphQL({
			...companies([company, companyTwo]),
			CompanyUpdate: [
				{ errors: [graphQLError('Server error', 'Certified email already registered', 409)], status: 409 },
				{ data: { companyUpdate: true } },
				{ errors: [graphQLError('Server error', 'VAT number already registered', 409)], status: 409 }
			]
		})
		await editBothContactPersons()

		expect(await screen.findByText('Certified email already registered')).toBeInTheDocument()

		await userEvent.click(save())

		expect(await screen.findByText('VAT number already registered')).toBeInTheDocument()
		expect(screen.queryByText('Certified email already registered')).not.toBeInTheDocument()
	})

	// `false` with no error at all: no resolver answers that way, but `Boolean!` says it could, and a save
	// reported as successful would be worse than a generic line.
	it('reports a bare refusal', async () => {
		stubGraphQL({ ...companies([company]), CompanyUpdate: { data: { companyUpdate: false } } })
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })
		await open('Company data', 'Contact person')
		write('Company data', 'Contact person', 'Anna White')
		await userEvent.click(save())

		expect(await screen.findByRole('alert')).toHaveTextContent('Save failed.')
		expect(screen.queryByText('Changes saved.')).not.toBeInTheDocument()
	})

	/*
	 * The whitespace is the point: the schema trims before it validates, so a required box holding three
	 * spaces is empty — and the parsed value is what reaches the wire, so it cannot be padded either.
	 *
	 * The messages are spelled out one by one because each names its own box: a single shared sentence
	 * would leave the owner hunting for which of the four is empty.
	 */
	it.each([
		['Legal name', 'Legal name is required'],
		['Contact person', 'Contact person is required'],
		['Administrator', 'Administrator is required'],
		['Registry extract', 'Registry extract is required']
	])('refuses a blank %s', async (field, message) => {
		const stub = stubGraphQL({ ...companies([company]), ...OK })
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })
		await open('Company data', field)
		write('Company data', field, '   ')
		await userEvent.click(save())

		expect(await page().findByText(message)).toBeInTheDocument()
		expect(writes(stub)).toEqual([])
	})

	it.each([
		['VAT number', '1234567890', 'The VAT number is 11 digits'],
		['Tax code', '1234567890', 'The tax code is 11 characters'],
		['Unique code', 'ABC12', 'The unique code is 7 alphanumeric characters'],
		// Something the `type="email"` box itself accepts: jsdom runs the HTML validator too, and a value it
		// refuses never reaches the schema this line is about.
		['Certified email', 'at@', 'The certified email is not a valid address']
	])('refuses a malformed %s', async (field, value, message) => {
		const stub = stubGraphQL({ ...companies([company]), ...OK })
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })
		await open('Company data', field)
		write('Company data', field, value)
		await userEvent.click(save())

		expect(await page().findByText(message)).toBeInTheDocument()
		expect(writes(stub)).toEqual([])
	})

	// ⚠️ The address caps are not reachable from here: the four fields behind the one box have no input of
	// their own, so nothing can be typed past their length. `companySchema`'s own tests hold those bounds,
	// and this table is what is left that a keyboard can still reach.
	it.each([
		['Legal name', 101, 'Legal name cannot exceed 100 characters'],
		['Contact person', 51, 'Contact person cannot exceed 50 characters'],
		['Administrator', 51, 'Administrator cannot exceed 50 characters'],
		['Registry extract', 1001, 'Registry extract cannot exceed 1000 characters']
	])('refuses an over-long %s', async (field, length, message) => {
		const stub = stubGraphQL({ ...companies([company]), ...OK })
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })
		await open('Company data', field)
		write('Company data', field, 'x'.repeat(length))
		await userEvent.click(save())

		expect(await page().findByText(message)).toBeInTheDocument()
		expect(writes(stub)).toEqual([])
	})
})

/**
 * ⚠️ The rule that makes the single address box safe, seen from the page.
 *
 * The box is the only address input the card has; the four fields under it and the coordinate pair are
 * written by picking a geocoder answer and by nothing else. Free text left in the box would save the
 * *stored* seat under a line reading like some other address.
 */
describe('Companies — the registered office', () => {
	const addressBox = (name?: string) => box('Registered office', name).getByLabelText('Address')

	const list = () => screen.queryByRole('button', { name: HINT })

	/**
	 * A line typed into the box, never picked out of the list, and then saved — which the composite rule
	 * refuses. Returns with that refusal on screen, because that is the state both tests using it start from.
	 */
	const saveTypedAddress = async () => {
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })
		await open('Registered office', 'Address')
		fireEvent.change(addressBox(), { target: { value: '2 Main Street, 02108 Boston (MA)' } })
		await userEvent.click(save())

		expect(await page().findByText('Select the address from the list')).toBeInTheDocument()
	}

	it('opens on the composed line, with no box for the fields behind it', async () => {
		stubNetwork(companies([company]))
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })
		await open('Registered office', 'Address')

		expect(addressBox()).toHaveValue('3 Oak Street, 02108 Boston (MA)')
		expect(box('Registered office').queryByLabelText('Postal code')).not.toBeInTheDocument()
		expect(box('Registered office').queryByLabelText('City')).not.toBeInTheDocument()
		expect(box('Registered office').queryByLabelText('Province')).not.toBeInTheDocument()
		expect(box('Registered office').queryByLabelText('Latitude')).not.toBeInTheDocument()
	})

	// Two maps of two different places, stacked, is worse than either: the stored one steps aside for the
	// editor's, which follows what is being typed.
	it("hands the map over to the editor's own", async () => {
		stubNetwork(companies([company]))
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })

		expect(map()).toBeInTheDocument()
		expect(mapEditor()).not.toBeInTheDocument()

		await open('Registered office', 'Address')

		expect(map()).not.toBeInTheDocument()
		expect(mapEditor()).toHaveAttribute('src', expect.stringContaining('marker=42.36260,-71.06360'))
	})

	// The whole of what a pick writes: the line, the four fields under it and the coordinate pair, all
	// seven at once, and all seven counting as an edit — a `setValue` that did not dirty the form would
	// leave the page with a new address and a dead Save button.
	it('writes the whole address from one pick, and calls it an edit', async () => {
		const stub = stubNetwork({ ...companies([company]), ...OK }, withAddress)
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })
		await open('Registered office', 'Address')
		fireEvent.change(addressBox(), { target: { value: '1 Main Street Boston' } })
		fireEvent.click(await hintOsm(HINT))

		expect(list()).not.toBeInTheDocument()
		expect(addressBox()).toHaveValue(PICKED)
		expect(save()).toBeEnabled()

		await userEvent.click(save())

		await screen.findByText('Changes saved.')
		expect(writes(stub)[0]?.variables).toMatchObject({
			company: {
				address: {
					street: '1 Main Street',
					postalCode: '02108',
					city: 'Boston',
					province: 'MA',
					// `type` and not just the pair: this tier's input requires it — see the add's wire assertion.
					position: { type: 'Point', coordinates: [-71.0589, 42.3601] }
				}
			}
		})
	})

	/*
	 * The seventh name in the `trigger` list at the end of a pick, and the one the six behind the box cannot
	 * stand in for: it is the only field of the seven with an input, and the only error a *stored* company
	 * can be left holding on its own — the rule it fails is the composite one, and picking is what satisfies
	 * it. Left out of that list, the box would go on refusing an address the owner has just chosen.
	 */
	it('clears the composite refusal once an address is picked', async () => {
		stubNetwork({ ...companies([company]), ...OK }, withAddress)
		await saveTypedAddress()

		fireEvent.click(await hintOsm(HINT))

		await waitFor(() => {
			expect(page().queryByText('Select the address from the list')).toBeNull()
		})
	})

	/*
	 * ⚠️ A pick has to *dirty* the form, not merely write to it — and this is the one arrangement that can
	 * tell the two apart. Typing in the box dirties the form by itself, so a pick that moved the company
	 * would leave Save enabled whether or not the six writes behind it counted as edits. Here the geocoder
	 * answers with exactly the address the company already has, so all seven fields land back on their
	 * stored values: only a `setValue` that keeps the dirty state honest can notice, and Save goes dead
	 * again.
	 */
	it('takes Save back down when the pick lands on the stored address', async () => {
		stubNetwork(companies([companyGeocoded]), withAddress)
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })
		await open('Registered office', 'Address')
		fireEvent.change(addressBox(), { target: { value: '1 Main Street Boston' } })

		expect(save()).toBeEnabled()

		fireEvent.click(await hintOsm(HINT))

		expect(addressBox()).toHaveValue(PICKED)
		await waitFor(() => {
			expect(save()).toBeDisabled()
		})
	})

	// Typed and not picked: the line no longer spells out the fields behind it, and the save is refused on
	// the one control the owner can do something about.
	it('refuses a line the owner typed over', async () => {
		const stub = stubNetwork({ ...companies([company]), ...OK })
		await saveTypedAddress()

		expect(writes(stub)).toEqual([])
	})
})

/**
 * The trash beside a company's name. Queued exactly like the field editors: a click marks the card and
 * nothing reaches the server until Save.
 *
 * ⚠️ `companyDel` is a **soft** delete — it stamps `deleted` and the company keeps its VAT number — and
 * it still answers 403 for a company this owner does not own or has already retired, because
 * `throwIfShopOwnerDontOwnCompany` filters `deleted`. That message has to reach the owner, which is why
 * the card's toast sits outside the mask that covers everything else.
 */
describe('Companies — deletion', () => {
	const trash = (name?: string) => card(name).getByRole('button', { name: 'Delete company' })

	it('queues the deletion behind the mask instead of writing it', async () => {
		const stub = stubGraphQL({ ...companies([company]), ...OK_DEL })
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })

		expect(mask()).toBeNull()

		await userEvent.click(trash())

		expect(mask()).toHaveClass('backdrop-blur-sm')
		expect(deletes(stub)).toEqual([])
		expect(save()).toBeEnabled()
	})

	// The one way back out, and the reason the title row stays sharp: the trash the owner has to press
	// again is the only control the mask must not cover.
	it('takes the deletion back', async () => {
		stubGraphQL(companies([company]))
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })
		await userEvent.click(trash())
		await userEvent.click(card().getByRole('button', { name: 'Cancel company deletion' }))

		expect(mask()).toBeNull()
		expect(save()).toBeDisabled()
	})

	// The heading is the one part of the card the mask does not cover, so it is the only place the queued
	// state can be read at all — struck through, and in the muted colour.
	it('strikes the name through while the deletion is queued', async () => {
		stubGraphQL(companies([company]))
		await renderRoute(PAGE)

		const title = await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })

		// The whole class list, not just the absence of `line-through`. The queued state is expressed by
		// what the ternary adds, so its *empty* alternative is as much a part of the rule as the struck
		// branch — and an alternative that quietly gained a class would leave every "not struck through"
		// assertion passing while the heading rendered as something else entirely.
		expect(title.className.trim()).toBe('text-lg font-bold')

		await userEvent.click(trash())

		expect(title).toHaveClass('text-tip', 'line-through')
	})

	it('deletes on Save', async () => {
		const stub = stubGraphQL({ ...companies([company]), ...OK_DEL })
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })
		await userEvent.click(trash())
		await userEvent.click(save())

		await waitFor(() => {
			expect(deletes(stub)).toHaveLength(1)
		})
		expect(deletes(stub)[0]?.variables).toEqual({ _id: ID_COMPANY })
		// The field edits are not written first: a company about to be removed does not need its card saved.
		expect(writes(stub)).toEqual([])
		// A delete that went through is a saved page, not a silent one: the section answers the registry the
		// way an edited card does, and nothing is reported against a card that did what it was asked.
		expect(await screen.findByText('Changes saved.')).toBeInTheDocument()
		expect(screen.queryByRole('alert')).toBeNull()
	})

	// Deletion wins over an edit made in the same press — asserted with both queued at once, because
	// "nothing was written" is otherwise indistinguishable from "nothing was edited".
	it('does not write the fields of a card it is about to delete', async () => {
		const stub = stubGraphQL({ ...companies([company]), ...OK, ...OK_DEL })
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })
		await open('Company data', 'Contact person')
		write('Company data', 'Contact person', 'Anna White')
		await userEvent.click(trash())
		await userEvent.click(save())

		await waitFor(() => {
			expect(deletes(stub)).toHaveLength(1)
		})
		expect(writes(stub)).toEqual([])
	})

	it('reports a bare refusal', async () => {
		stubGraphQL({ ...companies([company]), CompanyDel: { data: { companyDel: false } } })
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })
		await userEvent.click(trash())
		await userEvent.click(save())

		expect(await screen.findByRole('alert')).toHaveTextContent('Deletion failed.')
	})

	/*
	 * The 409 the shops make possible, and the whole reason the toast is outside the mask: a company still
	 * pointed at cannot be removed, and the owner has to read why while the card is still masked.
	 */
	it('surfaces the server message and leaves the card queued', async () => {
		stubGraphQL({
			...companies([company]),
			CompanyDel: { errors: [graphQLError('Server error', 'Company with active shops', 409)], status: 409 }
		})
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })
		await userEvent.click(trash())
		await userEvent.click(save())

		expect(await screen.findByRole('alert')).toHaveTextContent('Company with active shops')
		// Still queued, and still undoable: the mask covers the company's information and neither the toast
		// nor the trash that takes the deletion back.
		expect(mask()).not.toBeNull()
		expect(mask()).not.toContainElement(card().getByRole('button', { name: 'Cancel company deletion' }))
	})
})

/**
 * A company the owner is adding: the same fields as the card above it, driven by the same schema and
 * the same Save button, and sent to `companyAdd` with the owner's id where the update sends the company's
 * own.
 *
 * ⚠️ Every test here stubs the geocoder as well as GraphQL. A new card opens with **every** row on its
 * editor — there is nothing stored to show closed — so the address box is on screen from the first
 * render, and the debounce behind it would otherwise reach the operation queue and throw.
 */
describe('Companies — new company', () => {
	const NEW = 'New company'

	const newCard = () => screen.getByRole('heading', { name: NEW, level: 3 }).closest('section') as HTMLElement

	/** Both of them, in the order they were opened — two cards share one heading, so `card()` cannot. */
	const newCards = () =>
		screen.getAllByRole('heading', { name: NEW, level: 3 }).map((title) => title.closest('section') as HTMLElement)

	const add = async () => {
		await userEvent.click(screen.getByRole('button', { name: 'Add company' }))
	}

	/**
	 * A card filled the way an owner would: eight boxes typed and the address **picked** out of the
	 * geocoder's list, which is the only way the four address fields and the coordinate pair are written.
	 *
	 * The two optional boxes are left empty on purpose — what they send is the subject of its own test.
	 */
	const fill = async (target = NEW) => {
		write('Company data', 'Legal name', 'Green Trading Ltd', target)
		write('Company data', 'VAT number', '11122233344', target)
		write('Company data', 'Contact person', 'Anna White', target)
		write('Company data', 'Administrator', 'Anna White', target)
		write('Company data', 'Certified email', 'new@pec.it', target)
		write('Company data', 'Registry extract', 'MA-999999', target)
		fireEvent.change(box('Registered office', target).getByLabelText('Address'), { target: { value: '1 Main Street Boston' } })
		fireEvent.click(await hintOsm(HINT))
	}

	/**
	 * One press carrying two sections: an edit to the company that exists, and a filled new card behind it.
	 * The order is the point — the stored company is written first, so what the stub answers to the *add*
	 * is what each test using this is asking about.
	 */
	const editAndAdd = async () => {
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })
		await add()
		await open('Company data', 'Contact person')
		write('Company data', 'Contact person', 'Anna White')
		await fill()
		await userEvent.click(save())
	}

	// The plus belongs to the section rather than to the list, so it is there before the query answers and
	// stays there when it fails — an owner with no company is exactly who needs it.
	it('offers the plus while the companies are still loading', async () => {
		stubNetwork({ ShopOwnerCompanies: { pending: true } })
		await renderRoute(PAGE)

		expect(screen.getByRole('button', { name: 'Add company' })).toBeInTheDocument()
	})

	it('offers the plus when the companies could not be loaded', async () => {
		stubNetwork({
			ShopOwnerCompanies: { errors: [graphQLError('Server error', 'Companies unavailable', 500)], status: 500 }
		})
		await renderRoute(PAGE)

		await screen.findByRole('alert')
		expect(screen.getByRole('button', { name: 'Add company' })).toBeInTheDocument()
	})

	/*
	 * "No company registered." is about the collection, and an open card is the answer to it — the two
	 * on screen together would be the page contradicting itself.
	 *
	 * The card counts as a pending change from the moment it appears, before a character is typed: it is a
	 * company the owner asked for and the page has not written.
	 */
	it('replaces the empty-list message with a card, already worth saving', async () => {
		stubNetwork(companies([]))
		await renderRoute(PAGE)

		await screen.findByText('No company registered.')
		expect(save()).toBeDisabled()

		await add()

		expect(screen.getByRole('heading', { name: NEW, level: 3 })).toBeInTheDocument()
		expect(screen.queryByText('No company registered.')).not.toBeInTheDocument()
		expect(save()).toBeEnabled()
	})

	// New cards go under the companies that exist: the list is the record, and what is being added to it
	// does not push the record down the page.
	it('adds the card below the companies already stored', async () => {
		stubNetwork(companies([company]))
		await renderRoute(PAGE)

		await screen.findByRole('heading', { name: 'Rivers Trading Ltd', level: 3 })
		await add()

		// Filtered, because `Infobox` titles are `h3` too — every card contributes two of them.
		const titles = screen
			.getAllByRole('heading', { level: 3 })
			.map((title) => title.textContent)
			.filter((text) => text === 'Rivers Trading Ltd' || text === NEW)
		expect(titles).toEqual(['Rivers Trading Ltd', NEW])
	})

	// Every row opens on its editor, because there is no stored value for a closed row to show — a card of
	// dashes with a pen beside each would read as a rendering bug.
	it('opens every row of the card on its editor', async () => {
		stubNetwork(companies([]))
		await renderRoute(PAGE)

		await screen.findByText('No company registered.')
		await add()

		expect(box('Company data', NEW).getByLabelText('Legal name')).toHaveValue('')
		expect(box('Company data', NEW).getByLabelText('VAT number')).toHaveValue('')
		expect(box('Company data', NEW).getByLabelText('Contact person')).toHaveValue('')
		expect(box('Company data', NEW).getByLabelText('Administrator')).toHaveValue('')
		expect(box('Company data', NEW).getByLabelText('Certified email')).toHaveValue('')
		expect(box('Registered office', NEW).getByLabelText('Address')).toHaveValue('')
		// No pen anywhere on the card: a row that is already open has nothing to open.
		expect(within(newCard()).queryByRole('button', { name: 'Change Legal name' })).toBeNull()
	})

	// What a card with no stored company behind it deliberately does not carry: the map draws a position
	// nobody has picked. The editor's own map is there instead, centred on the country until an address is chosen.
	it('leaves out the map of a seat that has not been chosen', async () => {
		stubNetwork(companies([]))
		await renderRoute(PAGE)

		await screen.findByText('No company registered.')
		await add()

		expect(within(newCard()).queryByTitle(/^Map of /)).toBeNull()
		expect(mapEditor()).toBeInTheDocument()
	})

	// The one icon it carries, and it is not a delete: there is nothing stored to remove. It is also the
	// only way out of the leave guard the card arms the moment it appears.
	it('throws the card away when its trash is pressed', async () => {
		stubNetwork(companies([]))
		await renderRoute(PAGE)

		await screen.findByText('No company registered.')
		await add()
		await userEvent.click(within(newCard()).getByRole('button', { name: 'Cancel new company' }))

		expect(screen.queryByRole('heading', { name: NEW, level: 3 })).toBeNull()
		expect(screen.getByText('No company registered.')).toBeInTheDocument()
		expect(save()).toBeDisabled()
	})

	/*
	 * ⚠️ Each card is keyed by a uuid of its own, and this is what says so. Keyed by position instead,
	 * discarding the first of two would hand its React state — an empty form — to the second, and the
	 * typing would vanish from a card the owner never touched.
	 */
	it("keeps a second card's contents when the first is discarded", async () => {
		stubNetwork(companies([]))
		await renderRoute(PAGE)

		await screen.findByText('No company registered.')
		await add()
		await add()

		fireEvent.change(within(newCards()[1] as HTMLElement).getByLabelText('Contact person'), {
			target: { value: 'Anna White' }
		})
		await userEvent.click(within(newCards()[0] as HTMLElement).getByRole('button', { name: 'Cancel new company' }))

		expect(newCards()).toHaveLength(1)
		expect(within(newCards()[0] as HTMLElement).getByLabelText('Contact person')).toHaveValue('Anna White')
	})

	/*
	 * ⚠️ The card is seeded with an empty string per field rather than with nothing at all. react-hook-form
	 * hands the schema whatever it was given: `''` fails the rule the form wrote under the box
	 * it belongs to — `undefined` fails zod's type check instead, with "expected string, received
	 * undefined" shown to an owner.
	 */
	it("refuses an untouched card in this form's own words", async () => {
		const stub = stubNetwork({ ...companies([]), ...OK_ADD })
		await renderRoute(PAGE)

		await screen.findByText('No company registered.')
		await add()
		await userEvent.click(save())

		expect(await page().findByText('Legal name is required')).toBeInTheDocument()
		expect(page().getByText('The VAT number is 11 digits')).toBeInTheDocument()
		expect(page().getByText('Registry extract is required')).toBeInTheDocument()
		expect(page().getByText('Street is required')).toBeInTheDocument()
		expect(adds(stub)).toEqual([])
		expect(screen.queryByText('Changes saved.')).not.toBeInTheDocument()
	})

	/*
	 * The same refusal as the owner sees it: the boxes turn red, and the toast in the corner lists the
	 * same sentences they carry — the Save button is below three cards, and the box that refused may well be
	 * scrolled off the top of the page.
	 *
	 * The address is **one** line however many of its seven fields are wrong, which is the reason the toast
	 * goes through `addressError` rather than walking the error tree flat: six of the seven have no box
	 * of their own, so naming them would send the owner looking for fields that are not on screen.
	 *
	 * ⚠️ Read through `within(warningBox)` and not `page()`: each sentence is now on screen twice, and the
	 * toast stack is portalled to `document.body`, outside `main`.
	 */
	it('lists what has to be corrected, and drops each line as it is corrected', async () => {
		stubNetwork({ ...companies([]), ...OK_ADD }, withAddress)
		await renderRoute(PAGE)

		await screen.findByText('No company registered.')
		await add()
		await userEvent.click(save())

		const warning = await screen.findByRole('alert')
		const rows = () =>
			within(warning)
				.getAllByRole('listitem')
				.map((riga) => riga.textContent ?? '')
		const legalName = () => box('Company data', NEW).getByLabelText('Legal name')

		expect(warning).toHaveTextContent(VALIDATION_HEADER)
		expect(rows()).toContain('Legal name is required')
		expect(rows().filter((riga) => MESSAGES_ADDRESS.includes(riga))).toEqual(['Street is required'])
		expect(legalName()).toHaveClass('border-2', 'bg-app-error/10')

		write('Company data', 'Legal name', 'Green Trading Ltd', NEW)

		await waitFor(() => {
			expect(rows()).not.toContain('Legal name is required')
		})
		expect(legalName()).toHaveClass('border', 'bg-white')
		// The rest of the list stays: one corrected box is not a saved form, and a toast that emptied itself
		// on the first fix would say the save is ready when it is not.
		expect(rows()).toContain('Street is required')
	})

	/*
	 * ⚠️ What a pick has to revalidate, not just write.
	 *
	 * Six of the seven fields behind the box have no input of their own, so nothing clears their errors by
	 * being typed into — only the `trigger` at the end of the pick does. A name missing from that list
	 * leaves its field refused for good, and the box goes on showing a message about a value the owner
	 * has just chosen and has no way to reach.
	 */
	it('clears every field that was refused before the address was picked', async () => {
		stubNetwork({ ...companies([]), ...OK_ADD }, withAddress)
		await renderRoute(PAGE)

		await screen.findByText('No company registered.')
		await add()
		await userEvent.click(save())

		expect(await page().findByText('Street is required')).toBeInTheDocument()

		fireEvent.change(box('Registered office', NEW).getByLabelText('Address'), { target: { value: '1 Main Street Boston' } })
		fireEvent.click(await hintOsm(HINT))

		await waitFor(() => {
			expect(screen.queryByText('Street is required')).toBeNull()
		})
		for (const message of MESSAGES_ADDRESS) expect(screen.queryByText(message)).toBeNull()
	})

	/*
	 * The whole point of the card, and the two things about the payload that are this tier's alone.
	 *
	 * ⚠️ **No owner id.** The update sends `_id` and the add sends nothing but the company: `companyAdd`
	 * stamps the owner from the session, and the Admin tier's mutation of the same name is the one that
	 * takes an `idShopOwner`.
	 *
	 * ⚠️ **`position.type` is sent.** `GraphQLInputCompanyPosition` requires it here and forbids it there
	 * — no `'Point'` is stamped anywhere in `marketplace-dev-authenticated-resource`, so a payload that
	 * omitted it would be refused by the schema before a resolver ever saw it.
	 *
	 * The two blank optionals go as `null`, which is how the service is told to drop them.
	 */
	it('sends the company with no owner id and drops the card once it is stored', async () => {
		const stub = stubNetwork({ ...companies([]), ...OK_ADD }, withAddress)
		await renderRoute(PAGE)

		await screen.findByText('No company registered.')
		await add()
		await fill()

		expect(box('Registered office', NEW).getByLabelText('Address')).toHaveValue(PICKED)

		await userEvent.click(save())

		await screen.findByText('Changes saved.')
		expect(adds(stub)).toHaveLength(1)
		expect(adds(stub)[0]?.variables).toEqual({
			company: {
				legalName: 'Green Trading Ltd',
				vatNumber: '11122233344',
				taxCode: null,
				contactPerson: 'Anna White',
				administrator: 'Anna White',
				uniqueCode: null,
				certifiedEmail: 'new@pec.it',
				address: {
					street: '1 Main Street',
					postalCode: '02108',
					city: 'Boston',
					province: 'MA',
					position: { type: 'Point', coordinates: [-71.0589, 42.3601] }
				},
				registryExtract: 'MA-999999'
			}
		})
		// The list refetches on `additionalTypenames` and the stored company takes the card's place. A
		// placeholder left behind would show the same company twice, the second time as a form adding it again.
		expect(screen.queryByRole('heading', { name: NEW, level: 3 })).toBeNull()
	})

	/*
	 * ⚠️ An `OnlyIdType` with nothing in it. The call site tests `companyAdd._id === undefined` rather than
	 * the object, because an object is truthy even when every field inside it is missing — a truthiness
	 * check would read this as a success, drop the card and throw away a company nobody stored.
	 */
	it('reports an answer carrying no id and keeps the card', async () => {
		stubNetwork({ ...companies([]), CompanyAdd: { data: { companyAdd: {} } } }, withAddress)
		await renderRoute(PAGE)

		await screen.findByText('No company registered.')
		await add()
		await fill()
		await userEvent.click(save())

		expect(await screen.findByRole('alert')).toHaveTextContent('Save failed.')
		expect(screen.getByRole('heading', { name: NEW, level: 3 })).toBeInTheDocument()
		expect(screen.queryByText('Changes saved.')).not.toBeInTheDocument()
		expect(save()).toBeEnabled()
	})

	// The duplicate `vatNumber` and the duplicate `certifiedEmail` are the two refusals this mutation really answers with,
	// and both arrive as a message the owner can act on — so the message is what is shown.
	it('surfaces the server message when the add fails', async () => {
		stubNetwork(
			{
				...companies([]),
				CompanyAdd: {
					errors: [graphQLError('Server error', 'VAT number or Certified email already registered by another company', 409)],
					status: 409
				}
			},
			withAddress
		)
		await renderRoute(PAGE)

		await screen.findByText('No company registered.')
		await add()
		await fill()
		await userEvent.click(save())

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'VAT number or Certified email already registered by another company'
		)
		expect(screen.getByRole('heading', { name: NEW, level: 3 })).toBeInTheDocument()
	})

	// The card is one more section of the page's save, registered after the companies that exist: an edit
	// to a stored company and a new card are written in that order, by one press of one button.
	it('saves an edited company and a new card in the same press', async () => {
		const stub = stubNetwork({ ...companies([company]), ...OK, ...OK_ADD }, withAddress)
		await editAndAdd()

		await screen.findByText('Changes saved.')
		expect(writes(stub)[0]?.variables).toMatchObject({ _id: ID_COMPANY, company: { contactPerson: 'Anna White' } })
		expect(adds(stub)[0]?.variables).toMatchObject({ company: { vatNumber: '11122233344' } })
	})

	/*
	 * New cards are registered after the companies that exist, and the page stops at the first section that
	 * refuses — so a card that fails does so with the company above it already written. That is not a
	 * rollback the page could offer: the two are separate mutations on separate documents. What it must do
	 * instead is say which half failed and keep the card, which is the half still unsaved.
	 */
	it('leaves the company above it written when the card is refused', async () => {
		const stub = stubNetwork({ ...companies([company]), CompanyAdd: { data: { companyAdd: false } }, ...OK }, withAddress)
		await editAndAdd()

		expect(await screen.findByRole('alert')).toHaveTextContent('Save failed.')
		expect(writes(stub)).toHaveLength(1)
		expect(adds(stub)).toHaveLength(1)
		expect(screen.getByRole('heading', { name: NEW, level: 3 })).toBeInTheDocument()
	})
})
