import { describe, expect, it } from 'vitest'

import { ADDRESS_MESSAGE, coordinate, EMPTY_ADDRESS, optional, optionalEmail, required, SHAPE_EMAIL } from '@/lib/fields'

/*
 * Some of these rules are exercised through the forms that use them — that is where a message reaches an
 * admin, and where a wrong bound is a wrong bound. The rest are asserted here, because no form can
 * reach them: a coordinate has no input of its own, and `optional` / `optionalEmail` currently have no
 * call site at all — the company card inlined its certified-email rule as a bare `regex` when the company
 * moved into a collection of its own, and left these two behind as the module's only unused exports.
 *
 * ⚠️ They are tested rather than deleted deliberately. `marketplace-shopowner` mirrors this module, and a
 * rule the shop-owner tier will need the moment it grows an optional contact field is cheaper to keep
 * asserted than to re-derive — the shared shape is the point of the file. What is *not* acceptable is
 * leaving them unasserted: an untested export is a rule that can be silently wrong for whoever adopts it
 * next, and the message text is the whole of what an admin ever sees.
 */
describe('coordinate', () => {
	const longitude = coordinate('Longitude', 180)

	it('takes a number inside its bound', () => {
		expect(longitude.parse('-71.06')).toBe('-71.06')
	})

	// The trim is the rule, not a tidy-up: `Number('   ')` is `0`, so a box holding nothing but spaces
	// would otherwise validate as the prime meridian and be written as a position the admin never
	// picked.
	it('refuses a box holding only spaces', () => {
		const outcome = longitude.safeParse('   ')

		expect(outcome.success).toBe(false)
		expect(outcome.error?.issues[0]?.message).toBe('Longitude must be a number')
	})

	it('refuses a value outside its bound', () => {
		expect(longitude.safeParse('181').error?.issues[0]?.message).toBe('Longitude is outside -180..180')
	})
})

describe('required', () => {
	const legalName = required('Legal name', 10)

	// The trim is what makes "empty" mean what an admin means by it: a box holding three spaces looks
	// blank and would otherwise pass a bare `min(1)`, storing whitespace as a legal name.
	it('trims, and answers the label when what is left is nothing', () => {
		expect(legalName.parse('  Rivers   ')).toBe('Rivers')
		expect(legalName.safeParse('   ').error?.issues[0]?.message).toBe('Legal name is required')
	})

	// The bound is measured after the trim, so the cap counts characters that were actually typed.
	it('names both the label and the cap it exceeded', () => {
		expect(legalName.safeParse('V'.repeat(11)).error?.issues[0]?.message).toBe('Legal name cannot exceed 10 characters')
		expect(legalName.parse('V'.repeat(10))).toBe('V'.repeat(10))
	})
})

/*
 * ⚠️ The schema is built inside each `it`, not once at the top of the describe.
 *
 * `optional` has no call site in `src` — it reaches a runtime only from this file — so a describe-scope
 * `const notes = optional('Notes', 5)` runs during Vitest's collection phase, before Stryker activates
 * the mutant for the test about to run. The rule then reads as untested however hard the assertions
 * below push on it, and `optional → () => undefined` survives every one of them. Same reason the
 * backend suites import their schema modules inside `beforeEach`.
 */
describe('optional', () => {
	// The whole difference from `required`: blank is an answer, not a missing one.
	it('accepts a blank box', () => {
		expect(optional('Notes', 5).parse('   ')).toBe('')
	})

	it('still caps what is there', () => {
		expect(optional('Notes', 5).safeParse('abcdef').error?.issues[0]?.message).toBe('Notes cannot exceed 5 characters')
	})
})

describe('optionalEmail', () => {
	const contact = () => optionalEmail('The contact email', 250)

	// Blank is how a contact is removed, so it has to survive the address check rather than be excused by
	// it — the refinement runs on every value, and `''` is the one it lets through on purpose.
	it('lets a blank box through', () => {
		expect(contact().parse('')).toBe('')
	})

	it('takes an address that looks like one', () => {
		expect(contact().parse('mark@rivers.test')).toBe('mark@rivers.test')
	})

	it('refuses anything else', () => {
		expect(contact().safeParse('mark@rivers').error?.issues[0]?.message).toBe('The contact email is not a valid address')
	})

	// The cap is checked before the shape, so an over-length address is reported as too long rather than
	// as malformed — two different mistakes, and the first is the one the admin made.
	it('caps before it checks the shape', () => {
		const long = `${'v'.repeat(250)}@rivers.test`

		expect(contact().safeParse(long).error?.issues[0]?.message).toBe('The contact email cannot exceed 250 characters')
	})
})

/*
 * Deliberately loose, and the same shape the services use. Asserted as a pattern rather than through a
 * form because the interesting cases are the ones a form's own `type="email"` would refuse first: jsdom
 * enforces interactive validation, so a bare `mark` never reaches zod from a keyboard at all.
 */
describe('SHAPE_EMAIL', () => {
	it.each(['mark@rivers.test', 'a+tag@sub.domain.co.uk'])('accepts %s', (address) => {
		expect(SHAPE_EMAIL.test(address)).toBe(true)
	})

	it.each(['mark', 'mark@rivers', 'mark@@rivers.test', 'ma rk@rivers.test', 'mark@ros si.it', ''])('refuses %s', (address) => {
		expect(SHAPE_EMAIL.test(address)).toBe(false)
	})
})

/*
 * Spelled out rather than compared against itself. It is the one sentence that tells an admin why an
 * address they typed by hand was refused, and asserting the constant against the constant would pass
 * whatever it happened to hold.
 */
describe('ADDRESS_MESSAGE', () => {
	it('says to pick the address from the list', () => {
		expect(ADDRESS_MESSAGE).toBe('Select the address from the list')
	})
})

/*
 * The seven strings a blank address card starts on. Five of them have no input, and the message the box
 * shows is the first error of the seven whatever the other six hold — so an empty `postalCode` and a `postalCode`
 * holding a sentence look identical through the form. Stated here instead.
 */
describe('ADDRESS_VUOTO', () => {
	it('is every address field empty, and nothing else', () => {
		expect(EMPTY_ADDRESS).toEqual({
			addressComplete: '',
			street: '',
			postalCode: '',
			city: '',
			province: '',
			longitude: '',
			latitude: ''
		})
	})
})
