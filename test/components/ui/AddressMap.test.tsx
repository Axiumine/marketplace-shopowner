import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AddressMap } from '@/components/ui/AddressMap'

describe('AddressMap', () => {
	it('renders', () => {
		// `container`, not `container.firstChild`: the component returns a fragment — the framed iframe
		// and the attribution paragraph are two root siblings, and `firstChild` alone would drop the second.
		const { container } = render(<AddressMap lat={42.3601} lon={-71.06} title="Address map" />)
		expect(container).toMatchSnapshot()
	})
})
