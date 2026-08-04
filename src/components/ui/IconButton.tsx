import type { ReactNode } from 'react'

/**
 * A button that is nothing but an icon.
 *
 * `name` is required and is spent twice: as `aria-label`, because the glyph inside is `aria-hidden` and
 * the button would otherwise reach a screen reader with no accessible name at all, and as `title`,
 * because a sighted owner has only a shape to go on.
 *
 * `type="button"` is not decoration. These sit inside the detail page's editors, and the default
 * `submit` would post the enclosing form on the first press.
 *
 * `disabled` is the real attribute rather than a guard inside `onClick`: the browser then refuses the
 * click, the keyboard, and the tab stop in one go, and a screen reader announces the button as
 * unavailable instead of offering an action that silently does nothing. `hover:text-third` is undone
 * for that state, since `:hover` still matches a disabled button and would go on promising a press.
 */
export const IconButton = ({
	name,
	onClick,
	disabled = false,
	children
}: {
	name: string
	onClick: () => void
	disabled?: boolean
	children: ReactNode
}) => (
	<button
		type="button"
		className="rounded-box p-1 text-tip transition-colors hover:text-third focus-visible:text-third disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-tip"
		aria-label={name}
		title={name}
		disabled={disabled}
		onClick={onClick}
	>
		{children}
	</button>
)
