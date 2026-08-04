import { useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useQuery } from 'urql'

import { CTX_SHOP_OWNER_RESOURCE } from '@/api/endpoints'
import { ShopOwnerCompaniesDocument } from '@/api/operations/shopOwnerResource/queries'
import { clearAccessToken } from '@/api/tokenStore'
import { clearSession, getPendingEmail, setSession } from '@/auth/session'
import { Spinner } from '@/components/ui/Spinner'

export const DEFAULT_REDIRECT = '/home'

/**
 * Where `/loading` is allowed to send the browser next.
 *
 * The target arrives in a query string, so it is attacker-controlled: anyone can hand an owner a link
 * to `/loading?redirect=https://evil.example`, and following it after a successful login turns this app
 * into an open redirect wearing a trusted domain. Only same-site absolute paths pass. `//host` is
 * rejected explicitly — it is a protocol-relative URL, not a path, and it starts with a slash.
 */
export const safeRedirect = (target: string | undefined): string => {
	if (target === undefined) return DEFAULT_REDIRECT
	if (!target.startsWith('/')) return DEFAULT_REDIRECT
	if (target.startsWith('//')) return DEFAULT_REDIRECT
	return target
}

/**
 * The bootstrap screen. Two jobs, both invisible.
 *
 * It is reached in two ways: straight after login, and after a reload of any authenticated page — the
 * access token lives in memory, so a reload has none. Issuing an authenticated query is what re-mints
 * it: urql's `willAuthError` sees a null token, runs the refresh mutation against the httpOnly cookie
 * first, and only then sends the query.
 *
 * ⚠️ There is deliberately no separate "am I signed in?" endpoint. Anything a browser can ask about a
 * cookie it cannot read amounts to checking that one is *present*, which a stale or revoked session
 * passes. A real authenticated query is the only answer that means anything.
 *
 * The probe is `shopOwnerCompanies`, and the operator app's equivalent screen probes with
 * `infoAdminAfterLogin`. Not a preference: the ShopOwner resource service exposes exactly one query,
 * so this is the only authenticated request there is to make. It pays for itself twice over — the
 * result lands in the urql document cache under the same key the companies page asks for, so the
 * probe is also that page's first fetch.
 *
 * What it cannot do is name the owner, which `infoAdminAfterLogin` does. The address comes from the
 * sign-in form instead, and is simply absent when the session was restored from the cookie — see the
 * warning on `ShopOwnerIdentity`.
 */
export const LoadingPage = ({ redirect }: { redirect: string | undefined }) => {
	const navigate = useNavigate()
	const router = useRouter()
	const [result] = useQuery({ query: ShopOwnerCompaniesDocument, context: CTX_SHOP_OWNER_RESOURCE })

	// `!== undefined` and not a truthiness test: the query answers a non-null list, and an owner with no
	// companies yet answers `[]` — which is falsy in every JS sense and is a perfectly good session.
	const authenticated = result.data?.shopOwnerCompanies !== undefined
	const failed = result.error !== undefined

	useEffect(() => {
		if (authenticated) {
			setSession({ email: getPendingEmail() })
			// `history.push` rather than `navigate({ to })`: the target is a runtime string and the
			// router's `to` is a union of known route paths, so this is the one navigation that cannot be
			// type-checked. `safeRedirect` is what makes it safe instead.
			router.history.push(safeRedirect(redirect))
			return
		}

		if (failed) {
			clearAccessToken()
			clearSession()
			void navigate({ to: '/' })
		}
	}, [authenticated, failed, navigate, router, redirect])

	return (
		<div className="flex h-full items-center justify-center">
			<Spinner label="Loading session" />
		</div>
	)
}
