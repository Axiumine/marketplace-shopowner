import type { ChangeEventHandler, InputHTMLAttributes, Ref } from 'react'
import { useEffect, useState } from 'react'

import { AddressMap } from '@/components/ui/AddressMap'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { TextField } from '@/components/ui/TextField'
import type { FoundAddress } from '@/lib/nominatim'
import { searchAddresses } from '@/lib/nominatim'
import { useDebouncedValue } from '@/lib/useDebouncedValue'

/**
 * Longer than the table's 300 ms search, on purpose: that one hits our own Mongo, this one hits
 * Nominatim, whose usage policy allows one request per second per client. A street name is typed in
 * bursts, and 700 ms is the pause between words rather than between keystrokes.
 */
export const SEARCH_DEBOUNCE_MS = 700

/** Below this nothing is geocodable — `Via` matches every street in the country. */
export const MIN_LENGTH = 4

/** Rome. What the map frames when there is nothing else to frame, so the frame is never blank. */
const ITALY_CENTER = { lat: 41.9028, lon: 12.4964 }

/** A point the map can be framed on. Same two names the geocoder answers with. */
interface Point {
	readonly lat: number
	readonly lon: number
}

/**
 * What sits between the box and the map. `null` is "nothing to say" — too short to geocode, or picked.
 *
 * The matches live *inside* the state rather than beside it, because a list and a flag saying whether
 * to show it are two ways to be wrong: an error arriving after a hit would clear the flag and leave the
 * old matches behind it, ready to reappear under the next address the moment anything set the flag back.
 */
type Outcome =
	| { readonly type: 'searching' }
	| { readonly type: 'trovati'; readonly results: readonly FoundAddress[] }
	| { readonly type: 'vuoto' }
	| { readonly type: 'error' }

/**
 * What the geocoder said, and which query it said it about.
 *
 * Tagged, because an answer outlives its question: the owner deletes half the address and the matches
 * for what used to be there are still in state, correct about a query nobody is asking any more.
 */
interface Response {
	readonly query: string
	readonly outcome: Outcome
}

/** Below `MIN_LENGTH` nothing is worth a request. `trim`, because four spaces are not an address. */
const geocodable = (text: string): boolean => text.trim().length >= MIN_LENGTH

/**
 * What sits under the box: the answer to what is being asked, the wait for it, or nothing at all.
 *
 * All three are read off what is already known, and none of them is a state of its own. That matters
 * beyond tidiness — the alternative is writing "sto cercando" from inside the effect that starts the
 * request, and a synchronous write there is a second render for every keystroke that survives the
 * debounce, which is what `react-hooks/set-state-in-effect` is about.
 *
 * The three questions, in order:
 *
 * 1. Is there anything in the box worth geocoding? A pick empties `digitato` — the box then holds
 *    whatever the *form* wrote, which is not something anybody typed — so a pick closes the list here,
 *    and it stays closed until a key is pressed.
 * 2. Has the geocoder answered the query being asked? Then that answer, whatever it was. While the
 *    typing runs ahead of the debounce this is still the *previous* query, and its matches stay on
 *    screen rather than blinking out between two keystrokes.
 * 3. Otherwise a request is either in flight or about to be: the wait — but only once the debounce has
 *    caught up, so the spinner marks a request and not a pause in typing.
 */
const outcomeOf = (typed: string, query: string, response: Response | null): Outcome | null => {
	if (!geocodable(typed)) return null
	if (response?.query === query) return response.outcome

	return geocodable(query) ? { type: 'searching' } : null
}

/*
 * `onSelect` is omitted from the input's own props, not just shadowed: the DOM has an `onSelect` of its
 * own — text being highlighted inside the box — and a prop of the same name with a different signature
 * is a type error rather than an override. The DOM one has no use here, and losing it is what lets the
 * meaningful name stay on the meaningful event.
 */
interface AddressFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onSelect' | 'onChange'> {
	label: string
	/** The address text. Controlled by the form: picking a suggestion rewrites it from the outside. */
	value: string
	error?: string | undefined
	/**
	 * Required, unlike the DOM's own.
	 *
	 * It is not just passed through — the field listens to it, because what the *keyboard* put in the box
	 * is the only thing worth geocoding and it is the one thing `value` cannot tell apart from what the
	 * form wrote back after a pick.
	 */
	onChange: ChangeEventHandler<HTMLInputElement>
	/** Called with the whole geocoded address, so the form can fill postal code, city and province from it. */
	onSelect: (address: FoundAddress) => void
	/**
	 * Where to frame the map before anything is typed. Rome when nothing is given.
	 *
	 * For a form editing an address that already exists: the shop is somewhere, the map knows where, and
	 * opening the editor on the middle of Italy loses that for no reason. A form creating one passes
	 * nothing, because there is nothing to pass.
	 */
	initialCenter?: Point | null | undefined
	ref?: Ref<HTMLInputElement>
}

