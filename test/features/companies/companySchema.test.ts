import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * One company's write schema, asserted directly instead of through the company card.
 *
 * `save()` sends the *parsed* values, so the trims and the upper-casing are payload, not cosmetics, and
 * the length caps sit behind a `maxLength` the keyboard cannot get past.
 *
 * ⚠️ Imported inside `beforeEach`, not at the top of the file — the schema is built at module scope, and
 * a top-level import evaluates it before Stryker activates the mutant under test.
 */
type Modulo = typeof import('@/features/companies/Companies')

let companySchema: Modulo['companySchema']

beforeEach(async () => {
	vi.resetModules()
	;({ companySchema } = await import('@/features/companies/Companies'))
})

const VALID = {
	legalName: 'Rivers Trading Ltd',
	vatNumber: '12345678901',
	// Kept different from the VAT number even though a company's usually equals it: a fixture that shared
	// one string would let a swapped pair pass every assertion in this file.
	taxCode: '98765432109',
	contactPerson: 'Mark Rivers',
	administrator: 'Anna White',
	uniqueCode: 'ABC1234',
	certifiedEmail: 'certified@rivers.test',
	registryExtract: 'MA-123456',
	// The one line the owner sees, spelling out the four fields under it. The rule at the bottom of the
	// schema is the only thing that holds them together, so a fixture where they disagreed would fail
	// every test in this file for a reason none of them are about.
	addressComplete: '1 Main Street, 02109 Boston (MA)',
	street: '1 Main Street',
	postalCode: '02109',
	city: 'Boston',
	province: 'MA',
	longitude: '-71.06',
	latitude: '42.36'
}

const outcome = (patch: Record<string, unknown> = {}) => companySchema.safeParse({ ...VALID, ...patch })

