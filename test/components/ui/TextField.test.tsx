import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'

import { TextField } from '@/components/ui/TextField'

describe('TextField', () => {
	it('associates its label with the input', async () => {
		render(<TextField label="Email" />)

		const input = screen.getByLabelText('Email')
		await userEvent.type(input, 'operator@marketplace.it')
		expect(input).toHaveValue('operator@marketplace.it')
	})

	it('generates an id when none is given, so two fields on one page do not collide', () => {
		render(
			<>
				<TextField label="First name" />
				<TextField label="Last name" />
			</>
		)

		const firstName = screen.getByLabelText('First name')
		const lastName = screen.getByLabelText('Last name')
		expect(firstName.id).not.toBe('')
		expect(firstName.id).not.toBe(lastName.id)
	})

	it('uses a caller-supplied id verbatim', () => {
		render(<TextField label="Email" id="field-email" />)
		expect(screen.getByLabelText('Email')).toHaveAttribute('id', 'field-email')
	})

	it('is valid and describes nothing when there is no error', () => {
		render(<TextField label="Email" />)

		const input = screen.getByLabelText('Email')
		expect(input).toHaveAttribute('aria-invalid', 'false')
		expect(input).not.toHaveAttribute('aria-describedby')
	})

	// The message has to be announced *with* the field, not float unattached beneath it — otherwise a
	// screen-reader user hears "Email, field di testo" and never learns why the form refused.
	it('wires the error message to the input', () => {
		render(<TextField label="Email" id="field-email" error="Enter a valid email address" />)

		const input = screen.getByLabelText('Email')
		expect(input).toHaveAttribute('aria-invalid', 'true')
		expect(input).toHaveAttribute('aria-describedby', 'field-email-error')
		expect(document.getElementById('field-email-error')).toHaveTextContent('Enter a valid email address')
	})

	// Without the forwarded ref, react-hook-form's `register()` never reaches the real input: the field
	// is both uncontrolled and unregistered, and the form reads it as permanently empty.
	it('forwards its ref to the input element', () => {
		const ref = createRef<HTMLInputElement>()
		render(<TextField label="Email" ref={ref} />)

		expect(ref.current).toBe(screen.getByLabelText('Email'))
	})

	it('passes the remaining input attributes through', () => {
		render(<TextField label="Email" type="email" autoComplete="username" maxLength={50} />)

		const input = screen.getByLabelText('Email')
		expect(input).toHaveAttribute('type', 'email')
		expect(input).toHaveAttribute('autocomplete', 'username')
		expect(input).toHaveAttribute('maxlength', '50')
	})

	// A field with something pinned inside its box has to reserve the room, or the typed value runs
	// underneath the icon; a field without one must not, or every plain input grows a blank right margin.
	it('reserves room for the trailing slot, and only when there is one', () => {
		const { rerender } = render(<TextField label="Email" />)

		expect(screen.getByLabelText('Email')).toHaveClass('pr-3')
		expect(screen.getByLabelText('Email')).not.toHaveClass('pr-10')
		expect(screen.queryByRole('button')).not.toBeInTheDocument()

		rerender(<TextField label="Email" trailing={<button type="button">Eye</button>} />)

		expect(screen.getByLabelText('Email')).toHaveClass('pr-10')
		expect(screen.getByLabelText('Email')).not.toHaveClass('pr-3')
		expect(screen.getByRole('button', { name: 'Eye' })).toBeInTheDocument()
	})

	// The red message is small text under a box, and on a thirteen-field form the eye still has to find
	// which box it belongs to. Every class is asserted absent in the other state: the two pairs set two
	// properties, so a field carrying both halves of either would be resolved by stylesheet order rather
	// than by the error.
	//
	// The second half of each pair is also what makes the tint go away on its own: the field is re-rendered
	// without the error the moment the value becomes valid, which is this `rerender` in reverse.
	it('doubles its border and turns red when it is invalid', () => {
		const { rerender } = render(<TextField label="Email" />)

		expect(screen.getByLabelText('Email')).toHaveClass('border', 'bg-white')
		expect(screen.getByLabelText('Email')).not.toHaveClass('border-2')
		expect(screen.getByLabelText('Email')).not.toHaveClass('bg-app-error/10')

		rerender(<TextField label="Email" error="Enter a valid email address" />)

		expect(screen.getByLabelText('Email')).toHaveClass('border-2', 'bg-app-error/10')
		expect(screen.getByLabelText('Email')).not.toHaveClass('border')
		expect(screen.getByLabelText('Email')).not.toHaveClass('bg-white')
	})

	it('renders', () => {
		const { container } = render(<TextField label="Email" id="field-email" />)
		expect(container.firstChild).toMatchSnapshot()
	})

	it('renders with a trailing slot', () => {
		const { container } = render(<TextField label="Email" id="field-email" trailing={<button type="button">Eye</button>} />)
		expect(container.firstChild).toMatchSnapshot()
	})

	it('renders with an error', () => {
		const { container } = render(<TextField label="Email" id="field-email" error="Enter a valid email address" />)
		expect(container.firstChild).toMatchSnapshot()
	})
})
