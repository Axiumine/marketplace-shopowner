import type { CombinedError } from '@urql/core'

/**
 * The platform's error transport.
 *
 * The backend uses `extensions.code` for exactly one failure — the lost refresh race of E14-S04, read by
 * `isRefreshRaceRetry` below. Everything else is raised through koa-utils'
 * `throwGraphQLError(status, title, desc)`, which builds
 *
 *   new GraphQLError(title, { extensions: { http: { status }, description: desc } })
 *
 * Apollo Server reads `extensions.http` and turns it into the response's real HTTP status, which is
 * why the status is read off `error.response` first: that value is present whether or not Apollo also
 * echoes the `http` extension back in the body. The extension is the fallback, for the case where a
 * proxy has rewritten the status but the body survived intact.
 */
export const HTTP = {
	badRequest: 400,
	unauthorized: 401,
	forbidden: 403,
	preconditionFailed: 412,
	/** Access token expired or deleted from Redis. The one status that means "refresh and retry". */
	invalidToken: 498,
	tokenRequired: 499,
	internal: 500
} as const

/**
 * Statuses that mean the session is gone for good — no refresh can recover them.
 *
 * Typed to admit `undefined` so `isSessionGone` can hand it a status that was never found without a
 * guard of its own. A `status !== undefined &&` in front of the lookup reads as a safety check but is
 * not one: `undefined` is not in the list, so the answer is `false` either way.
 */
const SESSION_GONE: readonly (number | undefined)[] = [HTTP.unauthorized, HTTP.preconditionFailed, HTTP.tokenRequired]

/**
 * One property off a value of unknown shape.
 *
 * Deliberately unguarded: `?.` already answers `undefined` for `null` and for `undefined`, and reading a
 * missing key off a string or a number answers `undefined` too. A `typeof value === 'object'` test in
 * front of it would change nothing a caller can observe — the platform's own error payloads are the
 * only values that reach here — so the check is left out rather than written and never exercised.
 */
const prop = (value: unknown, key: string): unknown => (value as Record<string, unknown> | undefined)?.[key]

/**
 * The platform status behind a urql error, or undefined when the failure never reached the server
 * (DNS, offline, aborted request).
 */
export const statusOf = (error: CombinedError | undefined): number | undefined => {
	if (error === undefined) return undefined

	const responseStatus = prop(error.response, 'status')
	if (typeof responseStatus === 'number') return responseStatus

	const extensionHttp = prop(prop(error.graphQLErrors[0]?.extensions, 'http'), 'status')
	return typeof extensionHttp === 'number' ? extensionHttp : undefined
}

/** `extensions.description` — the long form the backend writes for the owner, when it wrote one. */
export const descriptionOf = (error: CombinedError | undefined): string | undefined => {
	const description = prop(error?.graphQLErrors[0]?.extensions, 'description')
	return typeof description === 'string' && description !== '' ? description : undefined
}

export const isAuthExpired = (error: CombinedError | undefined): boolean => statusOf(error) === HTTP.invalidToken

export const isSessionGone = (error: CombinedError | undefined): boolean => SESSION_GONE.includes(statusOf(error))

/**
 * The refresh the backend answered with "another request of yours just rotated this token, send it again"
 * (E14-S04) — the loser of a multi-tab race, which is ordinary use rather than a dead session.
 *
 * ⚠️ **This string is `throwRefreshRaceRetry`'s `REFRESH_RACE_RETRY_CODE` in `marketplace-common`, and
 * nothing checks that the two agree.** A rename on either side turns every lost race back into a logout,
 * silently, in all three SPAs at once. It is duplicated rather than imported because the backend package
 * is a Node-only ESM library this bundle does not depend on.
 *
 * Matched on the code alone and not on the 409 beside it: the status is what nginx and the browser act on,
 * the code is what this client branches on, and a proxy that rewrites the status must not be able to turn a
 * retry into a logout. The service raising it is same-origin, so nothing else can put this code on the wire.
 */
export const REFRESH_RACE_RETRY_CODE = 'REFRESH_RACE_RETRY'

export const isRefreshRaceRetry = (error: CombinedError | undefined): boolean =>
	prop(error?.graphQLErrors[0]?.extensions, 'code') === REFRESH_RACE_RETRY_CODE

/**
 * What to put in front of the owner.
 *
 * Preference order: the backend's `description`, then the GraphQL error's own message (the `title`
 * argument of `throwGraphQLError`), then a generic line. A `CombinedError` with no GraphQL errors at
 * all is a transport failure, and saying "server unreachable" for a 401 would be a lie — hence the
 * split on whether any GraphQL error came back.
 */
export const messageOf = (error: CombinedError | undefined): string => {
	if (error === undefined) return ''

	const description = descriptionOf(error)
	if (description !== undefined) return description

	const first = error.graphQLErrors[0]
	if (first !== undefined && first.message !== '') return first.message

	return 'Error while communicating with the server'
}
