import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Button } from '@/components/ui/Button'

describe('Button', () => {
	// HTML's default is `submit`, which makes every unmarked button inside a form submit it — the classic
	// way a "Show password" toggle ends up posting a half-typed login.
	it('defaults to type=button, not submit', () => {
		render(<Button>Save</Button>)
		expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button')
	})

	it('lets a form opt in to submitting', () => {
		render(<Button type="submit">Sign in</Button>)
		expect(screen.getByRole('button', { name: 'Sign in' })).toHaveAttribute('type', 'submit')
	})

	it('calls its handler on click', async () => {
		const onClick = vi.fn()
		render(<Button onClick={onClick}>Logout</Button>)

		await userEvent.click(screen.getByRole('button', { name: 'Logout' }))
		expect(onClick).toHaveBeenCalledTimes(1)
	})

	it('is disabled when asked', () => {
		render(<Button disabled>Save</Button>)
		expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
	})

	// A loading button is always disabled, never one alone: a second click while the first request is in
	// flight sends the mutation twice.
	it('is disabled while loading and shows a spinner', () => {
		render(<Button loading>Save</Button>)

		expect(screen.getByRole('button', { name: /Save/ })).toBeDisabled()
		expect(screen.getByRole('status')).toHaveTextContent('Loading')
	})

	it('is enabled, and spinner-free, when neither disabled nor loading', () => {
		render(<Button>Save</Button>)

		expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
		expect(screen.queryByRole('status')).not.toBeInTheDocument()
	})

	// One padding or the other, never both: they set the same property, so a button carrying `px-4` and
	// `px-[30px]` at once would be resolved by stylesheet order rather than by the prop.
	it('takes its horizontal padding from the prop', () => {
		const { rerender } = render(<Button>Save</Button>)

		expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('px-4')
		expect(screen.getByRole('button', { name: 'Save' })).not.toHaveClass('px-[30px]')

		rerender(<Button padding="form">Save</Button>)

		expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('px-[30px]')
		expect(screen.getByRole('button', { name: 'Save' })).not.toHaveClass('px-4')
	})

	it.each(['primary', 'ghost', 'danger'] as const)('renders the %s variant', (variant) => {
		const { container } = render(<Button variant={variant}>Action</Button>)
		expect(container.firstChild).toMatchSnapshot()
	})

	it('renders the loading state', () => {
		const { container } = render(<Button loading>Action</Button>)
		expect(container.firstChild).toMatchSnapshot()
	})
})
