import { describe, expect, it } from 'vitest'

import { DEFAULT_ENDPOINTS, env, readEnv } from '@/env'

const source = (overrides: Partial<Record<string, string>> = {}): ImportMetaEnv => ({ ...overrides }) as unknown as ImportMetaEnv

describe('readEnv', () => {
	it('falls back to the same-origin paths when nothing is configured', () => {
		expect(readEnv(source())).toEqual({
			publicAuthorization: '/public-authorization',
			shopOwnerAuthorization: '/authenticated-authorization',
			shopOwnerResource: '/authenticated-resource',
			logout: '/logout',
			sentryDsn: '',
			sentryEnvironment: 'development'
		})
	})

	it('keeps the defaults in step with the exported constant', () => {
		expect(DEFAULT_ENDPOINTS).toEqual({
			publicAuthorization: '/public-authorization',
			shopOwnerAuthorization: '/authenticated-authorization',
			shopOwnerResource: '/authenticated-resource',
			logout: '/logout'
		})
	})

	it('reads every variable when all are set', () => {
		expect(
			readEnv(
				source({
					VITE_GRAPHQL_ENDPOINT_PUBLIC_AUTHORIZATION: '/p-auth',
					VITE_GRAPHQL_ENDPOINT_AUTHENTICATED_AUTHORIZATION: '/a-auth',
					VITE_GRAPHQL_ENDPOINT_AUTHENTICATED_RESOURCE: '/a-res',
					VITE_GRAPHQL_ENDPOINT_LOGOUT: '/bye',
					VITE_SENTRY_DSN: 'https://key@sentry.example/1',
					VITE_SENTRY_ENVIRONMENT: 'production'
				})
			)
		).toEqual({
			publicAuthorization: '/p-auth',
			shopOwnerAuthorization: '/a-auth',
			shopOwnerResource: '/a-res',
			logout: '/bye',
			sentryDsn: 'https://key@sentry.example/1',
			sentryEnvironment: 'production'
		})
	})

	// dotenv writes `KEY=` for "unset" and Vite hands that through as an empty string. Treating it as a
	// present value would point the client at the empty URL, which fetch resolves to the current page.
	it('treats an empty string as absent', () => {
		expect(
			readEnv(
				source({
					VITE_GRAPHQL_ENDPOINT_PUBLIC_AUTHORIZATION: '',
					VITE_GRAPHQL_ENDPOINT_AUTHENTICATED_AUTHORIZATION: '',
					VITE_GRAPHQL_ENDPOINT_AUTHENTICATED_RESOURCE: '',
					VITE_GRAPHQL_ENDPOINT_LOGOUT: '',
					VITE_SENTRY_DSN: '',
					VITE_SENTRY_ENVIRONMENT: ''
				})
			)
		).toEqual({
			publicAuthorization: '/public-authorization',
			shopOwnerAuthorization: '/authenticated-authorization',
			shopOwnerResource: '/authenticated-resource',
			logout: '/logout',
			sentryDsn: '',
			sentryEnvironment: 'development'
		})
	})
})

describe('env', () => {
	it('is read from the real import.meta.env at module load', () => {
		expect(env).toEqual(readEnv(import.meta.env))
	})
})
