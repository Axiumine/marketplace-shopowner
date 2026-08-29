import * as Label from '@radix-ui/react-label'
import type { InputHTMLAttributes, Ref } from 'react'
import { useId } from 'react'

interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
	label: string
	/**
	 * Hides the label from the screen, never from the accessibility tree.
	 *
	 * For the one place a visible label would be noise and its absence would still be a bug: a
	 * per-row selection box, where the row already carries the name and every box on the page would
	 * otherwise be announced as the same anonymous checkbox. `sr-only` rather than `hidden`, so the
	 * label is still what names the control and clicking through a screen reader still lands on it.
	 */
	hideLabel?: boolean
	/** react-hook-form's `register()` ref. A plain prop, as React 19 allows — see `TextField`. */
	ref?: Ref<HTMLInputElement> | undefined
}

/**
 * The one checkbox the editable rows are built from.
 *
 * The label sits *after* the box rather than above it, which is the only place a checkbox label reads
 * correctly, and it is a real `<label for>` — clicking the word toggles the box, and a screen reader
 * announces the pair as one control. There is no `error` slot: every boolean on this page is a
 * two-state field that cannot be filled in wrongly.
 */
export const CheckboxField = ({ label, id, hideLabel = false, ref, ...rest }: CheckboxFieldProps) => {
	const generatedId = useId()
	const inputId = id ?? generatedId

	return (
		<div className="flex items-center gap-2">
			<input id={inputId} type="checkbox" ref={ref} className="h-4 w-4 rounded-box border border-tip accent-third" {...rest} />
			<Label.Root htmlFor={inputId} className={hideLabel ? 'sr-only' : 'text-sm font-semibold'}>
				{label}
			</Label.Root>
		</div>
	)
}
