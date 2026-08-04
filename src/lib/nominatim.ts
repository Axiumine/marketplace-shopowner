import { z } from 'zod'

/**
 * The OpenStreetMap geocoder, and the OpenStreetMap map tile embed.
 *
 * Nominatim is a free service run on donated hardware and its usage policy is a real constraint, not
 * a formality: at most one request per second, no bulk querying, and an identifiable client. The
 * per-second limit is why every caller must debounce — see `SEARCH_DEBOUNCE_MS` in `AddressField` —
 * and `limit=5` keeps a single answer small. A browser cannot set `User-Agent`, so the identification
 * Nominatim actually sees is the `Referer` the browser sends on its own; that is the documented
 * arrangement for web front ends and the reason there is no header here to forget.
 *
 * The map is the official `export/embed.html` frame rather than a Leaflet canvas. It costs no
 * dependency, carries OSM's own attribution inside the frame, and has nothing to resize or invalidate
 * when its container changes — a map library would need all three plus a jsdom shim to be testable.
 */
const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search'
const OSM_EMBED = 'https://www.openstreetmap.org/export/embed.html'

/** Nominatim's own cap is 50; five is what fits under a text field without becoming a page. */
export const MAX_RESULTS = 5

/** Half the side of the box the embed frames around a point, in degrees — roughly 450 m at Italian latitudes. */
export const DELTA_BBOX = 0.004

/**
 * The province is read from `ISO3166-2-lvl6`, not from `county`.
 *
 * Level 6 is the Italian province and its value is already the code the form wants, prefixed with the
 * country: `IT-MI`. `county` is the province's *name*, and it arrives spelled in whichever way the
 * mappers wrote it — `Milano`, `Città Metropolitana di Milano` — with no way to reach `MI` from it.
 */
const ISO_PROVINCE = 'ISO3166-2-lvl6'

/**
 * A city is tagged by size, not by role: a city is `city`, a small town `town`, a village `village`.
 * One of the three is present, never more than one, and which one is not something an address form
 * can care about.
 */
const CITY_KEYS = ['city', 'town', 'village'] as const

/**
 * Every field defaults to the empty string because `addressdetails` omits what it does not know rather
 * than sending it null — a rural address has no `house_number` key at all. Unknown keys are dropped:
 * zod objects strip by default, and Nominatim sends a dozen this form has no use for.
 */
const addressSchema = z.object({
	road: z.string().default(''),
	house_number: z.string().default(''),
	postcode: z.string().default(''),
	city: z.string().default(''),
	town: z.string().default(''),
	village: z.string().default(''),
	[ISO_PROVINCE]: z.string().default('')
})

/** `lat` and `lon` arrive as strings — `"45.4642035"` — which is why they are coerced and not declared numeric. */
const resultSchema = z.object({
	place_id: z.coerce.string(),
	display_name: z.string(),
	lat: z.coerce.number(),
	lon: z.coerce.number(),
	address: addressSchema.optional()
})

const responseSchema = z.array(resultSchema)

/** The shape an empty `address` parses to, so the mapping below has no undefined to branch on. */
const EMPTY_ADDRESS = addressSchema.parse({})

/** One geocoded address, flattened into the four fields the personalData stores. */
export interface FoundAddress {
	/** Nominatim's own id for the place — a stable React key, and nothing else. */
	readonly id: string
	/** The full one-line address, as OSM writes it. What the suggestion list shows. */
	readonly label: string
	/** Street and house number, in Italian order: `Via Roma 1`. */
	readonly street: string
	readonly postalCode: string
	readonly city: string
	/** The two-letter province code, upper-case: `MI`. Empty when OSM has no province for the point. */
	readonly province: string
	readonly lat: number
	readonly lon: number
}

type AddressOsm = z.infer<typeof addressSchema>

const cityDi = (address: AddressOsm): string => CITY_KEYS.map((key) => address[key]).find((v) => v !== '') ?? ''

const map = (result: z.infer<typeof resultSchema>): FoundAddress => {
	const address = result.address ?? EMPTY_ADDRESS

	return {
		id: result.place_id,
		label: result.display_name,
		// Filtered before joining: a road with no house number must not come back with a trailing space,
		// and a point with neither must be the empty string the form treats as "nothing found".
		street: [address.road, address.house_number].filter((part) => part !== '').join(' '),
		postalCode: address.postcode,
		city: cityDi(address),
		// `IT-MI` → `MI`. An absent code is the empty string, and `''.slice(-2)` is `''`.
		province: address[ISO_PROVINCE].slice(-2),
		lat: result.lat,
		lon: result.lon
	}
}

/**
 * Geocodes free text through Nominatim.
 *
 * Restricted to Italy: every field around it — a five-digit postal code, a two-letter province — is an Italian
 * address, so a Roman street in Texas is noise the owner has to read past. `signal` is required
 * rather than optional because the caller types faster than the network answers, and an unaborted
 * earlier request can land after a later one and overwrite the newer suggestions with older ones.
 *
 * Throws on anything that is not a well-formed answer. There is nothing useful a caller could do with
 * a partial one, and the field reports the failure rather than silently showing no matches — which
 * reads as "this address does not exist".
 */
export const searchAddresses = async (query: string, signal: AbortSignal): Promise<FoundAddress[]> => {
	const params = new URLSearchParams({
		q: query,
		format: 'jsonv2',
		addressdetails: '1',
		limit: String(MAX_RESULTS),
		countrycodes: 'it',
		'accept-language': 'it'
	})

	const response = await fetch(`${NOMINATIM_SEARCH}?${params.toString()}`, { signal })
	if (!response.ok) throw new Error(`Nominatim ha risposto ${String(response.status)}`)

	return responseSchema.parse(await response.json()).map(map)
}

/**
 * The embed URL for a map framed on one point, with a marker on it.
 *
 * The box is built from a fixed delta rather than from Nominatim's own `boundingbox`, which is the
 * extent of the *matched object*: a house is a few metres across and a city is kilometres, so
 * following it would swing the zoom wildly between two suggestions in the same list. A constant box
 * means the map always answers the same question — what is around this address.
 *
 * Fixed to five decimals (about a metre) so the URL is a pure function of the point: binary floating
 * point would otherwise write `9.190000000000001` into it and change the frame's `src` for nothing.
 */
export const urlMap = (lat: number, lon: number): string => {
	const bbox = [lon - DELTA_BBOX, lat - DELTA_BBOX, lon + DELTA_BBOX, lat + DELTA_BBOX]
		.map((degree) => degree.toFixed(5))
		.join(',')

	return `${OSM_EMBED}?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(5)},${lon.toFixed(5)}`
}
