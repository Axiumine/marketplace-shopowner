import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { EditableRow } from '@/components/ui/EditableRow'

describe('EditableRow', () => {
	it('starts read-only, with the value and a pen beside it', () => {
		render(
			<EditableRow label="Mobile" value="3331234567">
				<input aria-label="Mobile" />
			</EditableRow>
		)

		expect(screen.getByText('Mobile')).toBeInTheDocument()
		expect(screen.getByText('3331234567')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Change Mobile' })).toBeInTheDocument()
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
	})

	it('swaps the value for the editor when the pen is pressed', async () => {
		render(
			<EditableRow label="Mobile" value="3331234567">
				<input aria-label="Mobile" />
			</EditableRow>
		)

		await userEvent.click(screen.getByRole('button', { name: 'Change Mobile' }))

		expect(screen.getByRole('textbox', { name: 'Mobile' })).toBeInTheDocument()
		expect(screen.queryByText('3331234567')).not.toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Change Mobile' })).not.toBeInTheDocument()
	})

	/*
	 * The name is built from the label, so the default has to be asserted against a *different* label
	 * than the one above — a hard-coded string would satisfy both otherwise.
	 */
	it('names the pen after the row it opens', () => {
		render(
			<EditableRow label="Onboarding step" value="3">
				<input aria-label="Onboarding step" />
			</EditableRow>
		)

		expect(screen.getByRole('button', { name: 'Change Onboarding step' })).toBeInTheDocument()
	})

	// Opening hours are the reason: a shop may open twice on the same day, so two rows carry the same
	// visible label and the two pens would otherwise announce identically.
	it('takes an explicit name when the label would not be unique', () => {
		render(
			<EditableRow label="lunedì" action="Change openingHours 2" value="18:30 – 23:00">
				<input aria-label="Dalle" />
			</EditableRow>
		)

		expect(screen.getByRole('button', { name: 'Change openingHours 2' })).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Change lunedì' })).not.toBeInTheDocument()
	})

	// Icon-only, so `aria-label` is the only thing naming it and the glyph has to stay out of the
	// accessibility tree — otherwise the row announces an unnamed control next to an unnamed image.
	it('names the icon-only pen and hides the glyph from assistive tech', () => {
		render(
			<EditableRow label="First name" value="Mario">
				<input aria-label="First name" />
			</EditableRow>
		)

		const pen = screen.getByRole('button', { name: 'Change First name' })
		expect(pen.textContent).toBe('')
		expect(pen.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
		expect(pen).toHaveAttribute('title', 'Change First name')
	})

	// The rows live inside the page's form: a pen that defaulted to `type="submit"` would save the whole
	// shopOwner on the way into editing one field.
	it('does not submit the form it sits in', async () => {
		let submitted = false

		render(
			<form
				onSubmit={(event) => {
					event.preventDefault()
					submitted = true
				}}
			>
				<EditableRow label="First name" value="Mario">
					<input aria-label="First name" />
				</EditableRow>
			</form>
		)

		await userEvent.click(screen.getByRole('button', { name: 'Change First name' }))

		expect(submitted).toBe(false)
	})

	// A row of a fixed document — every field of the personalData — has nothing to delete. The bin is opt-in
	// so those rows do not grow a control that could only ever be a mistake.
	it('has no bin unless one is asked for', () => {
		render(
			<EditableRow label="First name" value="Mario">
				<input aria-label="First name" />
			</EditableRow>
		)

		expect(screen.queryByRole('button', { name: 'Delete First name' })).not.toBeInTheDocument()
	})

	it('puts a bin beside the pen, named after the row', async () => {
		let deleted = false

		render(
			<EditableRow
				label="Onboarding step"
				value="3"
				onDelete={() => {
					deleted = true
				}}
			>
				<input aria-label="Onboarding step" />
			</EditableRow>
		)

		await userEvent.click(screen.getByRole('button', { name: 'Delete Onboarding step' }))

		expect(deleted).toBe(true)
	})

	it('takes an explicit name for the bin when the label would not be unique', () => {
		render(
			<EditableRow
				label="lunedì"
				actionDelete="Delete openingHours 2"
				value="18:30 – 23:00"
				onDelete={() => {
					/* not pressed here */
				}}
			>
				<input aria-label="Dalle" />
			</EditableRow>
		)

		expect(screen.getByRole('button', { name: 'Delete openingHours 2' })).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Delete lunedì' })).not.toBeInTheDocument()
	})

	// The whole point of keeping it reachable: a row is usually opened *before* the operator decides it
	// should not exist at all.
	it('keeps the bin once the row is open', async () => {
		let deleted = false

		render(
			<EditableRow
				label="lunedì"
				value="11:30 – 14:30"
				onDelete={() => {
					deleted = true
				}}
			>
				<input aria-label="Dalle" />
			</EditableRow>
		)

		await userEvent.click(screen.getByRole('button', { name: 'Change lunedì' }))
		await userEvent.click(screen.getByRole('button', { name: 'Delete lunedì' }))

		expect(screen.getByRole('textbox', { name: 'Dalle' })).toBeInTheDocument()
		expect(deleted).toBe(true)
	})

	// A row that was just added has no stored value: closed, it would read as an empty label beside an
	// empty value, and the operator would have to find the pen of a row that looks like a rendering bug.
	it('can start open', () => {
		render(
			<EditableRow label="" value="" openInitial>
				<input aria-label="Giorno" />
			</EditableRow>
		)

		expect(screen.getByRole('textbox', { name: 'Giorno' })).toBeInTheDocument()
	})

	it('does not submit the form it sits in when the bin is pressed', async () => {
		let submitted = false

		render(
			<form
				onSubmit={(event) => {
					event.preventDefault()
					submitted = true
				}}
			>
				<EditableRow
					label="lunedì"
					value="11:30 – 14:30"
					onDelete={() => {
						/* the submit is what is under test */
					}}
				>
					<input aria-label="Dalle" />
				</EditableRow>
			</form>
		)

		await userEvent.click(screen.getByRole('button', { name: 'Delete lunedì' }))

		expect(submitted).toBe(false)
	})

	it('renders read-only', () => {
		const { container } = render(
			<EditableRow label="First name" value="Mario">
				<input aria-label="First name" />
			</EditableRow>
		)

		expect(container.firstChild).toMatchSnapshot()
	})

	it('renders open', async () => {
		const { container } = render(
			<EditableRow label="First name" value="Mario">
				<input aria-label="First name" />
			</EditableRow>
		)
		await userEvent.click(screen.getByRole('button', { name: 'Change First name' }))

		expect(container.firstChild).toMatchSnapshot()
	})

	it('renders with a bin', () => {
		const { container } = render(
			<EditableRow
				label="lunedì"
				value="11:30 – 14:30"
				onDelete={() => {
					/* not pressed here */
				}}
			>
				<input aria-label="Dalle" />
			</EditableRow>
		)

		expect(container.firstChild).toMatchSnapshot()
	})
})
