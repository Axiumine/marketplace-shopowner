import { z } from 'zod'

/*
 * The field rules two forms on the shopOwner detail page share: the company card and the shop card.
 *
 * They were one copy per feature file until the company moved into a collection of its own, at which
 * point the same seven rules would have existed twice on the same page — the shop card kept the address
 * and the contacts, the company card took the legal name, the Certified email and the registryExtract, and both need the
 * required/optional/email trio to say so. Two copies of a message like "must not exceed 100 characters"
 * is how one of them ends up phrased differently from the other.
 *
 * ⚠️ The **bounds** stay at the call sites and are deliberately not here. `MAX_ADDRESS` is 100 on a
 * shop and 250 on an shopOwner — same field name, same GraphQL fragment, different
 * collections — so a shared constant would be a bound that is wrong for one of its users. What is shared
 * is the shape of the rule, never the number.
 *
 * `ShopOwnerPersonalData` still carries its own `required` and a `optionalCoordinate` that has no
 * equivalent here: its position was added to the collection as optional and nothing backfilled it, so a
 * stored shopOwner may legitimately have empty coordinate boxes and `coordinate` below would refuse
 * to let their record be saved at all.
 */

/**
 * Deliberately loose, and the same shape the services use: one `@`, a dot in the domain, no whitespace.
 * A stricter grammar would reject addresses RFC 5322 allows, and the only real proof an address exists
 * is a delivered email.
 */
export const SHAPE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const required = (label: string, max: number) =>
	z.string().trim().min(1, `${label} is required`).max(max, `${label} cannot exceed ${max} characters`)

export const optional = (label: string, max: number) => z.string().trim().max(max, `${label} cannot exceed ${max} characters`)

/** Blank stays blank — it is how a contact is removed. Anything else has to look like an address. */
export const optionalEmail = (label: string, max: number) =>
	optional(label, max).refine((value) => value === '' || SHAPE_EMAIL.test(value), `${label} is not a valid address`)

/**
 * One half of the GeoJSON pair, typed into a text box.
 *
 * Two rules and not one, because "12,5" and "1200" are different mistakes and deserve different
 * messages. The blank test is inside the first: `Number('')` is `0`, which is finite, so an empty box
 * would otherwise validate as the middle of the Atlantic.
 *
 * The bounds differ per axis — ±180 for longitude, ±90 for latitude — matching the collection
 * validators. One ±180 rule for both is the bug the collection's own validator was corrected for, and
 * it would put a latitude a `2dsphere` index cannot key past the form.
 */
export const coordinate = (label: string, limit: number) =>
	z
		.string()
		.trim()
		.refine((value) => value !== '' && Number.isFinite(Number(value)), `${label} must be a number`)
		.refine((value) => Math.abs(Number(value)) <= limit, `${label} is outside -${limit}..${limit}`)

/**
 * The rule the address box is checked by, in both forms that have one.
 *
 * The box the owner types into is not what gets stored: the four fields behind it are, together with
 * the coordinates, and all six are written only by picking one of the geocoder's answers. A typed
 * address that was never picked would therefore save the *previous* street under new-looking text,
 * silently, because the six still hold everything they held.
 *
 * This is what refuses it: the line in the box has to still read as the address the fields behind it
 * spell out. It is also what makes the pick the only way a position ever moves — there is no longer a
 * box to type a latitude into.
 */
export const ADDRESS_MESSAGE = 'Select the address from the list'

/**
 * The address half of a blank card, for the two forms that can open one.
 *
 * Every field is `''` and not absent, for the reason each form's own `NEW_VALUES` gives: an
 * `undefined` reaching the schema answers with zod's "expected string, received undefined" instead of
 * the form's messages.
 *
 * Shared rather than written twice because five of these seven have no input of their own — a blank
 * `postalCode` and a `postalCode` holding nonsense are refused with the same sentence, and the message the box shows
 * is the first of the seven either way, so nothing rendered can tell the two apart. Here they can be
 * asserted directly.
 */
export const EMPTY_ADDRESS = {
	addressComplete: '',
	street: '',
	postalCode: '',
	city: '',
	province: '',
	longitude: '',
	latitude: ''
}
