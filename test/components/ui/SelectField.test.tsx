import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'

import { SelectField } from '@/components/ui/SelectField'

const days = (
	<>
		<option value="Lun">Lunedì</option>
		<option value="Mar">Martedì</option>
	</>
)

describe('SelectField', () => {
	it('associates its label with the select', async () => {
		render(<SelectField label="Giorno">{days}</SelectField>)

		const select = screen.getByLabelText('Giorno')
		await userEvent.selectOptions(select, 'Mar')
		expect(select).toHaveValue('Mar')
	})

	// The displayed name and the stored value are two different vocabularies here — `Lunedì` is read,
	// `Lun` is written — so a select that reported its label instead of its value would silently put a
	// second vocabulary into a collection that already has one.
	it('reports the option value, not the option text', async () => {
		render(<SelectField label="Giorno">{days}</SelectField>)

		await userEvent.selectOptions(screen.getByLabelText('Giorno'), screen.getByRole('option', { name: 'Lunedì' }))
		expect(screen.getByLabelText('Giorno')).toHaveValue('Lun')
	})

	it('generates an id when none is given, so two fields on one page do not collide', () => {
		render(
			<>
				<SelectField label="Da">{days}</SelectField>
				<SelectField label="A">{days}</SelectField>
			</>
		)

		const da = screen.getByLabelText('Da')
		const a = screen.getByLabelText('A')
		expect(da.id).not.toBe('')
		expect(da.id).not.toBe(a.id)
	})

	it('uses a caller-supplied id verbatim', () => {
		render(
			<SelectField label="Giorno" id="field-giorno">
				{days}
			</SelectField>
		)
		expect(screen.getByLabelText('Giorno')).toHaveAttribute('id', 'field-giorno')
	})

	it('is valid and describes nothing when there is no error', () => {
		render(<SelectField label="Giorno">{days}</SelectField>)

		const select = screen.getByLabelText('Giorno')
		expect(select).toHaveAttribute('aria-invalid', 'false')
		expect(select).not.toHaveAttribute('aria-describedby')
	})

	// As on `TextField`: the message has to be announced *with* the field, or a screen-reader user hears
	// "Giorno, casella combinata" and never learns why the form refused.
	it('wires the error message to the select', () => {
		render(
			<SelectField label="Giorno" id="field-giorno" error="Day is required">
				{days}
			</SelectField>
		)

		const select = screen.getByLabelText('Giorno')
		expect(select).toHaveAttribute('aria-invalid', 'true')
		expect(select).toHaveAttribute('aria-describedby', 'field-giorno-error')
		expect(document.getElementById('field-giorno-error')).toHaveTextContent('Day is required')
	})

	// Without the forwarded ref, react-hook-form's `register()` never reaches the real select: the field
	// is both uncontrolled and unregistered, and the form reads it as permanently empty.
	it('forwards its ref to the select element', () => {
		const ref = createRef<HTMLSelectElement>()
		render(
			<SelectField label="Giorno" ref={ref}>
				{days}
			</SelectField>
		)
		expect(ref.current).toBe(screen.getByLabelText('Giorno'))
	})

	it('passes the remaining select attributes through', () => {
		render(
			<SelectField label="Giorno" name="openingHours.0.giorno" disabled>
				{days}
			</SelectField>
		)

		const select = screen.getByLabelText('Giorno')
		expect(select).toHaveAttribute('name', 'openingHours.0.giorno')
		expect(select).toBeDisabled()
	})

	/*
	 * ⚠️ The native arrow is drawn in the browser's own shadow tree, hard against the right border, and
	 * no property moves it — `padding-right` widens the text area behind it and leaves it where it was.
	 * So the control is stripped and the glyph drawn as an ordinary child. Both halves are asserted here:
	 * without `appearance-none` the page shows two arrows, and without the span it shows none at all.
	 */
	it('draws its own arrow, having dropped the native one', () => {
		const { container } = render(<SelectField label="Giorno">{days}</SelectField>)

		expect(screen.getByLabelText('Giorno')).toHaveClass('appearance-none')

		const arrow = container.querySelector('svg')?.parentElement
		expect(arrow).toHaveClass('right-3')
		// A click landing on the arrow must reach the select underneath, or the one obvious place to
		// press is the one place that does nothing.
		expect(arrow).toHaveClass('pointer-events-none')
	})

	// Every class is asserted absent in the other state: the two pairs set two properties, so a field
	// carrying both halves of either would be resolved by stylesheet order rather than by the error.
	it('doubles its border and turns red when it is invalid', () => {
		const { rerender } = render(<SelectField label="Giorno">{days}</SelectField>)

		expect(screen.getByLabelText('Giorno')).toHaveClass('border', 'bg-white')
		expect(screen.getByLabelText('Giorno')).not.toHaveClass('border-2')
		expect(screen.getByLabelText('Giorno')).not.toHaveClass('bg-app-error/10')

		rerender(
			<SelectField label="Giorno" error="Day is required">
				{days}
			</SelectField>
		)

		expect(screen.getByLabelText('Giorno')).toHaveClass('border-2', 'bg-app-error/10')
		expect(screen.getByLabelText('Giorno')).not.toHaveClass('border')
		expect(screen.getByLabelText('Giorno')).not.toHaveClass('bg-white')
	})

	it('renders', () => {
		const { container } = render(
			<SelectField label="Giorno" id="field-giorno">
				{days}
			</SelectField>
		)
		expect(container.firstChild).toMatchSnapshot()
	})

	it('renders with an error', () => {
		const { container } = render(
			<SelectField label="Giorno" id="field-giorno" error="Day is required">
				{days}
			</SelectField>
		)
		expect(container.firstChild).toMatchSnapshot()
	})
})
