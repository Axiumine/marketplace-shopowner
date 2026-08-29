import { Link } from '@tanstack/react-router'

import { useSession } from '@/auth/session'
import { useLogout } from '@/auth/useLogout'
import { Button } from '@/components/ui/Button'

/**
 * The four sections of the shop-owner app.
 *
 * The `prefixes` list is kept even though every entry currently holds exactly one path equal to `to`.
 * It exists so a section whose pages live under a different prefix — the admin app puts its detail
 * and add screens under `/p/shopOwners/…` — can still light up its own tab, and so that adding such a
 * page is an edit to this one table rather than a highlight rule scattered across the pages. Anything
 * that makes each page announce its own highlight goes stale the first time a page forgets.
 *
 * `Account` is not the Settings entry this file used to say did not exist, and the reason it once gave
 * still holds: `marketplace-dev-authenticated-resource` has no `shopOwnerUpdatePwd` and no self-service
 * personal-data mutation, so a settings page here would have nothing to submit. What it does have is
 * `shopOwnerDel`, one mutation the owner can send about their own account — which is the whole of that
 * section and the reason it earns a tab.
 */
const SECTIONS = [
	{ to: '/home', label: 'Dashboard', prefixes: ['/home'] },
	{ to: '/companies', label: 'Companies', prefixes: ['/companies'] },
	// Its own section rather than a tab inside Companies: a catalogue is per shop, but the page is about
	// the items and the shop is one select at the top of it.
	{ to: '/items', label: 'Items', prefixes: ['/items'] },
	{ to: '/account', label: 'Account', prefixes: ['/account'] }
] as const

export const isSectionActive = (pathname: string, prefixes: readonly string[]): boolean =>
	prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))

export const SideMenu = ({ pathname }: { pathname: string }) => {
	const session = useSession()
	const logout = useLogout()

	return (
		<nav aria-label="Main menu" className="flex h-full w-56 flex-col bg-secondary p-4">
			<p className="mb-6 text-lg font-bold text-third">Marketplace</p>

			<ul className="flex flex-col gap-1">
				{SECTIONS.map((section) => (
					<li key={section.to}>
						<Link
							to={section.to}
							className={`block rounded-box px-3 py-2 text-sm ${
								isSectionActive(pathname, section.prefixes) ? 'bg-palette-bg1 font-bold' : ''
							}`}
						>
							{section.label}
						</Link>
					</li>
				))}
			</ul>

			<div className="mt-auto flex flex-col gap-2">
				{/*
				 * Two states render nothing here, for different reasons. Signed out is real but brief:
				 * `useLogout` clears the session before it navigates away, so this menu re-renders once with
				 * nothing to show. A session with a `null` email is the durable one — the address is only ever
				 * known from the login form, so a session restored from the refresh cookie after a reload has
				 * none, and this tier has no query to ask for it.
				 *
				 * Both render nothing rather than an empty string: a blank paragraph would leave its padding
				 * behind, and a blank strip reads as a failed load rather than as an absent address.
				 */}
				{session?.email == null ? null : <p className="text-xs break-all text-tip">{session.email}</p>}
				<Button
					variant="ghost"
					onClick={() => {
						void logout()
					}}
				>
					Logout
				</Button>
			</div>
		</nav>
	)
}
