import { describe, expect, it } from 'vitest'

import { DELTA_BBOX, MAX_RESULTS, searchAddresses, urlMap } from '@/lib/nominatim'

import { installOsm, NOMINATIM_SEARCH, OSM_EMBED, resultOsm } from '../helpers/nominatim'

const search = (query = 'Via Roma 1 Milano') => searchAddresses(query, new AbortController().signal)

describe('searchAddresses', () => {
	/**
	 * The query string is the whole contract with Nominatim, asserted whole rather than sampled.
	 *
	 * `countrycodes=it` is not a nicety: every field around this one is an Italian address — five-digit
	 * CAP, two-letter province — so a Roman street in Texas is noise the operator reads past. `limit`
	 * keeps one answer small, which is what the usage policy asks of a client that fires on every pause
	 * in typing.
	 */
	it('asks Nominatim for Italian addresses only, in Italian, five at a time', async () => {
		const osm = installOsm({ results: [] })

		await search('Via Roma 1')

		expect(osm.calls).toEqual([
			`${NOMINATIM_SEARCH}?q=Via+Roma+1&format=jsonv2&addressdetails=1&limit=${MAX_RESULTS}&countrycodes=it&accept-language=it`
		])
	})

	it('flattens one result into the four fields the personalData stores', async () => {
		installOsm({ results: [resultOsm()] })

		await expect(search()).resolves.toEqual([
			{
				id: '240109189',
				label: 'Via Roma, 1, Milano, MI, 20121, Italia',
				street: 'Via Roma 1',
				postalCode: '20121',
				city: 'Milano',
				province: 'MI',
				lat: 45.4642,
				lon: 9.1895
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
			results: [resultOsm({ address: { road: 'Via Verdi', house_number: '3', postcode: '22063', ...city } })]
		})

		const [found] = await search()
		expect(found?.city).toBe(expected)
	})

	// A rural address has no `house_number` key at all. Joining regardless would store `Via Verdi ` with
	// a trailing space — invisible in the box, and never equal to the same street typed by hand.
	it('leaves no trailing space when the street has no number', async () => {
		installOsm({ results: [resultOsm({ address: { road: 'Strada Provinciale 12' } })] })

		const [found] = await search()
		expect(found?.street).toBe('Strada Provinciale 12')
	})

	// `ISO3166-2-lvl6` is the province, and its value already is the code the form wants — prefixed with
	// the country. `county` is the province's *name*, spelled however the mappers wrote it.
	it('takes the province code off the ISO level-6 tag', async () => {
		installOsm({
			results: [resultOsm({ address: { county: 'Città Metropolitana di Milano', 'ISO3166-2-lvl6': 'IT-MI' } })]
		})

		const [found] = await search()
		expect(found?.province).toBe('MI')
	})

	it('leaves the province empty when OSM has no level-6 tag for the point', async () => {
		installOsm({ results: [resultOsm({ address: { road: 'Via Verdi' } })] })

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

		await expect(search()).rejects.toThrow(`Nominatim ha risposto ${String(status)}`)
	})

	it('throws when the answer is not the shape jsonv2 promises', async () => {
		installOsm({ results: [{ display_name: 'Via Roma' }] })

		await expect(search()).rejects.toThrow()
	})

	// The signal is what keeps the answers in order: an abandoned request must not be able to land after
	// the one that replaced it.
	it('gives the request up when its signal is aborted', async () => {
		installOsm({ pending: true })
		const controller = new AbortController()

		const pendingCall = searchAddresses('Via Roma', controller.signal)
		controller.abort()

		await expect(pendingCall).rejects.toThrow('The operation was aborted.')
	})
})

describe('urlMap', () => {
	it('frames a fixed box around the point, with a marker on it', () => {
		expect(urlMap(45.4642, 9.1895)).toBe(
			`${OSM_EMBED}?bbox=9.18550,45.46020,9.19350,45.46820&layer=mapnik&marker=45.46420,9.18950`
		)
	})

	// The box is a constant, not Nominatim's own `boundingbox`: that one is the extent of the matched
	// object, so a house and a city would zoom to wildly different scales in the same suggestion list.
	it('is the same width whatever the point', () => {
		expect(DELTA_BBOX).toBe(0.004)
		expect(urlMap(41.9028, 12.4964)).toContain('bbox=12.49240,41.89880,12.50040,41.90680')
	})

	// Binary floating point writes `9.190000000000001` into a URL given the chance, which changes the
	// frame's `src` for nothing and reloads the map.
	it('rounds to five decimals so the URL is a pure function of the point', () => {
		expect(urlMap(45.1, 9.2)).toBe(`${OSM_EMBED}?bbox=9.19600,45.09600,9.20400,45.10400&layer=mapnik&marker=45.10000,9.20000`)
	})
})
