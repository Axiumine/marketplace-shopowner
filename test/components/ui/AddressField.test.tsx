import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AddressField, MIN_LENGTH, SEARCH_DEBOUNCE_MS } from '@/components/ui/AddressField'
import type { FoundAddress } from '@/lib/nominatim'

import { installOsm, resultOsm } from '../../helpers/nominatim'

const BOSTON = resultOsm()

const SALEM = resultOsm({
	place_id: 12,
	display_name: 'Oak Avenue, 4, Salem, MA, 01970, USA',
	lat: '42.51950',
	lon: '-70.89670',
	address: { road: 'Oak Avenue', house_number: '4', postcode: '01970', city: 'Salem', 'ISO3166-2-lvl4': 'US-MA' }
})

/**
 * The field is controlled from outside — the form owns the address text — so the test owns it too.
 *
 * Picking a suggestion writes the chosen address back into the box, which is what both real call sites
 * do with `setValue` and what makes the "do not search for what was just picked" rule reachable at all:
 * without the write-back the value never changes and the round-trip it skips never comes round.
 *
 * ⚠️ `compose` is what the two of them disagree on, and the disagreement is the whole reason the rule
 * cannot be a comparison against the box's text. `ShopOwnerAddForm` writes the street and puts the
 * postal code, city and province in boxes of their own; the shop panel has one box and writes the composed
 * line into it. Both are "the address that was just picked" and neither can be recognised as such by
 * looking at it.
 */
const Host = ({
	onSelect = () => undefined,
	compose = (address) => address.street,
	valueInitial = '',
	initialCenter
}: {
	onSelect?: (address: FoundAddress) => void
	compose?: (address: FoundAddress) => string
	valueInitial?: string
	initialCenter?: { lat: number; lon: number }
}) => {
	const [value, setValue] = useState(valueInitial)

	return (
		<AddressField
			label="Address"
			value={value}
			initialCenter={initialCenter}
			onChange={(event) => {
				setValue(event.target.value)
			}}
			onSelect={(address) => {
				setValue(compose(address))
				onSelect(address)
			}}
		/>
	)
}

/** The composed line the shop panel writes back — street, postal code, city and province code, on one line. */
const composed = (address: FoundAddress) => `${address.street}, ${address.postalCode} ${address.city} (${address.province})`

// Fake timers throughout: the debounce is the component's whole rhythm, and waiting 700 ms of wall
// clock per assertion would make this file the slowest in the suite for no added confidence.
beforeEach(() => {
	vi.useFakeTimers()
})

afterEach(() => {
	vi.useRealTimers()
})

const write = (text: string) => {
	fireEvent.change(screen.getByLabelText('Address'), { target: { value: text } })
}

/** Runs out the debounce and lets the request that follows settle. */
const awaitSearch = async () => {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS)
	})
}

const map = () => screen.getByTitle('Address map')

