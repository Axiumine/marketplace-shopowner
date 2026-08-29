import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ENDPOINT } from '@/api/endpoints'
import { getAccessToken } from '@/api/tokenStore'
import { getSession } from '@/auth/session'
import { CLOSE_REFUSED, CONFIRM_LABEL } from '@/features/account/CloseAccount'

import type { GraphQLStub } from '../../helpers/graphql'
import { graphQLError, stubGraphQL } from '../../helpers/graphql'
import { page } from '../../helpers/page'
import { renderRoute } from '../../helpers/render'

const PAGE = '/account'

const OK = { ShopOwnerDel: { data: { shopOwnerDel: true } } }
const OK_LOGOUT = { Logout: { data: { logout: true } } }

/**
 * What the backend actually answers a `logout` sent after the account is gone: every session of that
 * owner was ended by `shopOwnerDel`, so the bearer token names nothing any more.
 *
 * It is the realistic reply rather than the convenient one on purpose — `useLogout` clears the token, the
 * session and the pending address without looking at the result, and this is the fixture that proves the
 * button does not depend on a server that has nothing left to delete.
 */
const GONE_LOGOUT = { Logout: { errors: [graphQLError('Session not found', undefined, 401)], status: 401 } }

const closeButton = () => screen.getByRole('button', { name: /Close my account$/ })

const confirm = async () => {
	await userEvent.click(screen.getByRole('checkbox', { name: CONFIRM_LABEL }))
}

const closes = (stub: GraphQLStub) => stub.calls.filter((call) => call.operationName === 'ShopOwnerDel')

describe('CloseAccount — what it says', () => {
	/*
	 * ⚠️ The four consequences, asserted as copy rather than as a heading. This is the only screen in the
	 * app that states them, and the login screen deliberately cannot: a refused login is a generic
	 * unauthorized on every tier, so that an address cannot be probed for whether it exists, is suspended
	 * or is closed. What that buys in silence there has to be paid for in plain words here.
	 */
	it('says the shops go dark straight away and every session ends', async () => {
		stubGraphQL({})
		await renderRoute(PAGE)

		expect(page().getByText(/off the marketplace straight away/)).toBeInTheDocument()
		expect(page().getByText(/ends every session you have open/)).toBeInTheDocument()
	})

	// ADR-046. The window is an undo window, and the undo is a *re-registration* rather than a login — an
	// owner who reads this as "log in again within thirty days" would sit in front of a refusal.
	it('says how the thirty-day undo is taken', async () => {
		stubGraphQL({})
		await renderRoute(PAGE)

		// The exact string, not a regex: "thirty days" appears twice on this page — once emphasised in the
		// sentence that offers the undo and once in the sentence that says the window closes — and a
		// substring matcher finds both and throws about it.
		expect(page().getByText('thirty days')).toBeInTheDocument()
		expect(page().getByText(/Register again at this same email address/)).toBeInTheDocument()
		expect(page().getByText(/confirm the message we send you/)).toBeInTheDocument()
	})

	// ADR-045: the restore brings the shops back unpublished, and ADR-046 raises `waitApprov` again on
	// this tier. Both are things the owner has to do something about, so both are said.
	it('says what comes back is offline and waiting for approval', async () => {
		stubGraphQL({})
		await renderRoute(PAGE)

		expect(page().getByText('unpublished')).toBeInTheDocument()
		expect(page().getByText(/goes back into the approval queue/)).toBeInTheDocument()
	})

	/*
	 * ⚠️ The one line that exists to close a loophole rather than to inform: ADR-046 leaves `disabled`,
	 * `disabledBy` and `disabledReason` untouched through the restore, so closing and re-registering is
	 * not a way out of a suspension. An owner who believed otherwise would take the one action that costs
	 * them thirty days of catalogue and buys them nothing.
	 */
	it('says a suspension survives the close and only an operator lifts it', async () => {
		stubGraphQL({})
		await renderRoute(PAGE)

		expect(page().getByText(/A suspension is not lifted by closing your account/)).toBeInTheDocument()
		expect(page().getByText(/only an operator can take it off/)).toBeInTheDocument()
	})

	it('says the window ends in an overwrite that cannot be undone', async () => {
		stubGraphQL({})
		await renderRoute(PAGE)

		expect(page().getByText(/your personal details are overwritten/)).toBeInTheDocument()
	})
})

