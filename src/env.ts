/**
 * Build-time configuration, read once from `import.meta.env`.
 *
 * Every value has a default and nothing here throws. That is deliberate: the four endpoint paths are
 * fixed by the `ENDPOINT` constant each backend service exports from its `src/index.mts`, so they are
 * not really configuration — the env vars exist only so the app can be relocated behind a different
 * nginx prefix without a code change. A missing variable is therefore the normal case, not an error.
 *
 * The Sentry DSN is the one genuinely optional value: empty means "do not report", which is what a
 * developer machine wants.
 *
 * ⚠️ The three authenticated paths here are the ShopOwner tier's — the ones **without** `admin` in the
 * name. They are different services from the operator app's, on different ports, backed by a different
 * Redis session namespace and a different collection. Pointing this app at an `admin-…` path would not
 * merely fail somewhere obvious: `authenticated-resource` and `admin-authenticated-resource` expose
 * three operations of the same name (`companyAdd`, `companyDel`, `companyUpdate`) with different
 * arguments, so the mistake surfaces as a GraphQL validation error rather than as a 404.
 */
export interface AppEnv {
	readonly publicAuthorization: string
	readonly shopOwnerAuthorization: string
	readonly shopOwnerResource: string
	readonly logout: string
	readonly sentryDsn: string
	readonly sentryEnvironment: string
}

/**
 * Defaults, kept together so the `env` template and this file can be diffed by eye.
 *
 * These are paths, not URLs: the SPA and the services are served from one origin (see the comment in
 * vite.config.ts for why the refresh cookie makes that mandatory rather than merely convenient).
 */
export const DEFAULT_ENDPOINTS = {
	publicAuthorization: '/public-authorization',
	shopOwnerAuthorization: '/authenticated-authorization',
	shopOwnerResource: '/authenticated-resource',
	logout: '/logout'
} as const

/** An empty string is treated as absent — dotenv writes `KEY=` for "unset", and so does the template. */
const value = (raw: string | undefined, fallback: string): string => (raw === undefined || raw === '' ? fallback : raw)

export const readEnv = (source: ImportMetaEnv): AppEnv => ({
	publicAuthorization: value(source.VITE_GRAPHQL_ENDPOINT_PUBLIC_AUTHORIZATION, DEFAULT_ENDPOINTS.publicAuthorization),
	shopOwnerAuthorization: value(
		source.VITE_GRAPHQL_ENDPOINT_AUTHENTICATED_AUTHORIZATION,
		DEFAULT_ENDPOINTS.shopOwnerAuthorization
	),
	shopOwnerResource: value(source.VITE_GRAPHQL_ENDPOINT_AUTHENTICATED_RESOURCE, DEFAULT_ENDPOINTS.shopOwnerResource),
	logout: value(source.VITE_GRAPHQL_ENDPOINT_LOGOUT, DEFAULT_ENDPOINTS.logout),
	sentryDsn: value(source.VITE_SENTRY_DSN, ''),
	sentryEnvironment: value(source.VITE_SENTRY_ENVIRONMENT, 'development')
})

export const env: AppEnv = readEnv(import.meta.env)
