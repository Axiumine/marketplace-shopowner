import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { stubGraphQL } from '../../helpers/graphql'
import { renderRoute } from '../../helpers/render'

/**
 * ⚠️ Rendered through `renderRoute`, not a bare `render()`: the tile is a `Link`, which reads the router
 * context, so it is mounted at the one dashboard tile that carries it — `/home`'s "Companies" tile — rather
 * than against a router shape assembled by hand.
 */
describe('WigButton', () => {
	it('renders', async () => {
		stubGraphQL({})
		await renderRoute('/home')

		expect(screen.getByRole('link', { name: /Companies\s*Manage your companies/ })).toMatchSnapshot()
	})
})
