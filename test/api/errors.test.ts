import { CombinedError } from '@urql/core'
import { GraphQLError } from 'graphql'
import { describe, expect, it } from 'vitest'

import {
	descriptionOf,
	HTTP,
	isAuthExpired,
	isRefreshRaceRetry,
	isSessionGone,
	messageOf,
	REFRESH_RACE_RETRY_CODE,
	statusOf
} from '@/api/errors'

/** A `CombinedError` shaped the way `koa-utils`' `throwGraphQLError` puts it on the wire. */
const backendError = (
	title: string,
	{ status, description, response, code }: { status?: number; description?: string; response?: unknown; code?: string } = {}
): CombinedError =>
	new CombinedError({
		graphQLErrors: [
			new GraphQLError(title, {
				extensions: {
					...(status === undefined ? {} : { http: { status } }),
					...(description === undefined ? {} : { description }),
					...(code === undefined ? {} : { code })
				}
			})
		],
		response
	})

describe('HTTP', () => {
	it('is the platform status vocabulary, 498 included', () => {
		expect(HTTP).toEqual({
			badRequest: 400,
			unauthorized: 401,
			forbidden: 403,
			preconditionFailed: 412,
			invalidToken: 498,
			tokenRequired: 499,
			internal: 500
		})
	})
})

describe('statusOf', () => {
	it('is undefined without an error', () => {
		expect(statusOf(undefined)).toBeUndefined()
	})

	it('prefers the real HTTP status off the response', () => {
		expect(statusOf(backendError('Expired', { status: 400, response: { status: 498 } }))).toBe(498)
	})

	it('falls back to `extensions.http.status` when the response carries no status', () => {
		expect(statusOf(backendError('Expired', { status: 498 }))).toBe(498)
	})

	it('ignores a non-numeric status on the response', () => {
		expect(statusOf(backendError('Expired', { status: 412, response: { status: 'boom' } }))).toBe(412)
	})

	it('ignores a non-numeric status in the extensions', () => {
		expect(
			statusOf(
				new CombinedError({
					graphQLErrors: [new GraphQLError('Broken', { extensions: { http: { status: 'fourhundred' } } })]
				})
			)
		).toBeUndefined()
	})

	it('is undefined for a transport failure, which never reached the server', () => {
		expect(statusOf(new CombinedError({ networkError: new Error('offline') }))).toBeUndefined()
	})

	// `response` is typed `any` by urql and is whatever the fetch layer produced. A primitive there must
	// not be read as an object, or the property access throws inside an error handler.
	it('survives a non-object response', () => {
		expect(statusOf(new CombinedError({ networkError: new Error('offline'), response: 'kaputt' }))).toBeUndefined()
	})
})

describe('descriptionOf', () => {
	it('is undefined without an error', () => {
		expect(descriptionOf(undefined)).toBeUndefined()
	})

	it('reads the backend long form', () => {
		expect(descriptionOf(backendError('Wrong password', { description: 'Current password does not match' }))).toBe(
			'Current password does not match'
		)
	})

	it('is undefined when the backend wrote no description', () => {
		expect(descriptionOf(backendError('Wrong password'))).toBeUndefined()
	})

	// An empty description is a description the backend did not write; falling through to the title is
	// better than rendering a blank alert box.
	it('treats an empty description as absent', () => {
		expect(descriptionOf(backendError('Wrong password', { description: '' }))).toBeUndefined()
	})

	it('ignores a non-string description', () => {
		expect(
			descriptionOf(new CombinedError({ graphQLErrors: [new GraphQLError('Broken', { extensions: { description: 42 } })] }))
		).toBeUndefined()
	})

	it('is undefined for a transport failure with no GraphQL error at all', () => {
		expect(descriptionOf(new CombinedError({ networkError: new Error('offline') }))).toBeUndefined()
	})
})

describe('isAuthExpired', () => {
	it('is true only for 498, the one status a refresh can fix', () => {
		expect(isAuthExpired(backendError('Invalid token', { status: 498 }))).toBe(true)
	})

	it('is false for every other status', () => {
		expect(isAuthExpired(backendError('Unauthorized', { status: 401 }))).toBe(false)
		expect(isAuthExpired(backendError('Token required', { status: 499 }))).toBe(false)
		expect(isAuthExpired(undefined)).toBe(false)
	})
})

describe('isSessionGone', () => {
	it.each([
		['401 no session', HTTP.unauthorized],
		['412 account disabled or deleted', HTTP.preconditionFailed],
		['499 missing token', HTTP.tokenRequired]
	])('is true for %s', (_label, status) => {
		expect(isSessionGone(backendError('Session over', { status }))).toBe(true)
	})

	it('is false for 498, which is recoverable', () => {
		expect(isSessionGone(backendError('Invalid token', { status: 498 }))).toBe(false)
	})

	it('is false for an ordinary domain failure', () => {
		expect(isSessionGone(backendError('Invalid data', { status: 400 }))).toBe(false)
	})

	// A network failure must not log the operator out: the session is probably still fine and the wifi
	// is not.
	it('is false when no status could be read', () => {
		expect(isSessionGone(new CombinedError({ networkError: new Error('offline') }))).toBe(false)
		expect(isSessionGone(undefined)).toBe(false)
	})
})

describe('isRefreshRaceRetry', () => {
	// Pinned as a literal: this string is a contract with `throwRefreshRaceRetry` in marketplace-common,
	// which no compiler checks. A rename on either side turns every lost multi-tab race into a logout.
	it('is the exact code the backend raises', () => {
		expect(REFRESH_RACE_RETRY_CODE).toBe('REFRESH_RACE_RETRY')
	})

	it('is true for the code, whatever status rode with it', () => {
		expect(isRefreshRaceRetry(backendError('Refresh In Progress', { status: 409, code: REFRESH_RACE_RETRY_CODE }))).toBe(true)
		// A proxy that rewrote the status must not be able to turn a retry into a logout.
		expect(isRefreshRaceRetry(backendError('Refresh In Progress', { code: REFRESH_RACE_RETRY_CODE }))).toBe(true)
	})

	// 409 alone means nothing here — the code is the whole signal, and the backend sends it on this one
	// error only.
	it('is false for a 409 that carries no code', () => {
		expect(isRefreshRaceRetry(backendError('Conflict', { status: 409 }))).toBe(false)
	})

	it('is false for any other code', () => {
		expect(isRefreshRaceRetry(backendError('Bad user input', { status: 400, code: 'BAD_USER_INPUT' }))).toBe(false)
	})

	it('is false for a transport failure and for no error at all', () => {
		expect(isRefreshRaceRetry(new CombinedError({ networkError: new Error('offline') }))).toBe(false)
		expect(isRefreshRaceRetry(undefined)).toBe(false)
	})
})

describe('messageOf', () => {
	it('is empty without an error, so a component can render it unconditionally', () => {
		expect(messageOf(undefined)).toBe('')
	})

	it('prefers the backend description', () => {
		expect(messageOf(backendError('Wrong password', { description: 'Current password does not match' }))).toBe(
			'Current password does not match'
		)
	})

	it('falls back to the GraphQL error message', () => {
		expect(messageOf(backendError('Wrong password'))).toBe('Wrong password')
	})

	it('falls back to the generic line when the error carries an empty message', () => {
		expect(messageOf(backendError(''))).toBe('Error while communicating with the server')
	})

	it('falls back to the generic line for a transport failure', () => {
		expect(messageOf(new CombinedError({ networkError: new Error('offline') }))).toBe(
			'Error while communicating with the server'
		)
	})
})
