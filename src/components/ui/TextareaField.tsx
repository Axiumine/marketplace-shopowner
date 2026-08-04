import * as Label from '@radix-ui/react-label'
import type { Ref, TextareaHTMLAttributes } from 'react'
import { useId } from 'react'

import { FIELD_TO_FIX, FIELD_VALID } from '@/components/ui/fieldStatus'

interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
	label: string
	/** Validation message from react-hook-form. Present means invalid. */
	error?: string | undefined
	/**
	 * How many characters are left, counted by the caller.
	 *
	 * Counted there and not here because the box is uncontrolled: `register()` writes the stored note in
	 * through a ref, without an `onChange`, so a length this component measured itself would start at zero
	 * for a note of two hundred characters and only correct itself once something was typed.
	 */
	remaining?: number | undefined
	/** As on `TextField`: `register()`'s ref has to reach the real control or the field reads as empty. */
	ref?: Ref<HTMLTextAreaElement> | undefined
}

/*
 * The same box as `TextField`'s, minus the trailing-icon padding split — a textarea has no room for an
 * icon pinned inside it, so the right padding is not something a caller can change and `px-3` is safe
 * here. `resize-y`: the height is a guess about how long a note is, and the owner is the one who
 * knows; horizontal resizing would only break the grid it sits in.
 *
 * The border width and the background are both out, as on `TextField`, and for the same reason: each pair
 * sets one property, so listing both halves of either would leave the winner to stylesheet order. One of
 * the two is chosen below.
 */
const TEXTAREA_CLASS =
	'w-full resize-y rounded-box border-tip px-3 py-2 text-sm outline-none ' +
	'focus:border-third disabled:cursor-not-allowed disabled:bg-palette-bg1'

/** How tall the box starts. Five lines is a note rather than a paragraph — and `resize-y` covers the rest. */
const ROWS = 5

/**
 * The `aria-describedby` list, which is a space-separated list of ids and not one id.
 *
 * `undefined` rather than an empty string when neither is there: an empty attribute is a reference to
 * nothing, which some screen readers announce as a missing element rather than skipping.
 */
const descriptors = (...ids: readonly (string | null)[]): string | undefined => {
	const present = ids.filter((id) => id !== null)
	return present.length === 0 ? undefined : present.join(' ')
}

/**
 * A multi-line text box, wired for accessibility exactly as `TextField` is.
 *
 * Its own component rather than a `TextField` variant: an `<input>` and a `<textarea>` take different
 * attribute sets (`rows`, `cols`, no `type`) and different ref types, so one component covering both
 * would take a union of props that is wrong for whichever half is not in use.
 */
export const TextareaField = ({ label, error, remaining, id, rows = ROWS, ref, ...rest }: TextareaFieldProps) => {
	const generatedId = useId()
	const areaId = id ?? generatedId
	const errorId = `${areaId}-error`
	const counterId = `${areaId}-remaining`

	return (
		<div className="flex flex-col gap-1">
			<Label.Root htmlFor={areaId} className="text-sm font-semibold">
				{label}
			</Label.Root>
			<textarea
				id={areaId}
				ref={ref}
				rows={rows}
				className={`${TEXTAREA_CLASS} ${error === undefined ? FIELD_VALID : FIELD_TO_FIX}`}
				aria-invalid={error !== undefined}
				// Both, when both are there: the message says what is wrong and the counter says how far
				// past the cap it is, and a screen reader that is handed only one of the two is handed the
				// half that cannot be acted on.
				aria-describedby={descriptors(error === undefined ? null : errorId, remaining === undefined ? null : counterId)}
				{...rest}
			/>
			{/* One line under the box, error on the left and the count on the right — `justify-between` on a
			    row that may hold either, both or neither, so neither ever moves the other. */}
			<div className="flex items-start justify-between gap-2">
				{error === undefined ? null : (
					<span id={errorId} className="text-xs text-app-error">
						{error}
					</span>
				)}
				{remaining === undefined ? null : (
					/* `aria-live`, because the number changes while the owner types and nothing else on
					   screen would tell a screen-reader user they are running out of room. `ml-auto` keeps it
					   right-aligned when it is the only child of the row. */
					<span id={counterId} aria-live="polite" className="ml-auto text-xs text-tip">
						{remaining} characters remaining
					</span>
				)}
			</div>
		</div>
	)
}
