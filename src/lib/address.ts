import { formatAddress } from '@/lib/format'

/**
 * The GeoJSON pair, as the map component wants it.
 *
 * `null` and not a fallback point: there is no sensible place to draw an address whose position did not
 * arrive, and a map centred on Rome for it would be a claim rather than a gap. A shop always
 * has one — the field is required on its collection — while an shopOwner may not, since the point
 * was added there as optional and nothing backfilled it.
 *
 * The guard is a length check rather than an `undefined` test on each half. The field is `[Float!]!`,
 * so the only broken shape the wire can deliver is a list of the wrong length — never a hole — which
 * made the longitude half of that test unreachable. The assertion states what the length check has
 * just established, and is the reason the two reads below need no guard of their own.
 *
 * The missing `position` of an shopOwner stored before the point existed is answered here too,
 * rather than by a `?? []` at the call site: an empty array and an absent one are the same gap, and
 * writing the fallback outside made a mutant no test could tell apart — any array the mutator puts
 * there is the wrong length as well.
 */
export const mapPoint = (coordinates: number[] | undefined): { lat: number; lon: number } | null => {
	if (coordinates?.length !== 2) return null

	const [lon, lat] = coordinates as [number, number]
	return { lat, lon }
}

/**
 * The same pair, as the two forms that edit an address seed their boxes with.
 *
 * `?? ''` and not a cast: a pair of the wrong length is the one broken shape `[Float!]!` can carry, and
 * `String(undefined)` would seed the box with the word "undefined" for the owner to delete. Shared
 * rather than written twice because the fallback is unobservable through the form — a coordinate has no
 * input of its own, and both an empty box and a nonsense one are refused with the same message, so the
 * only place the empty string can be pinned down is a test that calls this directly.
 */
export const coordinatesText = (coordinates: number[]): { longitude: string; latitude: string } => ({
	longitude: String(coordinates[0] ?? ''),
	latitude: String(coordinates[1] ?? '')
})

/**
 * The one-line address an address box shows, built the way the two forms' schemas rebuild it from the
 * four fields behind it — see either composite rule, which compares the two for equality.
 *
 * The province is upper-cased here because the schemas upper-case their own: a record stored with a
 * lower-case province code would otherwise seed a box that disagrees with the form before anything was typed.
 */
export const composedAddress = (address: { street: string; postalCode: string; city: string; province: string }): string =>
	formatAddress({ ...address, province: address.province.toUpperCase() })

/**
 * Just enough of react-hook-form's `FieldError` to read a message off one, so this file stays free of
 * the form library — nothing else in it knows a form exists.
 */
type ErrorField = { message?: string | undefined } | undefined

/**
 * The seven keys every address form here shares, whatever else its own values type carries.
 *
 * Exported for `formErrors.ts` alone, which walks a `FieldErrors` — react-hook-form's *untyped* error
 * shape, whose mapped type resolves to nothing concrete and so has "no properties in common" with this
 * one. The assertion there needs a name to point at.
 */
export type ErrorsAddress = {
	street?: ErrorField
	postalCode?: ErrorField
	city?: ErrorField
	province?: ErrorField
	latitude?: ErrorField
	longitude?: ErrorField
	addressComplete?: ErrorField
}

/**
 * One message for the whole address box, because the box is one field.
 *
 * The six fields behind it have no input of their own, so an error on any of them — a geocoder answer
 * with no postal code is the case that happens — would block the save with nothing on screen saying why.
 *
 * **The composite rule comes last**, even though the box is its own field. A wrong field makes the
 * composed line stop matching too, so the two fire together and only one of them says what is actually
 * broken: "select the address from the list" under an address that *was* selected, and whose postal code is
 * the problem, sends the owner back to the list to pick it again for nothing.
 *
 * Shared by all three cards that edit an address — personalData, company, shop. It was written
 * out three times, which meant an eighth field could be added to the schemas and left out of one of the
 * lists, and that card alone would refuse to save with a silent form.
 */
export const addressError = (errors: ErrorsAddress): string | undefined =>
	[
		errors.street,
		errors.postalCode,
		errors.city,
		errors.province,
		errors.latitude,
		errors.longitude,
		errors.addressComplete
	].find((error) => error !== undefined)?.message
