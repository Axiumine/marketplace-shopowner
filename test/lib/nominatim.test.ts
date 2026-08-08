import { describe, expect, it } from 'vitest'

import { DELTA_BBOX, MAX_RESULTS, searchAddresses, urlMap } from '@/lib/nominatim'

import { installOsm, NOMINATIM_SEARCH, OSM_EMBED, resultOsm } from '../helpers/nominatim'

const search = (query = '1 Main Street Boston') => searchAddresses(query, new AbortController().signal)

describe('searchAddresses', () => {
	/**
	 * The query string is the whole contract with Nominatim, asserted whole rather than sampled.
	 *
	 * `countrycodes=us` is not a nicety: every field around this one is a domestic address — five-digit
	 * postal code, two-letter province — so a same-named street abroad is noise the operator reads past. `limit`
	 * keeps one answer small, which is what the usage policy asks of a client that fires on every pause
	 * in typing.
	 */
	it('asks Nominatim for domestic addresses only, in English, five at a time', async () => {
		const osm = installOsm({ results: [] })

		await search('1 Main Street')

		expect(osm.calls).toEqual([
			`${NOMINATIM_SEARCH}?q=1+Main+Street&format=jsonv2&addressdetails=1&limit=${MAX_RESULTS}&countrycodes=us&accept-language=en`
		])
	})

	it('flattens one result into the four fields the personalData stores', async () => {
		installOsm({ results: [resultOsm()] })

		await expect(search()).resolves.toEqual([
			{
				id: '240109189',
				label: 'Main Street, 1, Boston, MA, 02108, USA',
				street: '1 Main Street',
				postalCode: '02108',
				city: 'Boston',
				province: 'MA',
				lat: 42.3601,
				lon: -71.0589
			}
		])
	})

	// A city is tagged by size — `city`, `town`, `village` — and which one is present is not something
	// an address form can care about. Each spelling is one of the three, and the fallthrough is a place
	// with none of them: a motorway junction matches, and its city is simply unknown.
	it.each([
		[{ town: 'Cantù' }, 'Cantù'],
		[{ village: 'Sirmione' }, 'Sirmione'],
		[{}, '']
	])('reads the city out of %o', async (city, expected) => {
		installOsm({
			results: [resultOsm({ address: { road: 'Green Street', house_number: '3', postcode: '22063', ...city } })]
		})

		const [found] = await search()
		expect(found?.city).toBe(expected)
	})

	// A rural address has no `house_number` key at all. Joining regardless would store `Green Street ` with
	// a trailing space — invisible in the box, and never equal to the same street typed by hand.
	it('leaves no trailing space when the street has no number', async () => {
		installOsm({ results: [resultOsm({ address: { road: 'County Road 12' } })] })

		const [found] = await search()
		expect(found?.street).toBe('County Road 12')
	})

	// `ISO3166-2-lvl4` is the province, and its value already is the code the form wants — prefixed with
	// the country. `county` is the province's *name*, spelled however the mappers wrote it.
	it('takes the province code off the ISO level-6 tag', async () => {
		installOsm({
			results: [resultOsm({ address: { county: 'Greater Boston', 'ISO3166-2-lvl4': 'US-MA' } })]
		})

		const [found] = await search()
		expect(found?.province).toBe('MA')
	})

	it('leaves the province empty when OSM has no level-6 tag for the point', async () => {
		installOsm({ results: [resultOsm({ address: { road: 'Green Street' } })] })

		const [found] = await search()
		expect(found?.province).toBe('')
	})

	// Nominatim omits `address` entirely for some matches. Every field is then empty and the operator
	// fills them — which is a usable form, unlike a crash.
	it('survives a result with no address block at all', async () => {
		installOsm({ results: [resultOsm({ address: undefined })] })

		const [found] = await search()
		expect(found).toMatchObject({ street: '', postalCode: '', city: '', province: '' })
	})

	// 429 is what a client over the one-per-second limit is answered with, and 503 what the service sends
	// when it is shedding load. Both arrive as a body that parses — an HTML page — so the status is the
	// only thing that says the answer is not an address.
	it.each([429, 503])('throws on HTTP %i rather than reporting no matches', async (status) => {
		installOsm({ status, body: '<html>Bandwidth limit exceeded</html>' })

		await expect(search()).rejects.toThrow(`Nominatim answered ${String(status)}`)
	})

	it('throws when the answer is not the shape jsonv2 promises', async () => {
		installOsm({ results: [{ display_name: 'Main Street' }] })

		await expect(search()).rejects.toThrow()
	})

	// The signal is what keeps the answers in order: an abandoned request must not be able to land after
	// the one that replaced it.
	it('gives the request up when its signal is aborted', async () => {
		installOsm({ pending: true })
		const controller = new AbortController()

		const pendingCall = searchAddresses('Main Street', controller.signal)
		controller.abort()

		await expect(pendingCall).rejects.toThrow('The operation was aborted.')
	})
})

describe('urlMap', () => {
	it('frames a fixed box around the point, with a marker on it', () => {
		expect(urlMap(42.3601, -71.0589)).toBe(
			`${OSM_EMBED}?bbox=-71.06290,42.35610,-71.05490,42.36410&layer=mapnik&marker=42.36010,-71.05890`
		)
	})

	// The box is a constant, not Nominatim's own `boundingbox`: that one is the extent of the matched
	// object, so a house and a city would zoom to wildly different scales in the same suggestion list.
	it('is the same width whatever the point', () => {
		expect(DELTA_BBOX).toBe(0.004)
		expect(urlMap(39.8283, -98.5795)).toContain('bbox=-98.58350,39.82430,-98.57550,39.83230')
	})

	// Binary floating point writes `-71.060000000000001` into a URL given the chance, which changes the
	// frame's `src` for nothing and reloads the map.
	it('rounds to five decimals so the URL is a pure function of the point', () => {
		expect(urlMap(45.1, 9.2)).toBe(`${OSM_EMBED}?bbox=9.19600,45.09600,9.20400,45.10400&layer=mapnik&marker=45.10000,9.20000`)
	})
})