describe('CloseAccount — the gate', () => {
	// A tick and then a press. Not a typed word: what this button does is undoable for thirty days, so the
	// gate is proportionate to a decision that can be taken back — but the half that cannot be taken back
	// is immediate, which is why there is a gate at all.
	it('will not close anything until the box is ticked', async () => {
		const stub = stubGraphQL({})
		await renderRoute(PAGE)

		expect(closeButton()).toBeDisabled()
		expect(closes(stub)).toHaveLength(0)
	})

	it('arms the button when the box is ticked', async () => {
		stubGraphQL({})
		await renderRoute(PAGE)

		await confirm()

		expect(closeButton()).toBeEnabled()
	})

	// The other direction, so the test cannot pass on a button that is enabled from the start: the box is
	// a checkbox rather than a one-way switch, and an owner who reconsiders has to be able to say so.
	it('disarms it again when the box is unticked', async () => {
		stubGraphQL({})
		await renderRoute(PAGE)

		await confirm()
		await confirm()

		expect(closeButton()).toBeDisabled()
	})

	it('states what the tick is agreeing to', async () => {
		stubGraphQL({})
		await renderRoute(PAGE)

		expect(screen.getByRole('checkbox', { name: CONFIRM_LABEL })).toBeInTheDocument()
	})
})

describe('CloseAccount — closing', () => {
	/*
	 * ⚠️ **No variables at all**, and that is the assertion this whole file exists for. `shopOwnerDel`
	 * closes the account the Redis session behind the access token names; an `_id` in this variable set
	 * would ask the backend to accept from a browser the one thing the session already proves, which is
	 * the rule this repo follows for every ShopOwner-tier write.
	 */
	it('closes the account without naming one', async () => {
		const stub = stubGraphQL({ ...OK, ...GONE_LOGOUT })
		await renderRoute(PAGE)

		await confirm()
		await userEvent.click(closeButton())

		await waitFor(() => {
			expect(closes(stub)).toHaveLength(1)
		})
		expect(closes(stub)[0]?.variables).toEqual({})
		expect(closes(stub)[0]?.url).toBe(ENDPOINT.shopOwnerResource)
	})

	/*
	 * The whole point of the button, end to end: the account is closed, the browser is emptied and the
	 * owner is back at the login page.
	 *
	 * The `logout` behind it is answered with a 401 — the realistic reply, since the backend has just
	 * ended every session this account had. Nothing about the teardown may depend on it succeeding.
	 */
	it('signs the owner out and returns to the login page', async () => {
		const stub = stubGraphQL({ ...OK, ...GONE_LOGOUT })
		const { router } = await renderRoute(PAGE)

		await confirm()
		await userEvent.click(closeButton())

		await waitFor(() => {
			expect(router.state.location.pathname).toBe('/')
		})
		expect(stub.calls.map((call) => call.operationName)).toEqual(['ShopOwnerDel', 'Logout'])
		expect(getAccessToken()).toBeNull()
		expect(getSession()).toBeNull()
	})

	// The same ending when the server does still have a session to delete — the button is not written
	// around either answer.
	it('signs the owner out when the logout succeeds too', async () => {
		stubGraphQL({ ...OK, ...OK_LOGOUT })
		const { router } = await renderRoute(PAGE)

		await confirm()
		await userEvent.click(closeButton())

		await waitFor(() => {
			expect(router.state.location.pathname).toBe('/')
		})
		expect(getSession()).toBeNull()
	})

	// The refusal the backend writes a description for — a suspended owner is the case that produces one,
	// and quoting it is the difference between "it did not work" and something the owner can act on.
	it('surfaces the server message when the close is refused', async () => {
		stubGraphQL({
			ShopOwnerDel: { errors: [graphQLError('Forbidden', 'This account is suspended', 403)], status: 403 }
		})
		const { router } = await renderRoute(PAGE)

		await confirm()
		await userEvent.click(closeButton())

		expect(await screen.findByRole('alert')).toHaveTextContent('This account is suspended')
		// Still signed in and still here: nothing was closed, so nothing may be torn down.
		expect(router.state.location.pathname).toBe(PAGE)
		expect(getSession()).not.toBeNull()
	})

	/*
	 * A `false` with no error beside it. The mutation is declared `Boolean!` and answering anything but
	 * `true` is not a state the service produces — which is exactly why the call site tests the value
	 * rather than the absence of an error. A truthiness check here would log the owner out of an account
	 * that is still open.
	 */
	it('reports a close the server did not confirm', async () => {
		stubGraphQL({ ShopOwnerDel: { data: { shopOwnerDel: false } } })
		const { router } = await renderRoute(PAGE)

		await confirm()
		await userEvent.click(closeButton())

		expect(await screen.findByRole('alert')).toHaveTextContent(CLOSE_REFUSED)
		expect(router.state.location.pathname).toBe(PAGE)
		expect(getSession()).not.toBeNull()
	})

	// A second press while the first is still in flight would send a second `shopOwnerDel`. The button is
	// shut for the duration, which is also the only feedback there is between the press and the redirect.
	it('shuts the button while the write is in flight', async () => {
		stubGraphQL({ ShopOwnerDel: { pending: true } })
		await renderRoute(PAGE)

		await confirm()
		await userEvent.click(closeButton())

		await waitFor(() => {
			expect(closeButton()).toBeDisabled()
		})
		expect(screen.getByText('Loading')).toBeInTheDocument()
	})

	it('renders', async () => {
		stubGraphQL({})
		await renderRoute(PAGE)

		expect(screen.getByRole('region', { name: 'Close my account' })).toMatchSnapshot()
	})
})
