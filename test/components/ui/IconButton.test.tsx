import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { IconButton } from '@/components/ui/IconButton'
import { IconPen } from '@/components/ui/icons'

describe('IconButton', () => {
	it('renders', () => {
		const { container } = render(
			<IconButton name="Change Mobile" onClick={() => {}}>
				<IconPen />
			</IconButton>
		)
		expect(container.firstChild).toMatchSnapshot()
	})
})
