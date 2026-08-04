import { graphql } from '@gql/shopOwnerResource'

/**
 * The signed-in owner's live companies. The **only** query the ShopOwner resource service exposes.
 *
 * ⚠️ It takes no arguments, and the operator tier's query of the same name takes `idShopOwner`. The
 * owner comes from the Redis session server-side (`ctx.state.user._id`), which is what makes this app
 * incapable of naming another owner's data even if someone edits the request: there is no variable to
 * edit. Do not "fix" the missing argument by copying the admin document.
 *
 * Retired companies are filtered out by the resolver (`deleted: { $exists: false }`), so the list is
 * already the live set and this app never filters it again.
 *
 * Whole rows, not a projection: the companies page edits these cards in place, and there is no second
 * query behind them. It is also the app's session probe — see LoadingPage.
 */
export const ShopOwnerCompaniesDocument = graphql(`
	query ShopOwnerCompanies {
		shopOwnerCompanies {
			_id
			legalName
			vatNumber
			taxCode
			contactPerson
			administrator
			uniqueCode
			certifiedEmail
			registryExtract
			address {
				street
				postalCode
				city
				province
				position {
					type
					coordinates
				}
			}
		}
	}
`)
