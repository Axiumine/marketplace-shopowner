import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { IconArrowGiu, IconBan, IconPen, IconPlus, IconTrash, IconX } from '@/components/ui/icons'

/*
 * Five of the six reach a DOM through the button that carries them, and are asserted there. `IconBan` is
 * the exception: it was drawn for the disable action and nothing renders it yet, so this file is the only
 * place it exists at all.
 *
 * ⚠️ Kept and asserted rather than deleted. The disable/enable pair is a real action on this tier —
 * `shopOwner` carries `disabled`, and the detail page toggles it — so the glyph is a screen away, not a
 * leftover from a removed feature. What it must not be is *unasserted*: `aria-hidden` is the property
 * every icon here shares and the one whose absence is invisible, because a screen reader announcing the
 * glyph and the button around it reads the name twice and nothing on the page looks wrong.
 */
const ICONS = [
	['IconPen', IconPen],
	['IconTrash', IconTrash],
	['IconArrowGiu', IconArrowGiu],
	['IconPlus', IconPlus],
	['IconX', IconX],
	['IconBan', IconBan]
] as const

describe('icons', () => {
	it.each(ICONS)('%s draws an aria-hidden svg on the current colour', (_name, Icon) => {
		const { container } = render(<Icon />)
		const svg = container.querySelector('svg')

		expect(svg).not.toBeNull()
		expect(svg).toHaveAttribute('aria-hidden', 'true')
		expect(svg).toHaveAttribute('viewBox', '0 0 24 24')
		// `currentColor` is what lets one glyph serve a disabled button, an error row and the side menu
		// without a variant each — a hard-coded stroke would need three copies.
		expect(svg).toHaveAttribute('stroke', 'currentColor')
		expect(svg).toHaveAttribute('fill', 'none')
		expect(svg?.getAttribute('class')).toBe('h-4 w-4')
	})

	// The strike is the whole glyph: a circle on its own is the "info" mark, and a prohibition sign that
	// lost its line reads as the opposite of what the button does.
	it('draws IconBan as a circle struck through', () => {
		const { container } = render(<IconBan />)

		expect(container.querySelector('circle')).toHaveAttribute('r', '9')
		expect(container.querySelectorAll('path')).toHaveLength(1)
	})

	it.each(ICONS)('renders %s', (_name, Icon) => {
		const { container } = render(<Icon />)
		expect(container.firstChild).toMatchSnapshot()
	})
})