const messages = (patch: Record<string, unknown> = {}) => {
	const result = outcome(patch)
	return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

const value = (patch: Record<string, unknown>) => {
	const result = outcome(patch)
	if (!result.success) throw new Error(result.error.issues.map((issue) => issue.message).join(' / '))
	return result.data
}

describe('companySchema — required fields', () => {
	it('accepts a company that came back from the collection unchanged', () => {
		expect(messages()).toEqual([])
	})

	// One message per field, each naming the box it is about: a shared "field required" would leave the
	// owner hunting for which of the four is empty.
	it('names the field it is refusing', () => {
		expect(messages({ legalName: '  ' })).toEqual(['Legal name is required'])
		expect(messages({ registryExtract: '' })).toEqual(['Registry extract is required'])
		expect(messages({ contactPerson: '' })).toEqual(['Contact person is required'])
		expect(messages({ administrator: '' })).toEqual(['Administrator is required'])
	})

	/*
	 * ⚠️ `address` is capped at 100 here and at 250 on the shopOwner — same field name, same GraphQL
	 * fragment, two collections. A 180-character street would pass the personalData and be refused here.
	 *
	 * `registryExtract` is capped at all only since 20260803000000: the field it was extracted from had no
	 * `maxLength` before the company collection existed, and the collection gave it one.
	 *
	 * The two address fields answer twice: an address field that is wrong is also an address field the
	 * composed line no longer spells out, and the rule at the bottom of the schema says so.
	 */
	it('caps each field where its own collection does', () => {
		expect(messages({ legalName: 'P'.repeat(101) })).toEqual(['Legal name cannot exceed 100 characters'])
		expect(messages({ contactPerson: 'R'.repeat(51) })).toEqual(['Contact person cannot exceed 50 characters'])
		expect(messages({ administrator: 'A'.repeat(51) })).toEqual(['Administrator cannot exceed 50 characters'])
		expect(messages({ registryExtract: 'v'.repeat(1001) })).toEqual(['Registry extract cannot exceed 1000 characters'])
		expect(messages({ street: 'V'.repeat(101) })).toEqual([
			'Street cannot exceed 100 characters',
			'Select the address from the list'
		])
		expect(messages({ city: 'M'.repeat(101) })).toEqual([
			'City cannot exceed 100 characters',
			'Select the address from the list'
		])
	})

	it('trims a required field before measuring it', () => {
		expect(value({ contactPerson: '  Mark Rivers  ' }).contactPerson).toBe('Mark Rivers')
	})
})

describe('companySchema — tax identifiers', () => {
	it('refuses a VAT number with anything either side of the eleven digits', () => {
		expect(messages({ vatNumber: 'a12345678901' })).toEqual(['The VAT number is 11 digits'])
		expect(messages({ vatNumber: '12345678901a' })).toEqual(['The VAT number is 11 digits'])
	})

	it('trims the VAT number before matching it', () => {
		expect(value({ vatNumber: '  12345678901  ' }).vatNumber).toBe('12345678901')
	})

	/*
	 * Eleven and not sixteen: this is the company's tax code, which for a legal entity is the
	 * eleven-digit form. Blank is how it is removed — no company stored before the extraction has one,
	 * because the field did not exist — and the collection checks the length and not the characters, so
	 * neither does this.
	 */
	it('accepts an empty tax code and refuses one of the wrong length', () => {
		expect(messages({ taxCode: '' })).toEqual([])
		expect(messages({ taxCode: '9876543210' })).toEqual(['The tax code is 11 characters'])
		expect(messages({ taxCode: '987654321098' })).toEqual(['The tax code is 11 characters'])
	})

	it('accepts a tax code that is not digits, because the collection does', () => {
		expect(messages({ taxCode: 'ABCDEF80A01' })).toEqual([])
	})

	it('trims the tax code before measuring it', () => {
		expect(value({ taxCode: '  98765432109  ' }).taxCode).toBe('98765432109')
	})

	// Blank is how the code is removed — the SDI recipient code is optional on the collection.
	it('accepts an empty SDI recipient code and refuses a malformed one', () => {
		expect(messages({ uniqueCode: '' })).toEqual([])
		expect(messages({ uniqueCode: '-ABC1234' })).toEqual(['The unique code is 7 alphanumeric characters'])
		expect(messages({ uniqueCode: 'ABC1234-' })).toEqual(['The unique code is 7 alphanumeric characters'])
	})

	it('trims the SDI recipient code before matching it', () => {
		expect(value({ uniqueCode: '  ABC1234  ' }).uniqueCode).toBe('ABC1234')
	})
})

describe('companySchema — certified email', () => {
	it('trims the Certified email before matching it', () => {
		expect(value({ certifiedEmail: '  certified@rivers.test  ' }).certifiedEmail).toBe('certified@rivers.test')
	})

	/*
	 * The address rule is deliberately loose — one `@`, a dot in the domain, no whitespace — but it is
	 * anchored at both ends. Unanchored it would approve "Mark Rivers <mark@rivers.test>", which the
	 * collection stores verbatim and no mail server will ever accept.
	 */
	it('refuses a Certified email that is not an address', () => {
		expect(messages({ certifiedEmail: 'certified-rivers.test' })).toEqual(['The certified email is not a valid address'])
		expect(messages({ certifiedEmail: 'a b@c.de' })).toEqual(['The certified email is not a valid address'])
		expect(messages({ certifiedEmail: 'a@b.cd e' })).toEqual(['The certified email is not a valid address'])
	})

	// Required, unlike the owner's own contact address: the collection has `certifiedEmail` as a required
	// unique field, so blank is a company with no PEC rather than a company that removed one.
	it('refuses a blank Certified email', () => {
		expect(messages({ certifiedEmail: '' })).toEqual(['The certified email is not a valid address'])
	})
})

describe('companySchema — postal code and province', () => {
	// The composed line comes back with each of these for the reason above: a postal code that is not five
	// digits is also a postal code the line in the box no longer spells out.
	it('refuses a postal code with anything either side of the five digits', () => {
		expect(messages({ postalCode: 'a12345' })).toEqual(['The postal code must be 5 digits', 'Select the address from the list'])
		expect(messages({ postalCode: '12345a' })).toEqual(['The postal code must be 5 digits', 'Select the address from the list'])
	})

	it('refuses a province with anything either side of the two letters', () => {
		expect(messages({ province: '1MI' })).toEqual(['The province is the 2-letter code', 'Select the address from the list'])
		expect(messages({ province: 'MI1' })).toEqual(['The province is the 2-letter code', 'Select the address from the list'])
	})

	it('trims and upper-cases the province', () => {
		expect(value({ province: '  ma  ' }).province).toBe('MA')
	})
})

/*
 * ⚠️ The rule that makes the single address box safe — the same one the company card relies on.
 *
 * The box is the only address input the card has; the four fields under it and the coordinate pair are
 * written by picking a geocoder answer and by nothing else. Free text left in the box would therefore
 * save the *stored* street, postal code, city and position under a line reading like some other
 * address — a save that reports success and writes none of what is on screen.
 */
describe('companySchema — the composed address', () => {
	it('refuses a line that is not the address the fields under it spell out', () => {
		expect(messages({ addressComplete: '2 Main Street, 02109 Boston (MA)' })).toEqual(['Select the address from the list'])
		expect(messages({ addressComplete: '1 Main Street' })).toEqual(['Select the address from the list'])
		expect(messages({ addressComplete: '' })).toEqual(['Select the address from the list'])
	})

	// Whichever of the four moved, the line stops matching — the rule is the whole address and not the
	// street half of it.
	it('refuses a line left behind by any one of the four fields', () => {
		expect(messages({ postalCode: '02108' })).toEqual(['Select the address from the list'])
		expect(messages({ city: 'New York' })).toEqual(['Select the address from the list'])
		expect(messages({ province: 'NY' })).toEqual(['Select the address from the list'])
	})

	// It is reported on the box, because the box is where the owner can do something about it: the
	// four fields it is really about have no input on the page at all.
	it('reports it on the box and not on a field with no input', () => {
		const result = outcome({ addressComplete: '2 Main Street, 02109 Boston (MA)' })

		expect(result.success).toBe(false)
		expect(result.error?.issues.map((issue) => issue.path)).toEqual([['addressComplete']])
	})

	it('compares against the upper-cased province code, not the one that was typed', () => {
		expect(messages({ province: '  ma  ' })).toEqual([])
	})
})

describe('companySchema — coordinates', () => {
	/*
	 * The blank test lives inside the "is a number" rule because `Number('')` is `0`, which is finite and
	 * in range — an empty box would otherwise validate as the middle of the Atlantic. A decimal comma is
	 * the other half: `Number('12,5')` is `NaN`, which fails the range rule too, so both lines come back.
	 */
	it('refuses a box that holds no number, blank included', () => {
		expect(messages({ longitude: '' })).toEqual(['Longitude must be a number'])
		expect(messages({ latitude: '12,5' })).toEqual(['Latitude must be a number', 'Latitude is outside -90..90'])
	})

	// The poles and the antimeridian are on the map, so the bound includes them — and it differs per axis.
	it('accepts each axis at its own limit and refuses the step past it', () => {
		expect(messages({ longitude: '180', latitude: '90' })).toEqual([])
		expect(messages({ longitude: '-180', latitude: '-90' })).toEqual([])
		expect(messages({ longitude: '180.1' })).toEqual(['Longitude is outside -180..180'])
		expect(messages({ latitude: '90.1' })).toEqual(['Latitude is outside -90..90'])
	})
})
