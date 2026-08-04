import * as Label from '@radix-ui/react-label'
import type { ReactNode, Ref, SelectHTMLAttributes } from 'react'
import { useId } from 'react'

import { FIELD_TO_FIX, FIELD_VALID } from '@/components/ui/fieldStatus'
import { IconArrowGiu } from '@/components/ui/icons'

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
	label: string
	/** Validation message from react-hook-form. Present means invalid. */
	error?: string | undefined
	/** The `<option>`s. Passed in rather than derived from a list prop, so a caller can group or disable. */
	children: ReactNode
	/** See the note on `TextField`: React 19 hands a function component its `ref` like any other prop. */
	ref?: Ref<HTMLSelectElement> | undefined
}

/*
 * Matches `TextField` line for line — same box, same focus colour, same doubled border when invalid —
 * because the two sit side by side in the same grid and a select that disagreed by a pixel would read
 * as a different kind of field.
 *
 * ⚠️ `appearance-none`, and the arrow below, because **the native arrow cannot be moved**. It is drawn
 * by the browser in the select's own shadow tree, hard against the right border, and `padding-right`
 * does not push it inwards — it widens the text area behind it and leaves the arrow exactly where it
 * was. There is no property that positions it. Dropping the native control and drawing the glyph as an
 * ordinary absolutely-positioned child, the way `TextField` pins its trailing slot, is the only way to
 * choose where it sits. `pr-9` is then what keeps a long option name from running underneath it.
 *
 * The border width and the background are both out, as on `TextField`: each pair sets one property, so a
 * box carrying both halves would be resolved by stylesheet order rather than by its error.
 */
const SELECT_CLASS =
	'w-full appearance-none rounded-box border-tip py-2 pl-3 pr-9 text-sm outline-none ' +
	'focus:border-third disabled:cursor-not-allowed disabled:bg-palette-bg1'

/** The one dropdown. `aria-invalid` / `aria-describedby` are wired from the error, as in `TextField`. */
export const SelectField = ({ label, error, id, children, ref, ...rest }: SelectFieldProps) => {
	const generatedId = useId()
	const selectId = id ?? generatedId
	const errorId = `${selectId}-error`

	return (
		<div className="flex flex-col gap-1">
			<Label.Root htmlFor={selectId} className="text-sm font-semibold">
				{label}
			</Label.Root>
			<div className="relative">
				<select
					id={selectId}
					ref={ref}
					className={`${SELECT_CLASS} ${error === undefined ? FIELD_VALID : FIELD_TO_FIX}`}
					aria-invalid={error !== undefined}
					aria-describedby={error === undefined ? undefined : errorId}
					{...rest}
				>
					{children}
				</select>
				{/* `pointer-events-none`: the arrow sits over the select, and a click on it has to reach the
				    select underneath or the one obvious place to press would be the one that does nothing. */}
				<span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-tip">
					<IconArrowGiu />
				</span>
			</div>
			{error === undefined ? null : (
				<span id={errorId} className="text-xs text-app-error">
					{error}
				</span>
			)}
		</div>
	)
}
