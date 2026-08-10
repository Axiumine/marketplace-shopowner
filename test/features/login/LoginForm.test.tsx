import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { stubGraphQL } from '../../helpers/graphql'
import { renderRoute } from '../../helpers/render'

const signedOut = { token: null, session: null } as const

/**
 * ⚠️ Rendered through `renderRoute`, not a bare `render()`: the form calls `useNavigate` on submit, which
 * reads the router context, and `/` is where the app actually mounts it — a hand-built wrapper would test
 * the form against a router shape no owner's browser produces.
 */
describe('LoginForm', () => {
	it('renders', async () => {
		stubGraphQL({})
		await renderRoute('/', signedOut)

		expect(screen.getByRole('heading', { name: 'Login', level: 2 }).closest('form')).toMatchSnapshot()
	})
})
