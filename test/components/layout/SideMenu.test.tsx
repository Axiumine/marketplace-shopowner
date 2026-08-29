import { act, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { clearSession, setSession } from '@/auth/session'
import { isSectionActive } from '@/components/layout/SideMenu'

import { stubGraphQL } from '../../helpers/graphql'
import { OWNER, renderRoute } from '../../helpers/render'

const noCompanies = { ShopOwnerCompanies: { data: { shopOwnerCompanies: [] } } }

/*
 * ⚠️ The pure function is tested against prefixes no route in this app serves, and that is deliberate.
 * Every section here currently holds one prefix equal to its own `to`, so an exact `===` would pass every
 * sidebar test below — the list exists for the page that lives under a *different* prefix, which
 * is the shape the operator app already has (`/p/shopOwners/…` under a `/shopOwners` section) and the
 * shape this app takes the first time a company gets a detail screen. Testing the function only through
 * the two routes that exist would let that generality be deleted without a single failure.
 */
describe('isSectionActive', () => {
	it('matches the prefix exactly', () => {
		expect(isSectionActive('/home', ['/home'])).toBe(true)
	})

	it('matches a path below the prefix', () => {
		expect(isSectionActive('/p/companies/id/65f0', ['/companies', '/p/companies'])).toBe(true)
	})

	// `/companiesx` is not inside `/companies`. A bare `startsWith` says it is, which is why the check
	// tests for the separator too.
	it('does not match a sibling that merely starts with the same letters', () => {
		expect(isSectionActive('/companiesx', ['/companies'])).toBe(false)
	})

	it('does not match an unrelated path', () => {
		expect(isSectionActive('/home', ['/companies'])).toBe(false)
	})

	it('is false when there is no prefix to match', () => {
		expect(isSectionActive('/home', [])).toBe(false)
	})
})

describe('SideMenu', () => {
	/*
	 * ⚠️ Four entries, and the assertion is that there are exactly four. `Account` is not the Settings
	 * entry the operator app carries: that one changes a password through `adminUpdatePwd`, an Admin-tier
	 * mutation with no counterpart here, and this tier still has no `shopOwnerUpdatePwd` and no
	 * self-service personal-data mutation at all. What it has is `shopOwnerDel` — one thing the owner can
	 * submit about their own account, which is the whole of that section.
	 *
	 * Items is its own section rather than a tab inside Companies: a catalogue is per shop, but the page
	 * is about the items and the shop is one select at the top of it.
	 */
	it('lists the four sections and no fifth', async () => {
		stubGraphQL({})
		await renderRoute('/home')

		const menu = within(screen.getByRole('navigation', { name: 'Main menu' }))
		expect(menu.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/home')
		expect(menu.getByRole('link', { name: 'Companies' })).toHaveAttribute('href', '/companies')
		expect(menu.getByRole('link', { name: 'Items' })).toHaveAttribute('href', '/items')
		expect(menu.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account')
		expect(menu.getAllByRole('link')).toHaveLength(4)
		expect(menu.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
	})

	it('highlights the section the owner is standing in', async () => {
		stubGraphQL({})
		await renderRoute('/home')

		const menu = within(screen.getByRole('navigation', { name: 'Main menu' }))
		expect(menu.getByRole('link', { name: 'Dashboard' })).toHaveClass('font-bold')
		expect(menu.getByRole('link', { name: 'Companies' })).not.toHaveClass('font-bold')
		expect(menu.getByRole('link', { name: 'Items' })).not.toHaveClass('font-bold')
		expect(menu.getByRole('link', { name: 'Account' })).not.toHaveClass('font-bold')
	})

	// The other way round, so neither test can pass on a sidebar that hardcodes one highlight. Scoped to
	// the sidebar: the companies page carries a breadcrumb trail with a "Dashboard" link of its own, and
	// an unscoped query matches both.
	it('moves the highlight with the route', async () => {
		stubGraphQL(noCompanies)
		await renderRoute('/companies')

		const menu = within(screen.getByRole('navigation', { name: 'Main menu' }))
		expect(menu.getByRole('link', { name: 'Companies' })).toHaveClass('font-bold')
		expect(menu.getByRole('link', { name: 'Dashboard' })).not.toHaveClass('font-bold')
	})

	// The third section, on the page that carries one select and no cards until a shop is chosen.
	it('highlights the catalogue on its own route', async () => {
		stubGraphQL(noCompanies)
		await renderRoute('/items')

		const menu = within(screen.getByRole('navigation', { name: 'Main menu' }))
		expect(menu.getByRole('link', { name: 'Items' })).toHaveClass('font-bold')
		expect(menu.getByRole('link', { name: 'Companies' })).not.toHaveClass('font-bold')
	})

	// The fourth section, on the one page of this app that is about the owner rather than about a shop.
	it('highlights the account section on its own route', async () => {
		stubGraphQL({})
		await renderRoute('/account')

		const menu = within(screen.getByRole('navigation', { name: 'Main menu' }))
		expect(menu.getByRole('link', { name: 'Account' })).toHaveClass('font-bold')
		expect(menu.getByRole('link', { name: 'Items' })).not.toHaveClass('font-bold')
	})

	it('shows who is signed in', async () => {
		stubGraphQL({})
		await renderRoute('/home')

		expect(screen.getByText(OWNER.email as string)).toBeInTheDocument()
	})

	/*
	 * ⚠️ The durable empty state, and the one with no counterpart in the operator app: a session restored
	 * from the refresh cookie carries `email: null`, because the login form is the only place this app
	 * ever learns the address and a reload rebuilds the module. It is a real session — the sidebar is
	 * standing, the owner is signed in — with nobody to name.
	 *
	 * `null` and not `undefined` in the check that renders it: `session?.email == null` covers both, and
	 * a strict `!== undefined` would print the word "null" into the sidebar.
	 */
	it('shows the menu with no address after a reload', async () => {
		stubGraphQL({})
		await renderRoute('/home', { session: { email: null } })

		expect(screen.getByRole('navigation', { name: 'Main menu' })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument()
		expect(screen.queryByText('null')).not.toBeInTheDocument()
		expect(screen.queryByText(OWNER.email as string)).not.toBeInTheDocument()
	})

	/*
	 * The window `useLogout` opens: it clears the session and only then navigates, so the menu renders
	 * once with nobody signed in. The address has to go with it — a stale email under a "Logout" button
	 * that has already fired is worse than none.
	 *
	 * The two positive assertions are what make this a test of the empty state rather than a test that
	 * something went wrong: reading `session.email` unconditionally throws during render, React 19
	 * unmounts the whole root when a render throws, and an unmounted root satisfies an assertion that
	 * only asks for the address to be absent. Requiring the menu to still be standing tells the two apart.
	 */
	it('shows nobody once the session is cleared', async () => {
		stubGraphQL({})
		await renderRoute('/home')

		act(() => {
			clearSession()
		})

		expect(screen.queryByText(OWNER.email as string)).not.toBeInTheDocument()
		expect(screen.getByRole('navigation', { name: 'Main menu' })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument()
	})

	// The address is re-rendered from the store rather than read once at mount: `/loading` establishes the
	// session inside an effect, so the menu is mounted before there is anybody to name.
	it('picks up an address that arrives after it is mounted', async () => {
		stubGraphQL({})
		await renderRoute('/home', { session: { email: null } })

		act(() => {
			setSession(OWNER)
		})

		expect(screen.getByText(OWNER.email as string)).toBeInTheDocument()
	})

	it('renders', async () => {
		stubGraphQL({})
		await renderRoute('/home')

		expect(screen.getByRole('navigation', { name: 'Main menu' })).toMatchSnapshot()
	})
})
