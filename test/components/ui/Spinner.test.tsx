import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Spinner } from '@/components/ui/Spinner'

describe('Spinner', () => {
	it('announces a generic wait by default', () => {
		render(<Spinner />)
		expect(screen.getByRole('status')).toHaveTextContent('Loading')
	})

	it('announces what is being waited for when told', () => {
		render(<Spinner label="Loading shop owners" />)
		expect(screen.getByRole('status')).toHaveTextContent('Loading shop owners')
	})

	it('renders', () => {
		const { container } = render(<Spinner label="Loading session" />)
		expect(container.firstChild).toMatchSnapshot()
	})
})
