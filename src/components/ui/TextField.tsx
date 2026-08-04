import * as Label from '@radix-ui/react-label'
import type { InputHTMLAttributes, ReactNode, Ref } from 'react'
import { useId } from 'react'

import { FIELD_TO_FIX, FIELD_VALID } from '@/components/ui/fieldStatus'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
	label: string
	/** Validation message from react-hook-form. Present means invalid. */
	error?: string | undefined
	/**
	 * Rendered inside the input's box, pinned to its right edge — an icon button, not a second control
	 * beside the field. Only a field that has one pays for the room: without it the input keeps the
	 * symmetric padding every other field has.
	 */
	trailing?: ReactNode
	/**
	 * react-hook-form's `register()` returns a `ref` that has to reach the real input; without it the
	 * field is uncontrolled *and* unregistered, and the form reads it as always empty.
	 *
	 * Declared as an ordinary prop rather than wired with `forwardRef`, which React 19 deprecated: a
	 * function component now receives `ref` like any other prop. That also drops the `displayName`
	 * assignment `forwardRef` made necessary — the component's own name is what devtools shows.
	 */
	ref?: Ref<HTMLInputElement> | undefined
}

/*
 * The right padding is deliberately *not* in here, and `px-3` is deliberately split into `pl-3` plus a
 * separate right value. Tailwind resolves `px-3 pr-10` by stylesheet order, not by the order the two
 * appear in the class attribute, so overriding one shorthand with the longhand is a coin toss. Two
 * non-overlapping utilities always agree.
 *
 * The border width and the background are out for the same reason and not a different one: `border` and
 * `border-2` set one property, `bg-white` and `bg-app-error/10` set another, so listing both halves of
 * either pair would leave the winner to the stylesheet. One or the other is chosen below, never appended
 * to the other. `disabled:bg-palette-bg1` still wins over both — the variant carries an extra
 * `:disabled`, so it outranks the plain utility rather than racing it.
 */
const INPUT_CLASS =
	'w-full rounded-box border-tip py-2 pl-3 text-sm outline-none ' +
	'focus:border-third disabled:cursor-not-allowed disabled:bg-palette-bg1'

/**
 * The one text input every form here is built from.
 *
 * `aria-invalid` / `aria-describedby` are wired from the error, so the message is announced with the
 * field rather than floating unattached beneath it.
 *
 * An invalid field also doubles its border. The message underneath is small red text at the bottom of a
 * box; on a form of thirteen fields the eye has to find which box it belongs to, and a heavier outline
 * is what points at it from across the page. Box-sizing is border-box, so the extra pixel is taken from
 * the inside and nothing on the row moves.
 */
export const TextField = ({ label, error, id, trailing, ref, ...rest }: TextFieldProps) => {
	const generatedId = useId()
	const inputId = id ?? generatedId
	const errorId = `${inputId}-error`

	return (
		<div className="flex flex-col gap-1">
			<Label.Root htmlFor={inputId} className="text-sm font-semibold">
				{label}
			</Label.Root>
			<div className="relative">
				<input
					id={inputId}
					ref={ref}
					className={`${INPUT_CLASS} ${error === undefined ? FIELD_VALID : FIELD_TO_FIX} ${trailing === undefined ? 'pr-3' : 'pr-10'}`}
					aria-invalid={error !== undefined}
					aria-describedby={error === undefined ? undefined : errorId}
					{...rest}
				/>
				{trailing === undefined ? null : <span className="absolute inset-y-0 right-1 flex items-center">{trailing}</span>}
			</div>
			{error === undefined ? null : (
				<span id={errorId} className="text-xs text-app-error">
					{error}
				</span>
			)}
		</div>
	)
}
