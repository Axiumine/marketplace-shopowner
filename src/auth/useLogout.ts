import { useNavigate } from '@tanstack/react-router'
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
 * Not memoised. The returned function is only ever attached to a click handler — nothing lists it among
 * the dependencies of an effect — so a new identity per render costs a property assignment and buys the
 * caller no obligation to keep it stable.
 */
export const useLogout = (): (() => Promise<void>) => {
	const [, executeLogout] = useMutation(LogoutDocument)
	const navigate = useNavigate()

	return async () => {
		await executeLogout({}, CTX_LOGOUT)
		clearAccessToken()
		clearSession()
		// The address typed at sign-in is dropped here and nowhere else. `/loading` reads it without
		// consuming it, so that React's development double-invoke cannot swallow it between the two runs of
		// the same effect; this is the one moment it genuinely stops describing the current user.
		clearPendingEmail()
		await navigate({ to: '/' })
	}
}
