import { describe, expect, it } from 'vitest'

import { addressError, composedAddress, coordinatesText, mapPoint } from '@/lib/address'

/**
 * A GeoJSON Point is `[longitude, latitude]` — longitude first. Every mapping UI and every human writes
 * it the other way round, so a pair passed on in the order it arrived puts the marker in the Southern
 * Ocean about half the time.
 */
describe('mapPoint', () => {
	it('reads the pair longitude first and hands it on by name', () => {
		expect(mapPoint([-71.06, 42.3601])).toEqual({ lat: 42.3601, lon: -71.06 })
	})

	// No map at all rather than a map of somewhere else: an address whose position did not arrive has no
	// place on one, and a frame centred on a fallback would be a claim instead of a gap.
	it('is nothing for a malformed pair', () => {
		expect(mapPoint([-71.06])).toBeNull()
	})

	// The case an shopOwner is normally in: `position` is optional on that collection and the caller
	// hands the empty array over for a record that has none.
	it('is nothing for no coordinates at all', () => {
		expect(mapPoint([])).toBeNull()
	})

	// The same gap as the empty array, and the reason the caller no longer writes `?? []`: an absent
	// `position` is answered here rather than turned into an array on the way in.
	it('is nothing for an absent position', () => {
		expect(mapPoint(undefined)).toBeNull()
	})

	// `0` is the prime meridian and the equator, not a missing value.
	it('keeps a zero coordinate', () => {
		expect(mapPoint([0, 0])).toEqual({ lat: 0, lon: 0 })
	})
})

/*
 * The two boxes behind an address field, which no test can reach through a form: neither coordinate has
 * an input, and a blank one and one holding nonsense are refused with the same sentence. Both cards seed
 * them from here, so this is where the seeded value is stated.
 */
describe('coordinateTesto', () => {
	it('writes the pair as the two strings the form holds, longitude first', () => {
		expect(coordinatesText([-71.06, 42.3601])).toEqual({ longitude: '-71.06', latitude: '42.3601' })
	})

	// Empty boxes, not the word "undefined" for the operator to delete: a pair of the wrong length is the
	// one broken shape a `[Float!]!` can carry.
	it('leaves both boxes empty for a pair that never arrived', () => {
		expect(coordinatesText([])).toEqual({ longitude: '', latitude: '' })
	})

	it('leaves the missing half empty and keeps the one that came', () => {
		expect(coordinatesText([-71.06])).toEqual({ longitude: '-71.06', latitude: '' })
	})

	// `0` again: the equator is a position, and `String(0)` is `'0'` rather than the fallback.
	it('keeps a zero coordinate', () => {
		expect(coordinatesText([0, 0])).toEqual({ longitude: '0', latitude: '0' })
	})
})

describe('composedAddress', () => {
	it('writes the four fields as one line', () => {
		expect(composedAddress({ street: '1 Main Street', postalCode: '02109', city: 'Boston', province: 'MA' })).toBe(
			'1 Main Street, 02109 Boston (MA)'
		)
	})

	// Both form schemas upper-case their own province, so a record stored with a lower-case province code would
	// otherwise seed a box that disagrees with the composite rule before anything was typed — and the
	// save would demand an address be re-picked for a letter nobody can see.
	it('upper-cases the province, as the schemas do', () => {
		expect(composedAddress({ street: '1 Main Street', postalCode: '02109', city: 'Boston', province: 'ma' })).toBe(
			'1 Main Street, 02109 Boston (MA)'
		)
	})
})

/*
 * The address box of all three cards. Only one of the seven is ever on screen, so the card tests can pin
 * down which message shows but not why the other six were passed over — this is where the whole set is
 * stated, one field at a time.
 */
describe('addressError', () => {
	// Nothing wrong, nothing under the box. The `?.` this asserts is the difference between an empty
	// message and a TypeError on every render of a valid form.
	it('is nothing when no field is in error', () => {
		expect(addressError({})).toBeUndefined()
	})

	/*
	 * Each of the seven named on its own, and not as a set: a key dropped from the list would fall through
	 * to `undefined` and read exactly like a key that was never in error — the save blocked with a silent
	 * form, which is the failure the whole helper exists to prevent.
	 */
	it.each([
		['street', 'Address is required'],
		['postalCode', 'The postal code must be 5 digits'],
		['city', 'City is required'],
		['province', 'The province is the 2-letter code'],
		['latitude', 'Latitude is not a number'],
		['longitude', 'Longitude is outside -180..180'],
		['addressComplete', 'Select the address from the list']
	])('shows the message of a broken %s', (field, message) => {
		expect(addressError({ [field]: { message } })).toBe(message)
	})

	/*
	 * The order, which is the reason the list is a list and not an `??` chain written any which way.
	 *
	 * A wrong field makes the composed line stop matching too, so the composite rule fires alongside it
	 * every single time — and it is the one that says nothing useful. "Select the address from the list"
	 * over an address that *was* selected, and whose postal code is what the geocoder left out, sends the operator
	 * back to the list to pick the same address again.
	 */
	it('prefers the broken field over the composite rule that broke with it', () => {
		expect(
			addressError({
				postalCode: { message: 'The postal code must be 5 digits' },
				addressComplete: { message: 'Select the address from the list' }
			})
		).toBe('The postal code must be 5 digits')
	})

	// Between two broken fields the list order decides, and it is the order the box reads top to bottom.
	it('shows the first broken field when more than one is', () => {
		expect(addressError({ city: { message: 'City is required' }, street: { message: 'Address is required' } })).toBe(
			'Address is required'
		)
	})

	// An error object with no message of its own still counts as the one that is broken — the search stops
	// there rather than walking on to a later field and describing that instead.
	it('is nothing for a broken field that carries no message', () => {
		expect(addressError({ postalCode: {}, addressComplete: { message: 'Select the address from the list' } })).toBeUndefined()
	})
})
