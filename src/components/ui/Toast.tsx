import type { ReactNode } from 'react'
import { useState } from 'react'
import { createPortal } from 'react-dom'

import type { AlertTone } from '@/components/ui/Alert'
import { IconButton } from '@/components/ui/IconButton'
import { IconX } from '@/components/ui/icons'

/** How long a confirmation stays up. Only the success tone counts down — see the component. */
export const OK_DURATION = 5000

/**
 * The stack every toast portals into, created on first use and then reused.
 *
 * A plain element appended to `document.body`, not a React-rendered provider. That choice is what lets
 * a toast be rendered by any component with no ancestor cooperating: there is nothing to mount at the
 * root, nothing to forget to mount, and a component tested on its own behaves exactly as it does inside
 * the app. The node is deliberately never removed — it holds no state, and tearing it down would only
 * create a window in which a toast has nowhere to go.
 *
 * `pointer-events-none` on the stack with `pointer-events-auto` on each toast: the column is as wide as
 * its widest message and spans the top-right corner, and without this it would swallow clicks on
 * whatever sits under the empty space beside a short one.
 */
const STACK_ID = 'pila-toast'

const stack = (): HTMLElement => {
	const existing = document.getElementById(STACK_ID)

	if (existing !== null) return existing

	const created = document.createElement('div')

	created.id = STACK_ID
	created.className = 'pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-2'
	document.body.appendChild(created)

	return created
}

/*
 * Opaque backgrounds, unlike `Alert`'s tinted ones: a toast floats over the page, and `bg-app-ok/10`
 * over a form is the form read through a green filter.
 */
const TONE_CLASS: Record<AlertTone, string> = {
	error: 'border-app-error bg-palette-white text-app-error',
	success: 'border-app-ok bg-palette-white text-app-ok',
	info: 'border-third bg-palette-white text-palette-bg'
}

/**
 * A floating message, stacked with the others in the top-right corner.
 *
 * Shown for as long as its parent renders it — the same declarative contract `Alert` has, and the
 * reason converting a call site is a one-word change. ⚠️ The corollary is that **a repeat of the same
 * message needs a remount**: a toast the owner dismissed stays dismissed while it is mounted, so a
 * condition that goes true, false, true shows it twice while one that simply stays true shows it once.
 * Every call site here is driven by a urql result, and urql clears a mutation's result when it is
 * executed again, which is what makes the round trip happen on its own.
 *
 * `role="alert"` for the error tone only, as in `Alert`: assertive is right for a refused save and
 * wrong for "salvato".
 *
 * ⚠️ Only the success tone counts down. A confirmation has been read by the time it is understood and
 * the owner has nothing left to do about it; a failure is the opposite — it names something that
 * did not happen, and one that faded on its own would leave a page that looks saved and is not. So an
 * error or an info toast gets no countdown bar — and since the bar is the clock, no clock either — and
 * goes away when the cross is pressed.
 */
export const Toast = ({ tone, children }: { tone: AlertTone; children: ReactNode }) => {
	const conTimer = tone === 'success'
	const [inPause, setInPause] = useState(false)
	const [closed, setClosed] = useState(false)
	// Read once, in a lazy initialiser rather than in an effect: the portal needs the node during the
	// first render, and creating it on every render would be a `getElementById` per keystroke elsewhere.
	const [node] = useState(stack)

	if (closed) return null

	return createPortal(
		<div
			role={tone === 'error' ? 'alert' : 'status'}
			className={`pointer-events-auto overflow-hidden rounded-box border shadow-lg ${TONE_CLASS[tone]}`}
			// The pause is what makes a five-second message readable: an owner who moves the mouse onto
			// it is reading it. Focus pauses it for the same reason and for a second one — the cross is a
			// tab stop, and a toast that closed under a keyboard user's fingers would throw focus back to
			// the body mid-press.
			onMouseEnter={() => {
				setInPause(true)
			}}
			onMouseLeave={() => {
				setInPause(false)
			}}
			onFocus={() => {
				setInPause(true)
			}}
			onBlur={() => {
				setInPause(false)
			}}
		>
			<div className="flex items-start gap-3 px-4 py-3 text-sm">
				<span className="grow">{children}</span>
				<IconButton
					name="Close"
					onClick={() => {
						setClosed(true)
					}}
				>
					<IconX />
				</IconButton>
			</div>
			{/* The countdown, drawn rather than announced: `aria-hidden` because the live region above has
			    already read the message out, and a bar that reported itself would say "80%" every frame. */}
			{conTimer ? (
				<div aria-hidden="true" className="h-1 w-full bg-palette-bg1">
					{/*
					 * ⚠️ The animation **is** the clock — `animationend` is what closes the toast, and there is no
					 * timer anywhere in this component. That is the whole reason the bar is fluid: a JS clock
					 * driving a width would have to re-render to move the bar, so it would move in visible steps,
					 * and one running fast enough to look smooth is a re-render per frame for five seconds. The
					 * browser interpolates this one on its own thread, and a second clock alongside it could only
					 * disagree with it.
					 *
					 * It also gets the pause for free: `animation-play-state: paused` stops the bar where it
					 * stands *and* postpones `animationend` by exactly as long, so "resumes where it stopped" is
					 * not something this component has to compute. Same for a backgrounded tab — the animation
					 * suspends with the rendering, so a confirmation is still there to read on the way back,
					 * which a `setTimeout` would have burned through unseen.
					 *
					 * Longhands rather than the `animation` shorthand: the shorthand resets `play-state` to
					 * `running`, so the two would have to stay in this order to work.
					 */}
					<div
						className="h-full origin-left bg-current"
						style={{
							animationName: 'countdown',
							animationDuration: `${OK_DURATION}ms`,
							animationTimingFunction: 'linear',
							animationFillMode: 'forwards',
							animationPlayState: inPause ? 'paused' : 'running'
						}}
						onAnimationEnd={() => {
							setClosed(true)
						}}
					/>
				</div>
			) : null}
		</div>,
		node
	)
}
