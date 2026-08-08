import type { FieldErrors } from 'react-hook-form'
import { describe, expect, it } from 'vitest'

import { messagesToFix } from '@/lib/formErrors'

/**
 * react-hook-form's own error shape, minus the `ref` and the `type` a real one also carries: neither is
 * read here, and a DOM node in a fixture would only suggest one is.
 *
 * `as unknown as FieldErrors` because `FieldErrors` is the untyped form's error map — a mapped type over
 * `Record<string, any>` that resolves to nothing concrete, and so has nothing in common with an object
 * literal. The same assertion the source file has to make.
 */
const errors = (tree: Record<string, unknown>): FieldErrors => tree as unknown as FieldErrors

describe('messagesToFix', () => {
	it('is empty for a form with nothing wrong', () => {
		expect(messagesToFix(errors({}))).toEqual([])
	})

	it('reads the message off a top-level field', () => {
		expect(messagesToFix(errors({ firstName: { message: 'First name is required' } }))).toEqual(['First name is required'])
	})

	// One line per box, in the order react-hook-form stores them — the toast is read top to bottom beside
	// a form that is read the same way.
	it('lists every field that is wrong', () => {
		const tree = {
			firstName: { message: 'First name is required' },
			certifiedEmail: { message: 'The certified email is not a valid address' }
		}

		expect(messagesToFix(errors(tree))).toEqual(['First name is required', 'The certified email is not a valid address'])
	})

	// A field array puts its rows under numeric keys, and the row's own fields under those: a walk that
	// stopped at the top level would refuse the save over a box it never named.
	it('descends into a field array', () => {
		const tree = {
			openingHours: [{ day: { message: 'Day is required' } }, { from: { message: 'Opening time is required' } }]
		}

		expect(messagesToFix(errors(tree))).toEqual(['Day is required', 'Opening time is required'])
	})

	// The rows of a field array are sparse — react-hook-form leaves a hole where a row is fine — and an
	// object is the only thing that can carry a message.
	it('walks past the holes and the values that are not objects', () => {
		const tree = { openingHours: [undefined, null, 'broken', { day: { message: 'Day is required' } }] }

		expect(messagesToFix(errors(tree))).toEqual(['Day is required'])
	})

	// The array-level rule is the one that describes the problem; repeating the rows' messages under it
	// would say the same thing twice in different words.
	it('stops at a node that has a message of its own', () => {
		const tree = {
			openingHours: Object.assign([{ day: { message: 'Day is required' } }], {
				message: 'At least one openingHours is required'
			})
		}

		expect(messagesToFix(errors(tree))).toEqual(['At least one openingHours is required'])
	})

	// Two rows refused for the same reason are one sentence, not two: a toast that says "the field is
	// required" three times says nothing three times.
	it('says the same sentence once', () => {
		const tree = {
			openingHours: [{ day: { message: 'Day is required' } }, { day: { message: 'Day is required' } }]
		}

		expect(messagesToFix(errors(tree))).toEqual(['Day is required'])
	})

	/*
	 * ⚠️ The address is one line however many of its seven fields are wrong, and it is `addressError`
	 * that decides which one — six of the seven have no input of their own, so a list naming them would
	 * send the operator looking for boxes that are not on screen.
	 *
	 * Two of them are wrong here on purpose: the postal code is the one reported, and the province's own message
	 * has to be absent rather than merely second.
	 */
	it('collapses the whole address to a single line', () => {
		const tree = {
			postalCode: { message: 'The postal code must be 5 digits' },
			province: { message: 'The province is the 2-letter code' }
		}

		expect(messagesToFix(errors(tree))).toEqual(['The postal code must be 5 digits'])
	})

	// The composite rule fires together with whichever field broke it, and it is reported last for the
	// reason written on `addressError`: "select the address from the list" under an address that was
	// selected, and whose postal code is the problem, sends the operator back to the list for nothing.
	it('reports the broken field rather than the composite rule that broke with it', () => {
		const tree = {
			postalCode: { message: 'The postal code must be 5 digits' },
			addressComplete: { message: 'Select the address from the list' }
		}

		expect(messagesToFix(errors(tree))).toEqual(['The postal code must be 5 digits'])
	})

	// The address line comes first, and the fields the operator can actually see follow it.
	it('puts the address ahead of the rest', () => {
		const tree = {
			firstName: { message: 'First name is required' },
			postalCode: { message: 'The postal code must be 5 digits' }
		}

		expect(messagesToFix(errors(tree))).toEqual(['The postal code must be 5 digits', 'First name is required'])
	})
})
