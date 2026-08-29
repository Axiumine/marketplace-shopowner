import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'

import { CheckboxField } from '@/components/ui/CheckboxField'

describe('CheckboxField', () => {
	it('renders a labelled checkbox', () => {
		render(<CheckboxField label="Disabled" />)

		const box = screen.getByRole('checkbox', { name: 'Disabled' })
		expect(box).toHaveAttribute('type', 'checkbox')
		expect(box).not.toBeChecked()
	})

	// A real `<label for>`, not text placed beside the box: clicking the word has to toggle the control,
	// and a screen reader has to announce the two as one thing.
	it('toggles when its label is clicked', async () => {
		render(<CheckboxField label="Disabled" />)

		await userEvent.click(screen.getByText('Disabled'))

		expect(screen.getByRole('checkbox', { name: 'Disabled' })).toBeChecked()
	})

	it('forwards its ref to the input', () => {
		const ref = createRef<HTMLInputElement>()
		render(<CheckboxField label="Disabled" ref={ref} />)

		expect(ref.current).toBe(screen.getByRole('checkbox', { name: 'Disabled' }))
	})

	// Two fields on one page must not share an id, or the second label points at the first box.
	it('generates a distinct id per instance', () => {
		render(
			<>
				<CheckboxField label="Disabled" />
				<CheckboxField label="Awaiting approval" />
			</>
		)

		const first = screen.getByRole('checkbox', { name: 'Disabled' })
		const second = screen.getByRole('checkbox', { name: 'Awaiting approval' })
		expect(first.id).not.toBe(second.id)
	})

	it('lets the caller name the id', () => {
		render(<CheckboxField label="Disabled" id="field-disabled" />)

		expect(screen.getByRole('checkbox', { name: 'Disabled' })).toHaveAttribute('id', 'field-disabled')
	})

	/*
	 * ⚠️ `hideLabel` takes the label off the screen and leaves it in the accessibility tree — `sr-only`,
	 * never `hidden`. The assertion is therefore that the box is still *named*: a per-row selection box
	 * with no label at all is announced as an anonymous checkbox, and a catalogue of them is a column of
	 * identical anonymous checkboxes.
	 */
	it('keeps the name of a label it does not show', () => {
		render(<CheckboxField label="Select Blue enamel mug" hideLabel />)

		expect(screen.getByRole('checkbox', { name: 'Select Blue enamel mug' })).toBeInTheDocument()
		expect(screen.getByText('Select Blue enamel mug')).toHaveClass('sr-only')
	})

	// The default, stated: every other checkbox in the app shows its label, and the flag has to be asked
	// for rather than inherited from whichever field was rendered last.
	it('shows the label unless asked not to', () => {
		render(<CheckboxField label="Disabled" />)

		expect(screen.getByText('Disabled')).toHaveClass('text-sm font-semibold')
		expect(screen.getByText('Disabled')).not.toHaveClass('sr-only')
	})

	it('renders', () => {
		const { container } = render(<CheckboxField label="Disabled" id="field-disabled" />)

		expect(container.firstChild).toMatchSnapshot()
	})

	it('renders with the label hidden', () => {
		const { container } = render(<CheckboxField label="Select Blue enamel mug" hideLabel id="field-select" />)

		expect(container.firstChild).toMatchSnapshot()
	})
})
