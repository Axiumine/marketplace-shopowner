import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Alert } from '@/components/ui/Alert'

describe('Alert', () => {
	// `alert` is an assertive live region and interrupts whatever a screen reader is saying. Right for a
	// failed login, wrong for "saved" — so the tone decides the role, and that mapping is the one
	// thing in this component that can be wrong.
	it('announces an error assertively', () => {
		render(<Alert tone="error">Invalid credentials</Alert>)
		expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials')
	})

	it('announces a success politely', () => {
		render(<Alert tone="success">Password updated</Alert>)
		expect(screen.getByRole('status')).toHaveTextContent('Password updated')
	})

	it('announces information politely', () => {
		render(<Alert tone="info">No data</Alert>)
		expect(screen.getByRole('status')).toHaveTextContent('No data')
	})

	it.each(['error', 'success', 'info'] as const)('renders the %s tone', (tone) => {
		const { container } = render(<Alert tone={tone}>Message</Alert>)
		expect(container.firstChild).toMatchSnapshot()
	})
})
