import { urlMap } from '@/lib/nominatim'

/**
 * OpenStreetMap framed on one point, with a marker on it, and the attribution the licence asks for.
 *
 * An embed frame and not a map library: it costs no dependency, carries OSM's own controls and copyright
 * inside the frame, and has nothing to resize or invalidate when its container changes — Leaflet would
 * need all three plus a jsdom shim before any of this could be tested.
 *
 * `title` is required rather than defaulted because a page can hold several of these — one per shop —
 * and an iframe's accessible name is its `title`. Frames that all announce "map" are a list nobody can
 * choose from, and the one thing that tells them apart is the address each is pointing at.
 */
export const AddressMap = ({ lat, lon, title }: { lat: number; lon: number; title: string }) => (
	<>
		{/* The 400 px is the frame's own `height` attribute rather than a utility class. An iframe is a
		    replaced element and defaults to 150 px, so a stylesheet that has not arrived yet — or a class
		    overridden downstream — collapses the map and reflows everything under it. The attribute is the
		    size the element has before any CSS applies. */}
		<iframe title={title} src={urlMap(lat, lon)} height={400} className="w-full rounded-box border border-tip" />
		<p className="text-xs text-tip">
			Map data ©{' '}
			<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">
				OpenStreetMap
			</a>{' '}
			contributors
		</p>
	</>
)
