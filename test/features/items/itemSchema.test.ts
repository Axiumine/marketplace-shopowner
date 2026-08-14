import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * One item's write schema and the two pure functions the category picker is built from, asserted
 * directly rather than through a card.
 *
 * `save()` sends the *parsed* values, so the trims are payload rather than cosmetics, and the length
 * caps sit behind a `maxLength` the keyboard cannot get past — the only place they can be reached is
 * here.
 *
 * ⚠️ Imported inside `beforeEach`, not at the top of the file — the schema is built at module scope, and
 * a top-level import evaluates it before Stryker activates the mutant under test.
 */
type Modulo = typeof import('@/features/items/Items')

let itemSchema: Modulo['itemSchema']
let orderedCategories: Modulo['orderedCategories']
let labelOfCategory: Modulo['labelOfCategory']
let valuesInitial: Modulo['valuesInitial']

beforeEach(async () => {
	vi.resetModules()
	;({ itemSchema, orderedCategories, labelOfCategory, valuesInitial } = await import('@/features/items/Items'))
})

const ID_CATEGORY = '65f0000000000000000000c1'

const VALID = {
	name: 'Blue enamel mug',
	description: 'Half a litre, dishwasher safe.',
	slug: 'blue-enamel-mug',
	idCategory: ID_CATEGORY
}

const outcome = (patch: Record<string, unknown> = {}) => itemSchema.safeParse({ ...VALID, ...patch })

