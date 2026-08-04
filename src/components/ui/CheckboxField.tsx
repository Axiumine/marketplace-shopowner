import * as Label from '@radix-ui/react-label'
import type { InputHTMLAttributes, Ref } from 'react'
import { useId } from 'react'

interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
	label: string
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
export const CheckboxField = ({ label, id, ref, ...rest }: CheckboxFieldProps) => {
	const generatedId = useId()
	const inputId = id ?? generatedId

	return (
		<div className="flex items-center gap-2">
			<input id={inputId} type="checkbox" ref={ref} className="h-4 w-4 rounded-box border border-tip accent-third" {...rest} />
			<Label.Root htmlFor={inputId} className="text-sm font-semibold">
				{label}
			</Label.Root>
		</div>
	)
}
