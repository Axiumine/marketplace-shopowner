import type { FieldErrors } from 'react-hook-form'

import type { ErrorsAddress } from '@/lib/address'
import { addressError } from '@/lib/address'
import { FIELDS_ADDRESS } from '@/lib/addressForm'

/** The seven address keys as a set, so the walk below can ask about one key without scanning a list. */
const ADDRESS_FIELDS: ReadonlySet<string> = new Set(FIELDS_ADDRESS)

/**
 * Every message under one branch of the error tree, in the order react-hook-form stores them.
 *
 * Recursive because an error is not always one level down: a field array puts its rows under numeric
 * keys — `errors.openingHours[2].day` — and a form that listed only its own top-level fields would refuse to
 * save over a row it never named.
 *
 * **A node that has a message stops the walk.** A field array with a rule of its own carries both the
 * array-level message and the rows' — and the array-level one is the one that describes the problem, so
 * repeating "the field is required" under it adds nothing. It is also what keeps the walk off a leaf's
 * internals: a `FieldError` carries a `ref` pointing at the real DOM node, and descending into that is
 * a walk of the document.
 */
const collect = (node: unknown, messages: string[]): void => {
	if (typeof node !== 'object' || node === null) return

	const { message } = node as { message?: unknown }

	if (typeof message === 'string') {
		messages.push(message)
		return
	}

	for (const child of Object.values(node)) collect(child, messages)
}

/**
 * What the owner has to fix, one line per box they can see.
 *
 * Driven by `formState.errors` rather than by a snapshot taken when Save was pressed: the list has to
 * shrink as the fields are corrected, and a copy made at submit time would still be naming a box that is
 * already green.
 *
 * The address is collapsed to a single line by `addressError`, for the reason written there — six of
 * its seven fields have no input of their own, so a list naming them would send the owner looking for
 * boxes that are not on screen. Which is also why the seven are skipped by the walk: the composite rule
 * fires together with whichever field broke it, and both messages describe the same one box.
 *
 * Deduped, because two rows of the same field array refused for the same reason produce the same
 * sentence twice, and a toast that says "the field is required" three times says nothing three times.
 */
export const messagesToFix = (errors: FieldErrors): string[] => {
	const messages: string[] = []
	// Asserted, because `FieldErrors` is the shape of a form nobody named a values type for: its mapped
	// type resolves to nothing concrete, so it is not assignable to the seven optional keys below even
	// though every error it can hold is exactly one of them.
	const address = addressError(errors as ErrorsAddress)

	if (address !== undefined) messages.push(address)

	for (const [field, error] of Object.entries(errors)) {
		if (!ADDRESS_FIELDS.has(field)) collect(error, messages)
	}

	return [...new Set(messages)]
}