const messages = (patch: Record<string, unknown> = {}) => {
	const result = outcome(patch)
	return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

const value = (patch: Record<string, unknown>) => {
	const result = outcome(patch)
	if (!result.success) throw new Error(result.error.issues.map((issue) => issue.message).join(' / '))
	return result.data
}

describe('itemSchema — the two text fields', () => {
	it('accepts an item that came back from the collection unchanged', () => {
		expect(messages()).toEqual([])
	})

	// One message per field, each naming the box it is about.
	it('names the field it is refusing', () => {
		expect(messages({ name: '   ' })).toEqual(['Name is required'])
		expect(messages({ description: '' })).toEqual(['Description is required'])
	})

	/*
	 * The caps come from `marketplace-db-setup/lib/schemas/item.js` by way of `GraphQLInputItem`, and the
	 * boundary is asserted from both sides: a description one character over is refused, and one exactly
	 * at the cap is not — a rule written with the wrong comparison passes half of that.
	 */
	it('holds the collection caps', () => {
		expect(messages({ name: 'x'.repeat(150) })).toEqual([])
		expect(messages({ name: 'x'.repeat(151) })).toEqual(['Name cannot exceed 150 characters'])
		expect(messages({ description: 'x'.repeat(2000) })).toEqual([])
		expect(messages({ description: 'x'.repeat(2001) })).toEqual(['Description cannot exceed 2000 characters'])
	})

	// The trim is what travels: the value the resolver returns is what `fieldsToSave` sends, so a name
	// typed with a trailing space is stored without one.
	it('sends the trimmed text', () => {
		expect(value({ name: '  Blue enamel mug  ', description: '  Half a litre.  ' })).toMatchObject({
			name: 'Blue enamel mug',
			description: 'Half a litre.'
		})
	})
})

/**
 * The slug, which is the item's own URL segment on the public site.
 *
 * Checked here as well as in the collection validator because the database's refusal arrives as a
 * validation error naming a field the owner cannot see, while this one arrives under the box they typed
 * into.
 */
describe('itemSchema — the slug', () => {
	const SHAPE = 'The slug is lowercase letters and digits, joined by single hyphens'

	it('holds both length bounds', () => {
		expect(messages({ slug: 'ab' })).toEqual([])
		expect(messages({ slug: 'a' })).toEqual(['The slug is at least 2 characters'])
		expect(messages({ slug: `a${'b'.repeat(159)}` })).toEqual([])
		expect(messages({ slug: `a${'b'.repeat(160)}` })).toEqual(['The slug cannot exceed 160 characters'])
	})

	// An empty box fails the length rule and the shape rule at once, and both are shown: the owner is
	// told what a slug is, not only that this one is short.
	it('refuses a blank slug on both counts', () => {
		expect(messages({ slug: '   ' })).toEqual(['The slug is at least 2 characters', SHAPE])
	})

	it.each([
		['an upper-case letter', 'Blue-mug'],
		['a space', 'blue mug'],
		['an underscore', 'blue_mug'],
		['a leading hyphen', '-blue-mug'],
		['a trailing hyphen', 'blue-mug-'],
		['two hyphens in a row', 'blue--mug'],
		['a letter no ASCII slug carries', 'blue-mügs'],
		['a dot', 'blue.mug']
	])('refuses %s', (_case, slug) => {
		expect(messages({ slug })).toEqual([SHAPE])
	})

	it.each([
		['digits alone', '12345'],
		['letters and digits in one group', 'mug500ml'],
		['three groups', 'blue-enamel-mug'],
		['the shortest one there is', 'ab']
	])('accepts %s', (_case, slug) => {
		expect(messages({ slug })).toEqual([])
	})

	it('sends the trimmed slug', () => {
		expect(value({ slug: '  blue-mug  ' }).slug).toBe('blue-mug')
	})
})

/**
 * ⚠️ The category is a plain non-empty check rather than an id shape, and the empty string is a state an
 * owner reaches without typing: it is what a stored item falls back to when the operator retires the
 * category it was filed under, so this message is what a taxonomy change looks like from inside the card.
 */
describe('itemSchema — the category', () => {
	it('refuses the placeholder option', () => {
		expect(messages({ idCategory: '' })).toEqual(['Category is required'])
	})

	it('accepts any id the picker offered', () => {
		expect(value({ idCategory: ID_CATEGORY }).idCategory).toBe(ID_CATEGORY)
	})

	/*
	 * ⚠️ The flag is not in the schema and must not come back. `itemUpdate` `$set`s the whole object, so a
	 * `published` the resolver parsed would be a `published` the save wrote, and `itemUpdatePublished`
	 * would stop being the only writer of it. zod strips what it does not declare, which is what makes
	 * this assertable: the card cannot smuggle the flag out even if something puts it back in the form.
	 */
	it('drops a published flag that reached it anyway', () => {
		expect(value({ published: true })).not.toHaveProperty('published')
	})
})

/**
 * The flat taxonomy as the picker reads it.
 *
 * `itemCategories` sorts by `position` then `_id`, which orders the two levels against each other rather
 * than nesting them — a subcategory at position 1 arrives before a top-level category at position 2.
 */
describe('orderedCategories', () => {
	const category = (patch: Partial<{ _id: string; idParent: string | null; name: string }>) => ({
		_id: 'c-0',
		idParent: null,
		name: 'Homeware',
		slug: 'homeware',
		position: 1,
		...patch
	})

	const TOP = category({ _id: 'c-1', name: 'Homeware' })
	const TOP_TWO = category({ _id: 'c-2', name: 'Garden' })
	const CHILD = category({ _id: 'c-3', idParent: 'c-1', name: 'Mugs' })
	const CHILD_TWO = category({ _id: 'c-4', idParent: 'c-2', name: 'Pots' })

	const labels = (categories: Parameters<typeof orderedCategories>[0]) =>
		orderedCategories(categories).map((option) => option.label)

	it('has nothing to offer for an empty taxonomy', () => {
		expect(orderedCategories([])).toEqual([])
	})

	it('keeps the order the resolver sent the top-level categories in', () => {
		expect(labels([TOP, TOP_TWO])).toEqual(['Homeware', 'Garden'])
	})

	/*
	 * The interleaving the sort produces, undone. `CHILD_TWO` arrives between the two parents, and a
	 * picker that offered the list as it came would put Garden's subcategory under Homeware.
	 */
	it('puts every subcategory under its own parent', () => {
		expect(labels([TOP, CHILD_TWO, TOP_TWO, CHILD])).toEqual(['Homeware', 'Homeware / Mugs', 'Garden', 'Garden / Pots'])
	})

	// The id an option writes is the subcategory's own, never its parent's: the label is the only part of
	// the pair the parent contributes to.
	it('writes the id of the category that was picked', () => {
		expect(orderedCategories([TOP, CHILD])).toEqual([
			{ _id: 'c-1', label: 'Homeware' },
			{ _id: 'c-3', label: 'Homeware / Mugs' }
		])
	})

	/*
	 * ⚠️ A subcategory whose parent is no longer in the list is kept, at the end, under its bare name. It
	 * is still a category items point at, and dropping it from the picker would silently re-file every one
	 * of them on the next save. The Admin tier can produce this state by retiring a parent.
	 */
	it('keeps a subcategory whose parent is gone', () => {
		expect(orderedCategories([TOP, CHILD, CHILD_TWO])).toEqual([
			{ _id: 'c-1', label: 'Homeware' },
			{ _id: 'c-3', label: 'Homeware / Mugs' },
			{ _id: 'c-4', label: 'Pots' }
		])
	})

	// An orphan is kept once, not twice: it is skipped by the nesting pass because its parent is not
	// there, and picked up by the orphan pass because it has one.
	it('offers each category exactly once', () => {
		expect(orderedCategories([CHILD_TWO]).map((option) => option._id)).toEqual(['c-4'])
	})
})

/**
 * What a card opens on, for a stored item and for one that does not exist yet.
 *
 * ⚠️ Asserted here rather than through a rendered card because the blank draft is a module constant: a
 * card mounted by the router reads it once, at import, and cannot see it change. This is the file that
 * re-imports the module.
 */
describe('valuesInitial', () => {
	const OPTIONS = [
		{ _id: 'c-1', label: 'Homeware' },
		{ _id: 'c-3', label: 'Homeware / Mugs' }
	]

	const STORED = {
		_id: 'i-1',
		idCompany: 'co-1',
		idCategory: 'c-3',
		name: 'Blue enamel mug',
		description: 'Half a litre, dishwasher safe.',
		slug: 'blue-enamel-mug',
		published: true
	}

	/*
	 * Every field, and no `published` among them: the flag is not part of the card any more, and `itemAdd`
	 * stamps `false` on the server, so a new item is a draft whatever this holds. A blank category is the
	 * placeholder the picker opens on, so the owner has to choose rather than accept whichever is first.
	 *
	 * `toEqual` and not `toMatchObject`, here and below: an extra key is exactly the regression this is
	 * about, so the assertion has to fail on one.
	 */
	it('opens a new card blank', () => {
		expect(valuesInitial(null, OPTIONS)).toEqual({
			name: '',
			description: '',
			slug: '',
			idCategory: ''
		})
	})

	// The stored flag is read past, not copied: `STORED` is published and the card it opens says nothing
	// about it, because the header's button is what reads and writes that.
	it('opens a stored card on what the collection holds', () => {
		expect(valuesInitial(STORED, OPTIONS)).toEqual({
			name: 'Blue enamel mug',
			description: 'Half a litre, dishwasher safe.',
			slug: 'blue-enamel-mug',
			idCategory: 'c-3'
		})
	})

	// The operator retired the category this item was filed under. Falling back to the placeholder makes
	// the next save a refusal the owner can fix, where keeping the dead id would send it straight back.
	it('falls back to the placeholder when the stored category is no longer offered', () => {
		expect(valuesInitial({ ...STORED, idCategory: 'c-9' }, OPTIONS).idCategory).toBe('')
		expect(valuesInitial(STORED, []).idCategory).toBe('')
	})
})

describe('labelOfCategory', () => {
	const OPTIONS = [
		{ _id: 'c-1', label: 'Homeware' },
		{ _id: 'c-3', label: 'Homeware / Mugs' }
	]

	it('reads the label the picker shows for a stored id', () => {
		expect(labelOfCategory(OPTIONS, 'c-3')).toBe('Homeware / Mugs')
	})

	// The dash, never the raw id and never an empty cell: an item filed under a retired category has to
	// read as a field to fill in rather than as a rendering bug.
	it('falls back to the placeholder for a category that is no longer offered', () => {
		expect(labelOfCategory(OPTIONS, 'c-9')).toBe('---')
		expect(labelOfCategory([], 'c-1')).toBe('---')
	})
})
