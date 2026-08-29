import { graphql } from '@gql/shopOwnerAuthorization'

/**
 * Trades the refresh-token cookie for a new access token, rotating the cookie server-side.
 *
 * ⚠️ `RefreshType` has exactly two fields, and `refreshToken` is not one of them. The refresh token is
 * set as a signed httpOnly cookie and is never a payload value, so selecting it here would come back
 * as a validation error rather than as the token. Do not add it.
 *
 * Sent by the auth exchange, not by a component: on a page reload the in-memory access token is gone,
 * `willAuthError` fires before the first authenticated operation, and this is what runs.
 *
 * It goes to `/authenticated-authorization` (port 4029), the ShopOwner tier's token service. The
 * admin app's `/admin-authenticated-authorization` (4025) is a different service reading a
 * different Redis namespace; the two mutations are identical in shape and would each happily refuse
 * the other's cookie.
 */
export const RefreshDocument = graphql(`
	mutation Refresh {
		refresh {
			status
			accessToken
		}
	}
`)
