import type { FieldErrors } from 'react-hook-form'

import { Toast } from '@/components/ui/Toast'
import { messagesToFix } from '@/lib/formErrors'

/** The lead line above the list. Says what the toast is for, since the messages themselves do not. */
export const VALIDATION_HEADER = 'Fix these fields before saving:'

/**
 * The toast a refused save puts up: what is wrong, spelled out.
 *
 * The red border and the red background on the boxes say *where* the problem is; this says *what* it is,
 * from the corner of the screen the owner is already looking at after pressing Save. The two are not
 * redundant — the button is at the bottom of a page of three cards, and the box that refused may well be
 * scrolled off the top of it.
 *
 * Rendered from `formState.errors` on every render, with no state of its own, which is what makes it
 * self-clearing: a form with nothing left to correct renders nothing at all, so the toast goes away as
 * the last field is fixed rather than waiting for another press.
 *
 * ⚠️ Inherits the caveat written on `Toast`: a message the owner dismissed stays dismissed while it
 * is mounted. An identical second refusal therefore shows nothing new — the red boxes are what carry it
 * that time.
 *
 * Keyed by the message text and not by an index: the list changes as fields are corrected, and an index
 * key would let React keep a `<li>` in place while its content changed under it.
 */
export const ToastValidation = ({ errors }: { errors: FieldErrors }) => {
	const messages = messagesToFix(errors)

	if (messages.length === 0) return null

	return (
		<Toast tone="error">
			<span className="font-semibold">{VALIDATION_HEADER}</span>
			<ul className="mt-1 list-disc pl-4">
				{messages.map((message) => (
					<li key={message}>{message}</li>
				))}
			</ul>
		</Toast>
	)
}
