import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Infobox, InfoRow } from '@/components/ui/Infobox'

describe('Infobox', () => {
	it('renders its title and children', () => {
		render(
			<Infobox title="ShopOwner">
				<p>contenuto</p>
			</Infobox>
		)

		expect(screen.getByRole('heading', { name: 'ShopOwner' })).toBeInTheDocument()
		expect(screen.getByText('contenuto')).toBeInTheDocument()
	})

	// The account-status colour arrives as a class name, never as an inline style or a raw hex string
	// from a helper. The three states are declared once in `styles.css` (`account-deleted` and friends);
	// a component that computed the colour itself would hide a domain fact somewhere unsearchable.
	it('appends the caller class to its own', () => {
		const { container } = render(
			<Infobox title="Account status" className="account-deleted">
				<InfoRow label="Disabled" value="No" />
			</Infobox>
		)
		expect(container.firstChild).toHaveClass('account-deleted')
	})

	// A card whose rows are a list needs somewhere to put "and one more", and that is not any of the rows.
	// The title line is the only place that belongs to the card rather than to an entry of it.
	it('puts the caller actions on the title line', () => {
		render(
			<Infobox title="OpeningHours" actions={<button type="button">Add openingHours</button>}>
				<InfoRow label="lunedì" value="11:30 – 14:30" />
			</Infobox>
		)

		const intestazione = screen.getByRole('heading', { name: 'OpeningHours' }).parentElement as HTMLElement
		expect(within(intestazione).getByRole('button', { name: 'Add openingHours' })).toBeInTheDocument()
	})

	it('renders without a caller class', () => {
		const { container } = render(
			<Infobox title="Account status">
				<InfoRow label="Disabled" value="No" />
			</Infobox>
		)
		expect(container.firstChild).toMatchSnapshot()
	})
})

describe('InfoRow', () => {
	it('renders a label and its value', () => {
		render(<InfoRow label="Mobile" value="333 1234567" />)

		expect(screen.getByText('Mobile')).toBeInTheDocument()
		expect(screen.getByText('333 1234567')).toBeInTheDocument()
	})

	it('renders', () => {
		const { container } = render(<InfoRow label="Mobile" value="333 1234567" />)
		expect(container.firstChild).toMatchSnapshot()
	})
})
