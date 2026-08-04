/**
 * The access token, in memory only.
 *
 * Never localStorage, never sessionStorage, never a readable cookie: a token that JavaScript can read
 * from storage is a token that any successful XSS can exfiltrate, and it survives the tab that leaked
 * it. Keeping it in a module-scoped variable means a page reload loses it — which is exactly the
 * behaviour the refresh flow is built around. The refresh token itself is a signed httpOnly cookie
 * this code cannot see at all, so a reload re-mints the access token from the cookie and nothing was
 * ever persisted client-side.
 */
let accessToken: string | null = null

export const getAccessToken = (): string | null => accessToken

export const setAccessToken = (token: string): void => {
	accessToken = token
}

export const clearAccessToken = (): void => {
	accessToken = null
}
