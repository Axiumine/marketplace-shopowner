import type { OperationContext } from '@urql/core'

import { env } from '@/env'

/**
 * The four GraphQL endpoints, and the urql contexts that route a document to one of them.
 *
 * urql has a single `Client` with a single default `url`; anything else is selected per operation
 * through `context.url`. The default is the shopOwner-resource endpoint, because every domain query and
 * mutation in this app goes there — the other three carry exactly one operation each.
 *
 * The context objects are module-level constants on purpose. urql re-executes an operation when its
 * context changes, and it compares by key: a `{ url }` literal built inside a component body is a new
 * object on every render, which turns a static query into an infinite refetch loop.
 *
 * ⚠️ Three of the four are the ShopOwner tier's services and not the admin app's — see the warning
 * in src/env.ts. `/logout` is the one both apps share, legitimately: `authorizationLogoutHandler`
 * resolves the bearer token straight out of Redis and never opens a collection, so it is tier-agnostic
 * by construction.
 */
export const ENDPOINT = {
	publicAuthorization: env.publicAuthorization,
	shopOwnerAuthorization: env.shopOwnerAuthorization,
	shopOwnerResource: env.shopOwnerResource,
	logout: env.logout
} as const

export const CTX_PUBLIC_AUTHORIZATION: Partial<OperationContext> = Object.freeze({ url: ENDPOINT.publicAuthorization })
export const CTX_SHOP_OWNER_AUTHORIZATION: Partial<OperationContext> = Object.freeze({ url: ENDPOINT.shopOwnerAuthorization })
export const CTX_SHOP_OWNER_RESOURCE: Partial<OperationContext> = Object.freeze({ url: ENDPOINT.shopOwnerResource })
export const CTX_LOGOUT: Partial<OperationContext> = Object.freeze({ url: ENDPOINT.logout })

/**
 * Whether an operation needs an access token before it is worth sending.
 *
 * Only the public-authorization endpoint is reachable without one — it is where `login` lives, and
 * requiring a token to log in would be a deadlock. Everything else, including `logout`, is
 * bearer-authenticated.
 */
export const requiresAuth = (url: string | undefined): boolean => url !== ENDPOINT.publicAuthorization
