import { graphql } from '@gql/shopOwnerResource'

/**
 * The three writes on a company — the whole mutation surface of the ShopOwner resource service.
 *
 * ⚠️ All three differ from the operator tier's mutations of the same name, so a document copied across
 * from marketplace-admin compiles against the wrong schema and is refused at the server:
 *
 *   - `companyAdd` takes **no** `idShopOwner`. The owner is the session's, and `GraphQLInputCompany`
 *     has no such field either, so a company cannot be created into somebody else's hands.
 *   - `companyAdd` answers `OnlyIdType` (`{ _id }`), not `Boolean`. The owner's flow is "create the
 *     company, then work under it", and the second step needs the id the first one produced.
 *   - `companyUpdate` and `companyDel` run `throwIfShopOwnerDontOwnCompany` first, which filters
 *     `deleted` — so a second delete of the same company answers 403 rather than repeating the stamp.
 *
 * `CompanyDel` is a soft delete: it stamps `deleted` and the row stays. ⚠️ The partita IVA stays
 * occupied afterwards — `vatNumber_unique` is a plain global unique with no partial filter — so a
 * retired company can never be registered again.
 *
 * `companyUpdate` and `companyDel` answer a bare `Boolean`, and `companyAdd`'s `OnlyIdType` names a
 * typename that appears in no cached list. Every call site therefore has to name `additionalTypenames`
 * itself, or the document cache invalidates nothing and the page keeps rendering what it had.
 */
export const CompanyAddDocument = graphql(`
	mutation CompanyAdd($company: GraphQLInputCompany!) {
		companyAdd(company: $company) {
			_id
		}
	}
`)

export const CompanyUpdateDocument = graphql(`
	mutation CompanyUpdate($_id: ID!, $company: GraphQLInputCompany!) {
		companyUpdate(_id: $_id, company: $company)
	}
`)

export const CompanyDelDocument = graphql(`
	mutation CompanyDel($_id: ID!) {
		companyDel(_id: $_id)
	}
`)