describe('AddressField', () => {
	it('renders the country centre before anything is typed', () => {
		installOsm()
		const { container } = render(<Host />)

		expect(map().getAttribute('src')).toContain('marker=39.82830,-98.57950')
		expect(container).toMatchSnapshot()
	})

	/*
	 * Nominatim is a donated service with a one-request-per-second policy, so the two guards that keep
	 * requests off it are behaviour, not optimisation.
	 *
	 * The padded value is the one that matters: `'  Oak  '` is seven characters and three letters, and a
	 * length check that forgot to trim would spend a request on a box that looks empty.
	 */
	it.each(['Oak', '  Oak  '])('does not geocode %o — too short to be an address', async (text) => {
		const osm = installOsm({ results: [BOSTON] })
		render(<Host />)

		write(text)
		await awaitSearch()

		expect(osm.calls).toHaveLength(0)
		expect(screen.queryByRole('list')).not.toBeInTheDocument()
	})

	// Exactly at the minimum, which is the boundary the guard is written on: `Main` is four characters
	// and is geocodable.
	it('geocodes a value exactly at the minimum length', async () => {
		const osm = installOsm({ results: [BOSTON] })
		render(<Host />)

		expect(MIN_LENGTH).toBe(4)
		write('Main')
		await awaitSearch()

		expect(osm.calls).toHaveLength(1)
	})

	it('waits for the typing to stop before spending a request', async () => {
		const osm = installOsm({ results: [BOSTON] })
		render(<Host />)

		write('Main Str')
		await act(async () => {
			await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 1)
		})
		expect(osm.calls).toHaveLength(0)
		// And says nothing while it waits: the spinner means a request is out, not that the operator paused
		// between two words. One that appears on the first keystroke is on screen for the whole address.
		expect(screen.queryByRole('status')).not.toBeInTheDocument()

		write('1 Main Street')
		await awaitSearch()

		expect(osm.calls).toHaveLength(1)
		expect(osm.calls[0]).toContain('q=1+Main+Street')
	})

	it('shows the suggestions OSM answered with', async () => {
		installOsm({ results: [BOSTON, SALEM] })
		const { container } = render(<Host />)

		write('1 Main Street')
		await awaitSearch()

		const suggestions = screen.getAllByRole('button')
		expect(suggestions.map((b) => b.textContent)).toEqual([
			'Main Street, 1, Boston, MA, 02108, USA',
			'Oak Avenue, 4, Salem, MA, 01970, USA'
		])
		expect(container).toMatchSnapshot()
	})

	it('announces the wait while the geocoder is answering', async () => {
		installOsm({ pending: true })
		const { container } = render(<Host />)

		write('1 Main Street')
		await awaitSearch()

		expect(screen.getByRole('status')).toHaveTextContent('Searching addresses')
		expect(container).toMatchSnapshot()
	})

	// The map follows the best match as the address is typed, before anything is picked — that is what
	// "the map updates as you write" means, and it is the only feedback that says the geocoder
	// understood the address.
	it('moves the map onto the best match while the address is being typed', async () => {
		installOsm({ results: [BOSTON, SALEM] })
		render(<Host />)

		write('1 Main Street')
		await awaitSearch()

		expect(map().getAttribute('src')).toContain('marker=42.36010,-71.05890')
	})

	it('says so when the address matches nothing', async () => {
		installOsm({ results: [] })
		const { container } = render(<Host />)

		write('99 Nowhere Street')
		await awaitSearch()

		expect(screen.getByRole('status')).toHaveTextContent('No address found')
		expect(screen.queryByRole('list')).not.toBeInTheDocument()
		expect(container).toMatchSnapshot()
	})

	// 429 is what a client over the usage limit gets. "Nothing found" would be a lie: the address may
	// well exist and nobody asked.
	it('reports a geocoder failure instead of pretending there are no matches', async () => {
		installOsm({ status: 429, body: 'Too Many Requests' })
		const { container } = render(<Host />)

		write('1 Main Street')
		await awaitSearch()

		expect(screen.getByRole('alert')).toHaveTextContent('Address search unavailable')
		expect(container).toMatchSnapshot()
	})

	/*
	 * The request the operator has already typed past is abandoned, and abandoning it is what keeps the
	 * answers in order.
	 *
	 * Nominatim answers a vague address slowly and a precise one quickly, so the slow answer to `Main
	 * Street` can land well after the quick one to `4 Oak Avenue Salem` — and a client that lets both through
	 * shows the older matches last, over the newer ones, with the map on a city the operator has
	 * finished correcting.
	 */
	it('lets the newer answer win over an older one still in flight', async () => {
		installOsm([{ results: [BOSTON], delay: 3000 }, { results: [SALEM] }])
		render(<Host />)

		write('Main Street')
		await awaitSearch()

		write('4 Oak Avenue Salem')
		await awaitSearch()

		// Where the first answer would have landed, had it not been given up on.
		await act(async () => {
			await vi.advanceTimersByTimeAsync(3000)
		})

		expect(screen.getByRole('button', { name: 'Oak Avenue, 4, Salem, MA, 01970, USA' })).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Main Street, 1, Boston, MA, 02108, USA' })).not.toBeInTheDocument()
		expect(map().getAttribute('src')).toContain('marker=42.51950,-70.89670')
	})

	/*
	 * Giving a request up is not a failure, and must not be reported as one.
	 *
	 * Deleting back to something too short to geocode is the case that shows it: the request in flight is
	 * abandoned and nothing replaces it, so an abandonment mistaken for a failure has the field sitting
	 * there with "search unavailable" under an almost-empty box.
	 */
	it('does not report the request it abandoned itself', async () => {
		installOsm({ pending: true })
		render(<Host />)

		write('Main Street')
		await awaitSearch()
		expect(screen.getByRole('status')).toHaveTextContent('Searching addresses')

		write('Oak')
		await awaitSearch()

		expect(screen.queryByRole('alert')).not.toBeInTheDocument()
		expect(screen.queryByRole('status')).not.toBeInTheDocument()
	})

	/*
	 * And leaves nothing behind either, which is the half the test above cannot see. What the catch would
	 * write is keyed by the query it belonged to, and a query too short to geocode shows no state at all —
	 * so a failure recorded for the abandoned request stays hidden exactly until that query comes back. An
	 * operator who deletes a word and types it again is asking the same question, and would be told the
	 * geocoder is down while the fresh request for it is still in flight.
	 */
	it('does not report it later either, when the abandoned query is typed again', async () => {
		installOsm({ pending: true })
		render(<Host />)

		write('Main Street')
		await awaitSearch()

		write('Oak')
		await awaitSearch()

		write('Main Street')
		await awaitSearch()

		expect(screen.queryByRole('alert')).not.toBeInTheDocument()
		expect(screen.getByRole('status')).toHaveTextContent('Searching addresses')
	})

	it('hands the whole geocoded address up and closes the list when one is picked', async () => {
		installOsm({ results: [BOSTON, SALEM] })
		const onSelect = vi.fn()
		render(<Host onSelect={onSelect} />)

		write('Main Street')
		await awaitSearch()
		fireEvent.click(screen.getByRole('button', { name: 'Oak Avenue, 4, Salem, MA, 01970, USA' }))

		expect(onSelect).toHaveBeenCalledWith({
			id: '12',
			label: 'Oak Avenue, 4, Salem, MA, 01970, USA',
			street: '4 Oak Avenue',
			postalCode: '01970',
			city: 'Salem',
			province: 'MA',
			lat: 42.5195,
			lon: -70.8967
		})
		expect(screen.queryByRole('list')).not.toBeInTheDocument()
	})

	it('leaves the map on the address that was picked, not on the best match', async () => {
		installOsm({ results: [BOSTON, SALEM] })
		render(<Host />)

		write('Main Street')
		await awaitSearch()
		fireEvent.click(screen.getByRole('button', { name: 'Oak Avenue, 4, Salem, MA, 01970, USA' }))

		expect(map().getAttribute('src')).toContain('marker=42.51950,-70.89670')
	})

	/*
	 * Picking writes the chosen address into the box, which is a change like any other and would come
	 * back round as a search for the address that was just chosen — reopening the list under it and
	 * spending a second request to be told what the operator already accepted.
	 */
	it('does not geocode the address it just filled in', async () => {
		const osm = installOsm({ results: [BOSTON] })
		render(<Host />)

		write('main street boston')
		await awaitSearch()
		fireEvent.click(screen.getByRole('button', { name: 'Main Street, 1, Boston, MA, 02108, USA' }))
		await awaitSearch()

		expect(osm.calls).toHaveLength(1)
		expect(screen.queryByRole('list')).not.toBeInTheDocument()
	})

	/*
	 * ⚠️ The same rule, for a form that writes back something other than the street.
	 *
	 * This is the one that broke: the guard used to be "is the box holding the street of the address that
	 * was picked", which the shop panel's composed line never is. The list came back a second after the
	 * pick, under a box already holding the answer — a second address input, in a card whose whole point
	 * is having one.
	 *
	 * There is no comparison to fix here, because none can work: what the form writes back is the form's
	 * business. Only the keyboard is geocoded, and a pick is not the keyboard.
	 */
	it('does not geocode what a form writes back, whatever it writes', async () => {
		const osm = installOsm({ results: [BOSTON] })
		render(<Host compose={composed} />)

		write('main street boston')
		await awaitSearch()
		fireEvent.click(screen.getByRole('button', { name: 'Main Street, 1, Boston, MA, 02108, USA' }))

		expect(screen.getByLabelText('Address')).toHaveValue('1 Main Street, 02108 Boston (MA)')
		expect(screen.queryByRole('list')).not.toBeInTheDocument()
		// Nothing at all under the box, not even the spinner. The debounce is still holding the text that led
		// to the pick, and a field that reads that instead of the keyboard starts searching for it.
		expect(screen.queryByRole('status')).not.toBeInTheDocument()

		await awaitSearch()

		expect(osm.calls).toHaveLength(1)
		expect(screen.queryByRole('list')).not.toBeInTheDocument()
	})

	// And it stays shut for as long as nobody types: the debounce has nothing left to settle onto, so no
	// number of ticks brings the list back.
	it('leaves the list shut until something is typed again', async () => {
		const osm = installOsm({ results: [BOSTON] })
		render(<Host compose={composed} />)

		write('main street boston')
		await awaitSearch()
		fireEvent.click(screen.getByRole('button', { name: 'Main Street, 1, Boston, MA, 02108, USA' }))
		await awaitSearch()
		await awaitSearch()

		expect(osm.calls).toHaveLength(1)
		expect(screen.queryByRole('list')).not.toBeInTheDocument()

		write('1 Main Street, 02108 Boston (MA) 2')
		await awaitSearch()

		expect(osm.calls).toHaveLength(2)
		expect(screen.getByRole('list')).toBeInTheDocument()
	})

	/*
	 * A form editing an address that already exists hands the field its text, and that text is not
	 * something anybody typed. Geocoding it would open a list of suggestions over an address nobody asked
	 * about, and spend a request on a donated service to do it.
	 */
	it('does not geocode the address it was opened with', async () => {
		const osm = installOsm({ results: [BOSTON] })
		render(<Host valueInitial="Green Street 8, 20100 Boston (MA)" />)

		await awaitSearch()

		expect(osm.calls).toHaveLength(0)
		expect(screen.queryByRole('list')).not.toBeInTheDocument()
	})

	// The shop the editor was opened on, and not the middle of the country: the position exists, the card was
	// drawing it a moment ago, and the first four characters typed are no reason to lose it.
	it('frames the map on the point it was given until the geocoder answers', async () => {
		installOsm({ results: [SALEM] })
		render(<Host initialCenter={{ lat: 42.3601, lon: -71.06 }} />)

		expect(map().getAttribute('src')).toContain('marker=42.36010,-71.06000')

		write('4 Oak Avenue Salem')
		await awaitSearch()

		expect(map().getAttribute('src')).toContain('marker=42.51950,-70.89670')
	})
})
