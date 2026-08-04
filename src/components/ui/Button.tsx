import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { Spinner } from '@/components/ui/Spinner'

export type ButtonVariant = 'primary' | 'ghost' | 'danger'
export type ButtonPadding = 'default' | 'form'

const VARIANT_CLASS: Record<ButtonVariant, string> = {
	primary: 'bg-third text-palette-white hover:bg-pomodoro',
	ghost: 'bg-secondary text-palette-bg hover:bg-primary',
	danger: 'bg-app-error text-palette-white hover:bg-pomodoro'
}

/*
 * Picked from here, never appended to a base value: two utilities setting the same property are resolved
 * by stylesheet order and not by the order they appear in the class attribute, so `px-4 px-[30px]` is a
 * coin toss. Same reason `TextField` keeps its right padding out of its own base class.
 */
const PADDING_CLASS: Record<ButtonPadding, string> = {
	default: 'px-4',
	form: 'px-[30px]'
}

/**
 * ⚠️ `cursor-pointer` is here on purpose, and is not a default anything gives you. Tailwind's preflight
 * — pulled in by the `@import 'tailwindcss'` at the top of `styles.css` — sets `button { cursor:
 * default }`, so a button shows the arrow until a utility says otherwise.
 *
 * `disabled:cursor-not-allowed` below still wins over it: the variant compiles to a `:disabled`
 * selector, one pseudo-class more specific than the bare utility.
 */
const BASE_CLASS =
	'inline-flex cursor-pointer items-center justify-center gap-2 rounded-box py-2 text-sm font-semibold ' +
	'transition-colors disabled:cursor-not-allowed disabled:opacity-50'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant
	/** How much room the label gets on either side. `form` is the wider one every form's submit uses. */
	padding?: ButtonPadding
	/** Shows a spinner and disables the button. A loading button is always disabled — never one alone. */
	loading?: boolean
	children: ReactNode
}

/**
 * `type` defaults to `button`, not `submit`.
 *
 * HTML's default is `submit`, which makes every unmarked button inside a form submit it — the classic
 * way a "Show password" toggle ends up posting the login form. Forms opt in explicitly.
 */
export const Button = ({
	variant = 'primary',
	padding = 'default',
	loading = false,
	disabled = false,
	children,
	...rest
}: ButtonProps) => (
	<button
		type="button"
		className={`${BASE_CLASS} ${VARIANT_CLASS[variant]} ${PADDING_CLASS[padding]}`}
		disabled={disabled || loading}
		{...rest}
	>
		{loading ? <Spinner /> : null}
		{children}
	</button>
)