const HINT_CLASS =
	'w-full rounded-box px-3 py-2 text-left text-sm hover:bg-palette-bg1 focus-visible:bg-palette-bg1 focus-visible:outline-none'

/**
 * An address box that geocodes what is typed into it: suggestions from OpenStreetMap underneath, and a
 * map of the current best match under those.
 *
 * The suggestions are a list of buttons, not an ARIA combobox. A combobox is a contract — arrow keys
 * move a virtual focus, `aria-activedescendant` follows it, Escape collapses the popup — and half of
 * it implemented is worse than none: the role promises a keyboard model that is not there. Buttons in
 * a labelled list are reachable by Tab, announce themselves, and lie about nothing.
 *
 * The component never writes the four address fields itself. It reports a pick through `onSelect` and
 * the form decides what to do with it — which is what keeps one component serving both the shopOwner's
 * home address and the company's legal seat, where the same OSM answer lands in different fields.
 */
export const AddressField = ({
	label,
	value,
	error,
	onChange,
	onSelect,
	initialCenter = null,
	className = '',
	ref,
	...rest
}: AddressFieldProps) => {
	const [response, setResponse] = useState<Response | null>(null)
	const [point, setPoint] = useState<FoundAddress | null>(null)

	/**
	 * What the keyboard has put in the box since the last pick, and the only thing ever geocoded.
	 *
	 * ⚠️ Not `value`. The box is controlled by the form, and the form writes to it twice: once as the
	 * owner types, and again when a pick is accepted — and that second write came *from* the geocoder.
	 * Searching for it reopens the list under an address that was already chosen, asking OSM to confirm
	 * what it just said. Which of the two a given `value` is cannot be read off the value itself: it
	 * depends on what the form chose to write, and the two forms using this field write different things
	 * — a street here, the whole composed line there.
	 *
	 * Reset to empty by a pick rather than left holding the text that led to it. That is what closes the
	 * list for good: nothing is typed, so there is nothing to search for, and a debounce still in flight
	 * from before the pick settles onto the empty string instead of reopening the list behind it.
	 */
	const [typed, setTyped] = useState('')
	const query = useDebouncedValue(typed, SEARCH_DEBOUNCE_MS)

	const outcome = outcomeOf(typed, query, response)

	useEffect(() => {
		if (!geocodable(query)) return

		const controller = new AbortController()

		searchAddresses(query, controller.signal)
			.then((found) => {
				const first = found[0]
				if (first === undefined) {
					setResponse({ query, outcome: { type: 'vuoto' } })
					return
				}

				// The map follows the best match as the address is typed, before anything is picked.
				setPoint(first)
				setResponse({ query, outcome: { type: 'trovati', results: found } })
			})
			.catch(() => {
				// An aborted request is this effect's own cleanup, not a failure: the owner typed another
				// character. Reporting it would flash "search unavailable" between two keystrokes.
				if (controller.signal.aborted) return

				setResponse({ query, outcome: { type: 'error' } })
			})

		// Aborting is what keeps the answers in order. Without it a slow request for `Via Rom` can land
		// after a fast one for `Via Roma 1` and replace the newer suggestions with older ones.
		return () => {
			controller.abort()
		}
	}, [query])

	const choose = (address: FoundAddress) => {
		setTyped('')
		setPoint(address)
		setResponse(null)
		onSelect(address)
	}

	const center = point ?? initialCenter ?? ITALY_CENTER

	return (
		<div className={`flex flex-col gap-2 ${className}`}>
			<TextField
				label={label}
				error={error}
				value={value}
				autoComplete="off"
				ref={ref}
				onChange={(event) => {
					setTyped(event.target.value)
					onChange(event)
				}}
				{...rest}
			/>

			{outcome?.type === 'searching' ? <Spinner label="Searching addresses" /> : null}
			{outcome?.type === 'error' ? <Alert tone="error">Address search unavailable</Alert> : null}
			{outcome?.type === 'vuoto' ? (
				<p role="status" className="text-sm text-tip">
					No address found
				</p>
			) : null}
			{outcome?.type === 'trovati' ? (
				<ul aria-label="Addresses found" className="rounded-box border border-tip bg-white">
					{outcome.results.map((result) => (
						<li key={result.id} className="border-b border-palette-bg1 last:border-b-0">
							<button
								type="button"
								className={HINT_CLASS}
								onClick={() => {
									choose(result)
								}}
							>
								{result.label}
							</button>
						</li>
					))}
				</ul>
			) : null}

			<AddressMap lat={center.lat} lon={center.lon} title="Address map" />
		</div>
	)
}
