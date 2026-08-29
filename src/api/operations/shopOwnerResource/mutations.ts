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

/**
 * The bulk half of `ItemUpdatePublished`, for the select-all control on the items page.
 *
 * ⚠️ **Bounded at 500 ids a call, and the bound is the server's**: a longer list is a 400, not a
 * truncated write. `chunk` in `Items.tsx` is what keeps a bigger selection legal, and it makes the
 * gesture several writes rather than one — a run that fails leaves the runs before it applied, which is
 * why the button reports how far it got rather than a bare failure.
 *
 * ⚠️ **Ownership is all-or-nothing**: one id the session does not own answers 403 and writes none of
 * the list. That is a guarantee worth having rather than a limitation — a partial application could not
 * be reported honestly, and refusing to say which id was foreign is what keeps this from answering
 * "does this item exist" for ids the owner guessed.
 *
 * `additionalTypenames: ['GraphQLItem']` like the other four: the answer is a bare `Boolean` and every
 * card on the page is now showing a stale flag.
 */
export const ItemsUpdatePublishedDocument = graphql(`
	mutation ItemsUpdatePublished($_ids: [ID!]!, $published: Boolean!) {
		itemsUpdatePublished(_ids: $_ids, published: $published)
	}
`)

/**
 * The owner closing their own account — the one write here that ends the session that made it.
 *
 * ⚠️ **No variables, and the absence is the security property.** Every owner authenticates against the
 * same collection and the platform has no role field, so an `_id` accepted from the browser would turn
 * this into "close any owner's account". The resolver reads the account from the Redis session and
 * declares no argument at all; do not add one here "for symmetry" with the Admin tier's namesake, which
 * takes an id precisely because an operator is closing somebody else's.
 *
 * What follows the `true` is not a refetch: every session of the account ends server-side, the caller's
 * included, so the next request on this token is refused. The call site signs out rather than
 * invalidating a cache — there is nothing left to read.
 */
export const ShopOwnerDelDocument = graphql(`
	mutation ShopOwnerDel {
		shopOwnerDel
	}
`)
