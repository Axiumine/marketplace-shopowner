import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef, type SyntheticEvent } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { PasswordField } from '@/components/ui/PasswordField'

describe('PasswordField', () => {
	it('starts masked', () => {
		render(<PasswordField label="Password" />)

		expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
		expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument()
	})

	it('reveals and re-masks the value', async () => {
		render(<PasswordField label="Password" />)

		await userEvent.click(screen.getByRole('button', { name: 'Show password' }))
		expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text')

		await userEvent.click(screen.getByRole('button', { name: 'Hide password' }))
		expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
	})

	// The failure mode this guards: a toggle that defaults to `type="submit"` turns a peek at the
	// password into a login attempt with whatever has been typed so far.
	it('does not submit the form it sits in', async () => {
		// SyntheticEvent, not the deprecated FormEvent: a handler taking the wider type still
		// satisfies onSubmit, and `React.*` here would be a UMD global reference in a module.
		const onSubmit = vi.fn((event: SyntheticEvent) => {
			event.preventDefault()
		})
		render(
			<form onSubmit={onSubmit}>
				<PasswordField label="Password" />
			</form>
		)

		await userEvent.click(screen.getByRole('button', { name: 'Show password' }))
		expect(onSubmit).not.toHaveBeenCalled()
	})

	// The point of the control: an eye glyph inside the box, not a line of text under it. That leaves
	// `aria-label` as the only thing naming the button — without it the toggle announces as an unnamed
	// control — and the glyph itself has to stay out of the accessibility tree, or it reads as a second.
	it('names the icon-only toggle, and hides the glyph from assistive tech', () => {
		render(<PasswordField label="Password" />)

		const toggle = screen.getByRole('button', { name: 'Show password' })
		expect(toggle.textContent).toBe('')
		expect(toggle.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
		expect(toggle).toHaveAttribute('title', 'Show password')
	})

	// The toggle sits *inside* the field, so it has to be inside the box the input draws — a sibling of
	// the input, not of the whole labelled group, which is where a merely-adjacent button would land.
	it('puts the toggle inside the input box', () => {
		render(<PasswordField label="Password" />)

		const input = screen.getByLabelText('Password')
		const toggle = screen.getByRole('button', { name: 'Show password' })
		expect(input.parentElement).toContainElement(toggle)
		expect(input).toHaveClass('pr-10')
	})

	it('shows the validation error and forwards its ref', () => {
		const ref = createRef<HTMLInputElement>()
		render(<PasswordField label="Password" error="Enter the password" ref={ref} />)

		expect(screen.getByText('Enter the password')).toBeInTheDocument()
		expect(ref.current).toBe(screen.getByLabelText('Password'))
	})

	it('renders masked', () => {
		const { container } = render(<PasswordField label="Password" id="field-password" />)
		expect(container.firstChild).toMatchSnapshot()
	})

	it('renders revealed', async () => {
		const { container } = render(<PasswordField label="Password" id="field-password" />)
		await userEvent.click(screen.getByRole('button', { name: 'Show password' }))

		expect(container.firstChild).toMatchSnapshot()
	})
})
