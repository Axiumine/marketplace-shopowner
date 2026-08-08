import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { OK_DURATION, Toast } from '@/components/ui/Toast'

const close = async () => {
	await userEvent.click(screen.getByRole('button', { name: 'Close' }))
}

const toast = () => screen.queryByText('Changes saved.')

/**
 * The countdown bar, by the only thing that identifies it: the one-pixel track under the message. Not by
 * `aria-hidden`, which the cross's glyph carries too, and not by a test id — the app has none.
 */
const bar = (inside: HTMLElement) => inside.querySelector('.h-1 > div')

/**
 * ⚠️ Ends the countdown by hand, because **jsdom runs no animations**: it keeps the properties, it never
 * plays them, and `animationend` is therefore never dispatched here the way a browser dispatches it. The
 * event is the toast's only clock, so a test that waited for it would wait forever. What is asserted for
 * real is everything around it — that the bar carries a five-second linear animation, that pausing marks
 * it paused, and that the end of it closes the toast.
 */
const finish = (inside: HTMLElement) => {
	fireEvent.animationEnd(bar(inside) as Element)
}

describe('Toast', () => {
	// The stack is a plain node on `document.body`, outside whatever RTL rendered — which is the point of
	// it. A toast rendered from a card three levels down still lands in the corner of the page rather than
	// inside that card's layout.
	it('renders into a stack outside its own container', () => {
		const { container } = render(<Toast tone="success">Changes saved.</Toast>)

		expect(container).toBeEmptyDOMElement()

		const stack = document.getElementById('toast-stack')
		expect(stack).not.toBeNull()
		expect(stack).toContainElement(toast())

		// Spelled out whole, because the stack is built once and then reused: every later toast finds the
		// node already there and never runs the line that dresses it. Only the first one can state what it
		// was dressed with — fixed in the corner, above everything, and transparent to the pointer so a
		// message floating over a form does not swallow a click meant for the field under it.
		expect(stack?.className).toBe('pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-2')
	})

	// Vertically, in mount order, and in one stack rather than one per toast: two messages have to be
	// readable at once, and a second corner would be a second thing to look for.
	it('stacks several messages in one column, in the order they appeared', () => {
		render(
			<>
				<Toast tone="error">Save failed.</Toast>
				<Toast tone="success">Changes saved.</Toast>
			</>
		)

		const stack = document.getElementById('toast-stack') as HTMLElement

		expect(stack).toHaveClass('flex', 'flex-col')
		expect(stack.textContent).toBe('Save failed.Changes saved.')
	})

	// Assertive for a refusal, polite for a confirmation — the same split `Alert` makes, and for the same
	// reason: "saved" interrupting whatever a screen reader is saying is not worth the interruption.
	it('announces an error assertively and everything else politely', () => {
		render(
			<>
				<Toast tone="error">Save failed.</Toast>
				<Toast tone="success">Changes saved.</Toast>
				<Toast tone="info">No change.</Toast>
			</>
		)

		expect(screen.getByRole('alert')).toHaveTextContent('Save failed.')
		expect(screen.getAllByRole('status').map((node) => node.textContent)).toEqual(['Changes saved.', 'No change.'])
	})

	/*
	 * Five seconds, linear, and held at the end rather than snapping back — spelled out here rather than
	 * compared against `DURATION_OK`, since a constant asserted against itself passes whatever it holds and
	 * five seconds is the actual requirement.
	 *
	 * `forwards` is not cosmetic. The animation is the clock: the toast closes on `animationend`, and
	 * without the fill mode the bar would jump back to full width for the frame between the end of the
	 * animation and the re-render that unmounts it.
	 */
	it('draws a five-second linear countdown under a confirmation', () => {
		render(<Toast tone="success">Changes saved.</Toast>)

		expect(bar(screen.getByRole('status'))).toHaveStyle({
			animationName: 'countdown',
			animationDuration: '5000ms',
			animationTimingFunction: 'linear',
			animationFillMode: 'forwards',
			animationPlayState: 'running'
		})
		expect(OK_DURATION).toBe(5000)
	})

	// A width driven from React would move in whatever steps the re-render rate allows; the browser
	// interpolates a transform on its own thread, which is what makes the bar fluid — and free.
	it('animates the bar with a transform, not a width', () => {
		render(<Toast tone="success">Changes saved.</Toast>)

		const track = bar(screen.getByRole('status')) as HTMLElement

		expect(track).toHaveClass('origin-left')
		expect(track.style.width).toBe('')
	})

	it('closes a confirmation when its countdown runs out', () => {
		render(<Toast tone="success">Changes saved.</Toast>)

		finish(screen.getByRole('status'))

		expect(toast()).not.toBeInTheDocument()
	})

	/*
	 * ⚠️ The pause is not "add five more seconds": `animation-play-state: paused` stops the bar where it
	 * stands and postpones the end of the animation by exactly as long, so the toast resumes with whatever
	 * it had left. That is the whole reason the animation is the clock rather than a picture of one — a
	 * `setTimeout` beside it would need that arithmetic written out, and could then disagree with the bar.
	 */
	it('pauses the countdown while the pointer is on it, and resumes it on the way out', async () => {
		render(<Toast tone="success">Changes saved.</Toast>)

		await userEvent.hover(screen.getByRole('status'))
		expect(bar(screen.getByRole('status'))).toHaveStyle({ animationPlayState: 'paused' })

		await userEvent.unhover(screen.getByRole('status'))
		expect(bar(screen.getByRole('status'))).toHaveStyle({ animationPlayState: 'running' })
	})

	// Focus pauses it too, and has to: the cross is a tab stop, so a toast that kept counting under a
	// keyboard user would close between the tab and the press.
	it('pauses the countdown while something inside it has focus', () => {
		render(<Toast tone="success">Changes saved.</Toast>)

		fireEvent.focus(screen.getByRole('button', { name: 'Close' }))
		expect(bar(screen.getByRole('status'))).toHaveStyle({ animationPlayState: 'paused' })

		fireEvent.blur(screen.getByRole('button', { name: 'Close' }))
		expect(bar(screen.getByRole('status'))).toHaveStyle({ animationPlayState: 'running' })
	})

	it('closes a confirmation immediately when the cross is pressed', async () => {
		render(<Toast tone="success">Changes saved.</Toast>)

		await close()

		expect(toast()).not.toBeInTheDocument()
	})

	/*
	 * The asymmetry this component exists for. A confirmation has been read by the time it is understood;
	 * a refusal names something that did not happen, and one that faded on its own would leave a page that
	 * looks saved and is not. So there is no bar — and since the bar is the clock, nothing that could
	 * close it either.
	 */
	it('draws no countdown for an error, and so has nothing to close it', () => {
		render(<Toast tone="error">Save failed.</Toast>)

		expect(bar(screen.getByRole('alert'))).toBeNull()
		expect(screen.getByText('Save failed.')).toBeInTheDocument()
	})

	it('closes an error when the cross is pressed', async () => {
		render(<Toast tone="error">Save failed.</Toast>)

		await close()

		expect(screen.queryByText('Save failed.')).not.toBeInTheDocument()
	})

	// An info toast is neither: no clock, like the error, and the polite role, like the confirmation.
	it('draws no countdown for an info message', () => {
		render(<Toast tone="info">No change.</Toast>)

		expect(bar(screen.getByRole('status'))).toBeNull()
		expect(screen.getByText('No change.')).toBeInTheDocument()
	})

	// The third tone's colours, which the two snapshots below never see. Opaque like the others — a toast
	// floats over the page, and a tinted background over a form is the form read through a filter.
	it('dresses an info message in the neutral tone', () => {
		render(<Toast tone="info">No change.</Toast>)

		expect(screen.getByRole('status')).toHaveClass('border-third', 'bg-palette-white', 'text-palette-bg')
	})

	it('renders', () => {
		render(<Toast tone="success">Changes saved.</Toast>)
		expect(screen.getByRole('status')).toMatchSnapshot()
	})

	it('renders an error', () => {
		render(<Toast tone="error">Save failed.</Toast>)
		expect(screen.getByRole('alert')).toMatchSnapshot()
	})
})
