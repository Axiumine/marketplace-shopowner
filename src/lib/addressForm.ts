import type { UseFormSetValue, UseFormTrigger } from 'react-hook-form'

import { composedAddress } from '@/lib/address'
import type { FoundAddress } from '@/lib/nominatim'

/**
 * The seven boxes an address occupies in every form on the detail page — the one the owner can see
 * and the six behind it — named once so the write and the revalidation can never disagree about the set.
 */
export const FIELDS_ADDRESS = ['addressComplete', 'street', 'postalCode', 'city', 'province', 'latitude', 'longitude'] as const

/** The address slice of a form's values. Every form that edits one has these seven, plus its own. */
export type ValuesAddress = Record<(typeof FIELDS_ADDRESS)[number], string>

/**
 * What a geocoder pick counts as: an edit, on every field it writes.
 *
 * `setValue` leaves `isDirty` alone by default, which would let the address change under a Save button
 * that stays greyed out. With it, picking one address and then picking the stored one back leaves the
 * form clean again, as it should.
 */
const CHANGED = { shouldDirty: true }

/**
 * A geocoder answer written into the form behind an address box.
 *
 * A pick is the only way an address — or a position — reaches any of these forms. The six fields behind
 * the box have no input of their own, so nothing else can write them, and the composite rule in each
 * schema refuses a save where the line in the box and those six disagree.
 *
 * Shared by all three cards that edit an address — personalData, company, shop — because it was
 * written out three times, byte for byte, and the copies are the risk: an eighth field added to the
 * schemas and to two of the three would leave the third quietly storing the previous value for it under
 * an address that looks new.
 *
 * ⚠️ Generic over the whole form, and asserted down to the address slice inside. `Path<T>` does not
 * reduce to a literal for an unresolved `T` even when the constraint guarantees the key is there, so
 * `setValue('postalCode', …)` on the generic type does not compile. Doing it here costs two assertions in one
 * place; doing it at the call sites would cost six across three files, which is what this replaces.
 */
export const writeAddress = <T extends ValuesAddress>(
	found: FoundAddress,
	setValue: UseFormSetValue<T>,
	trigger: UseFormTrigger<T>
): void => {
	const write = setValue as unknown as UseFormSetValue<ValuesAddress>
	const rivalida = trigger as unknown as UseFormTrigger<ValuesAddress>

	write('addressComplete', composedAddress(found), CHANGED)
	write('street', found.street, CHANGED)
	write('postalCode', found.postalCode, CHANGED)
	write('city', found.city, CHANGED)
	write('province', found.province, CHANGED)
	write('latitude', String(found.lat), CHANGED)
	write('longitude', String(found.lon), CHANGED)

	/*
	 * Revalidated as a set, and not left to the next submit: the box is showing whichever of the seven
	 * is in error, so an address that fixes a missing postal code has to clear that message the moment it is
	 * picked. `void` because the form is not waiting on the answer — the errors it produces are read
	 * from `formState` on the render it triggers.
	 */
	void rivalida([...FIELDS_ADDRESS])
}
