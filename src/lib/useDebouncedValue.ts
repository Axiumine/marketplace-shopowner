import { useEffect, useState } from 'react'

/**
 * Holds a value back until it has stopped changing for `delay` milliseconds.
 *
 * Used by the shopOwners search box. Search is a server round-trip, so sending one request per
 * keystroke would put a Mongo query behind every character the owner types. Debouncing is what makes
 * server-side search affordable; the alternative — filtering a fully downloaded collection in the
 * browser — costs the whole table on every page load instead.
 *
 * The cleanup clears the pending timer, so the value only ever settles on the last input.
 */
export const useDebouncedValue = <T>(value: T, delay: number): T => {
	const [debounced, setDebounced] = useState(value)

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebounced(value)
		}, delay)

		return () => {
			clearTimeout(timer)
		}
	}, [value, delay])

	return debounced
}
