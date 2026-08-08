import { fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'

import { TextareaField } from '@/components/ui/TextareaField'

describe('TextareaField', () => {
	it('associates its label with the textarea', () => {
		render(<TextareaField label="Notes" />)

		const area = screen.getByLabelText('Notes')
		expect(area.tagName).toBe('TEXTAREA')

		// `fireEvent.change`, not `userEvent.type`: the box this component exists for carries a `maxLength`
		// of two thousand, and typing a note a character at a time is a test that measures the keyboard.
		fireEvent.change(area, { target: { value: 'Call\nbefore 6pm.' } })
		expect(area).toHaveValue('Call\nbefore 6pm.')
	})

	it('generates an id when none is given, so two fields on one page do not collide', () => {
		render(
			<>
				<TextareaField label="Notes" />
				<TextareaField label="Memo" />
			</>
		)

		const note = screen.getByLabelText('Notes')
		const memo = screen.getByLabelText('Memo')
		expect(note.id).not.toBe('')
		expect(note.id).not.toBe(memo.id)
	})

	it('uses a caller-supplied id verbatim', () => {
		render(<TextareaField label="Notes" id="field-note" />)
		expect(screen.getByLabelText('Notes')).toHaveAttribute('id', 'field-note')
	})

	it('is valid and describes nothing when there is no error', () => {
		render(<TextareaField label="Notes" />)

		const area = screen.getByLabelText('Notes')
		expect(area).toHaveAttribute('aria-invalid', 'false')
		expect(area).not.toHaveAttribute('aria-describedby')
	})

	// The message has to be announced *with* the field, not float unattached beneath it — otherwise a
	// screen-reader user hears "Note, text box" and never learns why the form refused.
	it('wires the error message to the textarea', () => {
		render(<TextareaField label="Notes" id="field-note" error="The notes cannot exceed 2000 characters" />)

		const area = screen.getByLabelText('Notes')
		expect(area).toHaveAttribute('aria-invalid', 'true')
		expect(area).toHaveAttribute('aria-describedby', 'field-note-error')
		expect(document.getElementById('field-note-error')).toHaveTextContent('The notes cannot exceed 2000 characters')
	})

	// Without the forwarded ref, react-hook-form's `register()` never reaches the real control: the field
	// is both uncontrolled and unregistered, and the form reads it as permanently empty.
	it('forwards its ref to the textarea element', () => {
		const ref = createRef<HTMLTextAreaElement>()
		render(<TextareaField label="Notes" ref={ref} />)

		expect(ref.current).toBe(screen.getByLabelText('Notes'))
	})

	// Five lines is a note rather than a paragraph, and `resize-y` covers whoever disagrees — but a caller
	// asking for a different height has to get it, or the default is a hard-coded number in disguise.
	it('starts five lines tall and takes a height from the caller', () => {
		const { rerender } = render(<TextareaField label="Notes" />)

		expect(screen.getByLabelText('Notes')).toHaveAttribute('rows', '5')

		rerender(<TextareaField label="Notes" rows={12} />)

		expect(screen.getByLabelText('Notes')).toHaveAttribute('rows', '12')
	})

	it('passes the remaining textarea attributes through', () => {
		render(<TextareaField label="Notes" maxLength={2000} placeholder="Notes about the account" />)

		const area = screen.getByLabelText('Notes')
		expect(area).toHaveAttribute('maxlength', '2000')
		expect(area).toHaveAttribute('placeholder', 'Notes about the account')
	})

	// Every class is asserted absent in the other state: the two pairs set two properties, so a box
	// carrying both halves of either would be resolved by stylesheet order rather than by the error.
	it('doubles its border and turns red when it is invalid', () => {
		const { rerender } = render(<TextareaField label="Notes" />)

		expect(screen.getByLabelText('Notes')).toHaveClass('border', 'bg-white')
		expect(screen.getByLabelText('Notes')).not.toHaveClass('border-2')
		expect(screen.getByLabelText('Notes')).not.toHaveClass('bg-app-error/10')

		rerender(<TextareaField label="Notes" error="The notes cannot exceed 2000 characters" />)

		expect(screen.getByLabelText('Notes')).toHaveClass('border-2', 'bg-app-error/10')
		expect(screen.getByLabelText('Notes')).not.toHaveClass('border')
		expect(screen.getByLabelText('Notes')).not.toHaveClass('bg-white')
	})

	/*
	 * The count is the caller's number, not one this component measures.
	 *
	 * ⚠️ That is not a style choice: the box is uncontrolled, `register()` writes the stored value in
	 * through a ref without an `onChange`, and a length measured here would read zero for a note of two
	 * hundred characters until the first keystroke corrected it.
	 */
	it('shows the remaining characters, and nothing at all when no count is given', () => {
		const { rerender } = render(<TextareaField label="Notes" />)

		expect(screen.queryByText(/characters remaining$/)).not.toBeInTheDocument()
		expect(screen.getByLabelText('Notes')).not.toHaveAttribute('aria-describedby')

		rerender(<TextareaField label="Notes" id="field-note" remaining={1985} />)

		expect(screen.getByText('1985 characters remaining')).toBeInTheDocument()
		expect(screen.getByLabelText('Notes')).toHaveAttribute('aria-describedby', 'field-note-remaining')
	})

	// `0` is a count, not a missing one — the box is exactly full and that is the moment the number matters
	// most. A truthiness test here would hide it precisely then.
	it('shows a count of zero', () => {
		render(<TextareaField label="Notes" remaining={0} />)

		expect(screen.getByText('0 characters remaining')).toBeInTheDocument()
	})

	// The number changes while the operator types and nothing else on screen reports it, so it has to be
	// announced rather than merely rendered.
	it('announces the count as it changes', () => {
		render(<TextareaField label="Notes" remaining={12} />)

		expect(screen.getByText('12 characters remaining')).toHaveAttribute('aria-live', 'polite')
	})

	// Both ids, in one attribute: the message says what is wrong and the count says how far past the cap it
	// is, and a screen reader handed only one of the two is handed the half that cannot be acted on.
	it('describes the textarea by its error and its count together', () => {
		render(<TextareaField label="Notes" id="field-note" error="The notes cannot exceed 2000 characters" remaining={-3} />)

		expect(screen.getByLabelText('Notes')).toHaveAttribute('aria-describedby', 'field-note-error field-note-remaining')
	})

	it('renders', () => {
		const { container } = render(<TextareaField label="Notes" id="field-note" />)
		expect(container.firstChild).toMatchSnapshot()
	})

	it('renders with a count', () => {
		const { container } = render(<TextareaField label="Notes" id="field-note" remaining={1985} />)
		expect(container.firstChild).toMatchSnapshot()
	})

	it('renders with an error', () => {
		const { container } = render(<TextareaField label="Notes" id="field-note" error="The notes cannot exceed 2000 characters" />)
		expect(container.firstChild).toMatchSnapshot()
	})
})
