/**
 * The glyphs, drawn inline — same reason as the eye in `PasswordField`: this app has no icon
 * dependency and three paths are not a reason to add a runtime one.
 *
 * Every icon is `aria-hidden`. The button around it carries the name, and an icon that also announced
 * itself would be read twice.
 */
const ICON_PROPS = {
	viewBox: '0 0 24 24',
	fill: 'none',
	stroke: 'currentColor',
	strokeWidth: 1.75,
	strokeLinecap: 'round',
	strokeLinejoin: 'round',
	className: 'h-4 w-4',
	'aria-hidden': true
} as const

/** Edit. */
export const IconPen = () => (
	<svg {...ICON_PROPS}>
		<path d="M12 20h9" />
		<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
	</svg>
)

/** Delete. */
export const IconTrash = () => (
	<svg {...ICON_PROPS}>
		<path d="M4 7h16" />
		<path d="M9 7V4h6v3" />
		<path d="m6 7 1 13h10l1-13" />
		<path d="M10 11v6" />
		<path d="M14 11v6" />
	</svg>
)

/** Open a list. The arrow `SelectField` draws itself, because the native one cannot be positioned. */
export const IconArrowGiu = () => (
	<svg {...ICON_PROPS}>
		<path d="m6 9 6 6 6-6" />
	</svg>
)

/** Add. */
export const IconPlus = () => (
	<svg {...ICON_PROPS}>
		<path d="M12 5v14" />
		<path d="M5 12h14" />
	</svg>
)

/** Dismiss — the cross on a toast. */
export const IconX = () => (
	<svg {...ICON_PROPS}>
		<path d="M6 6 18 18" />
		<path d="M18 6 6 18" />
	</svg>
)

/** Disable — the prohibition sign: a circle struck through. */
export const IconBan = () => (
	<svg {...ICON_PROPS}>
		<circle cx="12" cy="12" r="9" />
		<path d="m5.6 5.6 12.8 12.8" />
	</svg>
)
