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
 * `CompanyDel` is a soft delete: it stamps `deleted` and the document stays. ⚠️ The VAT number stays
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

/**
 * The four writes on an item — the catalogue half of this service's mutation surface.
 *
 * ⚠️ **`idCompany` travels inside `GraphQLInputItem` on all three writes that carry the item**, which is
 * what makes `ItemUpdate` a transfer as well as a save: changing that one field moves the item to
 * another of the owner's shops. The service runs three guards for exactly that reason — where the item
 * is now, where it is going, and whether the category exists — so a save that only meant to fix a typo
 * still has to send the `idCompany` the item already had, never a blank.
 *
 * `ItemAdd` answers `OnlyIdType`, like `CompanyAdd` and unlike the operator tier's namesakes. A `slug`
 * already taken **inside the same company** comes back as a 409 through `tryCatchRethrow`; the same slug
 * in a different shop is legal, since the public route carries the shop segment ahead of the item's.
 *
 * `ItemDel` is a soft delete: the document stays, gains a `deleted` instant, and its slug stays occupied
 * inside that shop for good. A second delete of the same item answers **403**, not `false` — the
 * ownership guard filters `deleted` and refuses before the write is reached.
 *
 * ⚠️ **`ItemUpdate` does not carry `published`, and `ItemUpdatePublished` is the only thing that writes
 * it.** The flag left `GraphQLInputItem` on 2026-08-14: `funItemUpdate` `$set`s the whole object, so a
 * flag inside the input made every save of the card a write of the flag — and a card the owner had
 * open since before an operator took the item down republished it on the next save, without anybody
 * asking to. `ItemAdd` stamps `false`, so a new item is a draft until it is published on purpose.
 *
 * All four need `additionalTypenames: ['GraphQLItem']` at the call site, for the reason the company
 * writes need theirs: three answer a bare `Boolean` and the fourth an `OnlyIdType`, so nothing in any
 * response names the type whose cached list has just gone stale. `ItemUpdatePublished` needs it most of
 * all — it is what puts the new flag on screen, since nothing here holds a local copy of it.
 */
export const ItemAddDocument = graphql(`
	mutation ItemAdd($item: GraphQLInputItem!) {
		itemAdd(item: $item) {
			_id
		}
	}
`)

export const ItemUpdateDocument = graphql(`
	mutation ItemUpdate($_id: ID!, $item: GraphQLInputItem!) {
		itemUpdate(_id: $_id, item: $item)
	}
`)

export const ItemUpdatePublishedDocument = graphql(`
	mutation ItemUpdatePublished($_id: ID!, $published: Boolean!) {
		itemUpdatePublished(_id: $_id, published: $published)
	}
`)

export const ItemDelDocument = graphql(`
	mutation ItemDel($_id: ID!) {
		itemDel(_id: $_id)
	}
`)
