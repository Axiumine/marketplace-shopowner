import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { FormSubmit } from '@/components/ui/FormSubmit'

describe('FormSubmit', () => {
	it('submits the form it ends', () => {
		render(<FormSubmit>Create shopOwner</FormSubmit>)
		expect(screen.getByRole('button', { name: 'Create shopOwner' })).toHaveAttribute('type', 'submit')
	})

	// The button is `inline-flex`: as the direct child of a flex column it would be stretched to the
	// column's width, and on a two-column form that is a metre of button. The row is what stops it, and
	// `col-span-full` is what puts it under both columns instead of at the foot of the first.
	it('sits on a full-width row that pins it to the right edge', () => {
		const { container } = render(<FormSubmit>Create shopOwner</FormSubmit>)

		const row = container.firstChild
		expect(row).toHaveClass('col-span-full', 'flex', 'justify-end')
		expect(screen.getByRole('button', { name: 'Create shopOwner' })).toHaveClass('px-[30px]')
	})

	it('is idle until the form says otherwise', () => {
		render(<FormSubmit>Create shopOwner</FormSubmit>)

		expect(screen.getByRole('button', { name: 'Create shopOwner' })).toBeEnabled()
		expect(screen.queryByRole('status')).not.toBeInTheDocument()
	})

	it('shows the spinner and blocks a second submit while the form is in flight', () => {
		render(<FormSubmit loading>Create shopOwner</FormSubmit>)

		expect(screen.getByRole('button', { name: /Create shopOwner/ })).toBeDisabled()
		expect(screen.getByRole('status')).toHaveTextContent('Loading')
	})

	it('renders', () => {
		const { container } = render(<FormSubmit>Create shopOwner</FormSubmit>)
		expect(container.firstChild).toMatchSnapshot()
	})
})
