import { graphql } from '@gql/logout'

/**
 * Deletes the Redis session and clears the refresh cookie.
 *
 * Always returns `true`, whatever it managed to delete — a logout that fails server-side still has to
 * log the owner out of the browser. The caller therefore does not branch on the result; it clears the
 * in-memory token regardless.
 */
export const LogoutDocument = graphql(`
	mutation Logout {
		logout
	}
`)
