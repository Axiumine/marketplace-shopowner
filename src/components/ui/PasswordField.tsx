import type { InputHTMLAttributes, Ref } from 'react'
import { useState } from 'react'

import { TextField } from '@/components/ui/TextField'

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
	label: string
	error?: string | undefined
	/** Passed straight down to `TextField`, which hands it to the real input. */
	ref?: Ref<HTMLInputElement>
}

const ICON_PROPS = {
	viewBox: '0 0 24 24',
	fill: 'none',
	stroke: 'currentColor',
	strokeWidth: 1.75,
	strokeLinecap: 'round',
	strokeLinejoin: 'round',
	className: 'h-5 w-5',
	'aria-hidden': true
} as const

/**
 * The two glyphs, drawn inline.
 *
 * Inline rather than pulled from an icon package because this app has no icon dependency and one pair
 * of eyes is not a reason to add a runtime one. `aria-hidden` keeps them out of the accessibility tree
 * — the button around them carries the name, and an icon announced twice reads as two controls.
 */
const IconEye = () => (
	<svg {...ICON_PROPS}>
		<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
		<circle cx="12" cy="12" r="3" />
	</svg>
)

const IconEyeOff = () => (
	<svg {...ICON_PROPS}>
		<path d="M10.7 5.6A11 11 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a19 19 0 0 1-3.3 4.1" />
		<path d="M6.5 6.6A18.9 18.9 0 0 0 2 12s3.6 6.5 10 6.5a10.8 10.8 0 0 0 4-.7" />
		<path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
		<path d="m3 3 18 18" />
	</svg>
)

/**
 * A password input with an eye toggle sitting inside the field, at its right edge.
 *
 * The toggle is an icon, so its accessible name comes from `aria-label` — "Show password" /
 * "Hide password", the same two strings the visible text used to say. Without it the button
 * announces as an unnamed control and there is no way to know what it does.
 *
 * It is a `<button type="button">` rather than the HTML default `submit` so it cannot post the form it
 * sits in — the failure mode that turns a peek at the password into a login attempt with a half-typed
 * one.
 */
export const PasswordField = ({ label, error, ref, ...rest }: PasswordFieldProps) => {
	const [visible, setVisible] = useState(false)
	const toggleLabel = visible ? 'Hide password' : 'Show password'

	return (
		<TextField
			label={label}
			error={error}
			type={visible ? 'text' : 'password'}
			ref={ref}
			trailing={
				<button
					type="button"
					className="rounded-box p-1 text-tip transition-colors hover:text-third focus-visible:text-third"
					aria-label={toggleLabel}
					title={toggleLabel}
					onClick={() => {
						setVisible(!visible)
					}}
				>
					{visible ? <IconEyeOff /> : <IconEye />}
				</button>
			}
			{...rest}
		/>
	)
}
