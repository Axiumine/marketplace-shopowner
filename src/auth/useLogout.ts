import { useMutation } from 'urql'

import { CTX_LOGOUT } from '@/api/endpoints'
import { LogoutDocument } from '@/api/operations/logout/logout'
import { clearAccessToken } from '@/api/tokenStore'
import { clearPendingEmail, clearSession } from '@/auth/session'

/**
 * Ends the session and returns to the login page.
 *
 * The local state is cleared unconditionally, without looking at the mutation result. `logout` returns
 * `true` whatever it managed to delete server-side, and a logout that failed on the server still has
 * to log the owner out of this browser — leaving a token in memory because a request went wrong is
 * the opposite of what the button promises.
 *
 * urql resolves mutation errors into the result instead of rejecting, so there is no rejection path to
 * guard here.
 *
 * ⚠️ **`location.assign`, not a router navigation, and the reload is the point.** The urql client is a
 * module singleton built once per page load, and `cacheExchange` is a document cache keyed by query and
 * variables — nothing about it is keyed by *who asked*. Clearing the token and the session leaves every
 * cached result standing, so a second sign-in inside the same page load can be served the previous
 * owner's rows: the reads that matter here take no variables at all, which makes the keys identical
 * across the two sessions. A full load rebuilds every module at once — the cache, the token store, the
 * session store, the pending address, and anything a later feature parks at module scope — which is what
 * makes this correct by construction rather than a list of stores somebody has to remember to extend.
 *
 * Nothing is awaited after it: `assign` starts a navigation the browser finishes on its own, and the
 * page it lands on is a fresh document either way.
 *
 * Not memoised. The returned function is only ever attached to a click handler — nothing lists it among
 * the dependencies of an effect — so a new identity per render costs a property assignment and buys the
 * caller no obligation to keep it stable.
 */
export const useLogout = (): (() => Promise<void>) => {
	const [, executeLogout] = useMutation(LogoutDocument)

	return async () => {
		await executeLogout({}, CTX_LOGOUT)
		clearAccessToken()
		clearSession()
		// The address typed at sign-in is dropped here and nowhere else. `/loading` reads it without
		// consuming it, so that React's development double-invoke cannot swallow it between the two runs of
		// the same effect; this is the one moment it genuinely stops describing the current user.
		clearPendingEmail()
		window.location.assign('/')
	}
}
