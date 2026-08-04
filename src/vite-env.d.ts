/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_GRAPHQL_ENDPOINT_PUBLIC_AUTHORIZATION?: string
	readonly VITE_GRAPHQL_ENDPOINT_AUTHENTICATED_AUTHORIZATION?: string
	readonly VITE_GRAPHQL_ENDPOINT_AUTHENTICATED_RESOURCE?: string
	readonly VITE_GRAPHQL_ENDPOINT_LOGOUT?: string
	readonly VITE_SENTRY_DSN?: string
	readonly VITE_SENTRY_ENVIRONMENT?: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}
