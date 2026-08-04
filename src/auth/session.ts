import { useSyncExternalStore } from 'react'

/**
 * Whether a shop owner is signed in, and who they are when that is knowable.
 *
 * A module store rather than React context, for one reason: TanStack Router's `beforeLoad` guard runs
 * outside React and has to read the session synchronously to decide a redirect. `useSyncExternalStore`
 * then gives components the same value without a second source of truth.
 *
 * Nothing is persisted, deliberately. Backing this with localStorage would leave a signed-out browser
 * still advertising the last owner's address to anything that can read storage. A reload starts empty
 * and `/loading` re-derives the session from the refresh cookie — the same round-trip the access token
 * already needs.
 *
 * ⚠️ `email` is nullable, and the operator app's equivalent is not. That is a backend gap, not a
 * design choice: the ShopOwner resource service exposes exactly one query, `shopOwnerCompanies`, and
 * has no `infoShopOwnerAfterLogin` to answer "who am I" with. The address is therefore known only on
 * the sign-in that supplied it, and is `null` for the rest of the session after any reload — at which
 * point the sidebar simply stops naming it. Adding that query to
 * marketplace-dev-authenticated-resource is what would close this; nothing on the frontend can.
 *
 * The distinction that matters is `null` session versus non-null: a non-null session means an
 * authenticated round-trip has succeeded, whatever it managed to learn about the owner.
 */
export interface ShopOwnerIdentity {
	/** The address typed at sign-in, or `null` when the session was restored from the cookie instead. */
	readonly email: string | null
}

let current: ShopOwnerIdentity | null = null
const listeners = new Set<() => void>()

const emit = (): void => {
	listeners.forEach((listener) => {
		listener()
	})
}

export const getSession = (): ShopOwnerIdentity | null => current

export const setSession = (identity: ShopOwnerIdentity): void => {
	current = identity
	emit()
}

export const clearSession = (): void => {
	current = null
	emit()
}

export const subscribeSession = (listener: () => void): (() => void) => {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

export const useSession = (): ShopOwnerIdentity | null => useSyncExternalStore(subscribeSession, getSession, getSession)

/**
 * The address the sign-in form supplied, held until `/loading` turns it into a session.
 *
 * Login and the bootstrap screen are two navigations apart — the form mints the token and sends the
 * browser to `/loading`, which is where the session is actually established — so the one thing the
 * form knows about the owner has to survive that hop. A module variable rather than a search param:
 * an address in the URL would be in the browser history and in every nginx access log.
 *
 * ⚠️ Reading it deliberately does **not** clear it, and a read-and-clear here would be a StrictMode
 * bug rather than a tidier API: `/loading` establishes the session from inside an effect, React runs
 * every effect twice in development, and the second run would find the address already taken and
 * overwrite the session with a nameless one. Clearing is `useLogout`'s job, which is the one moment
 * the address genuinely stops being current. Nothing survives a reload either way — this is a module
 * variable, and a page load rebuilds the module.
 */
let pendingEmail: string | null = null

export const setPendingEmail = (email: string): void => {
	pendingEmail = email
}

export const getPendingEmail = (): string | null => pendingEmail

export const clearPendingEmail = (): void => {
	pendingEmail = null
}
