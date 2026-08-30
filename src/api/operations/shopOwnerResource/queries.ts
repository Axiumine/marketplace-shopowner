import { graphql } from '@gql/shopOwnerResource'

/**
 * The signed-in owner's live companies. The first of the three queries the ShopOwner resource service
 * exposes — the other two are the catalogue's, below.
 *
 * ⚠️ It takes no arguments, and the admin tier's query of the same name takes `idShopOwner`. The
 * owner comes from the Redis session server-side (`ctx.state.user._id`), which is what makes this app
 * incapable of naming another owner's data even if someone edits the request: there is no variable to
 * edit. Do not "fix" the missing argument by copying the admin document.
 *
 * Retired companies are filtered out by the resolver (`deleted: { $exists: false }`), so the list is
 * already the live set and this app never filters it again.
 *
 * Whole documents, not a projection: the companies page edits these cards in place, and there is no second
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

/**
 * One shop's catalogue, drafts included.
 *
 * ⚠️ **`idCompany` is the one variable this app ever sends, and it is not a tenant boundary.** Every
 * other operation on this tier is scoped by the Redis session alone; this one names a shop, because an
 * owner may hold several and a catalogue is a per-shop screen. The resolver runs
 * `throwIfShopOwnerDontOwnCompany` before it reads anything, so an id belonging to someone else answers
 * 403 rather than a list — but nothing *here* enforces that, and nothing here should try to.
 *
 * Retired items are filtered out by the resolver (`deleted: { $exists: false }`), so the list is already
 * the live set. `published` is not filtered and must not be: a draft is exactly what the owner opened
 * this page to finish.
 *
 * Whole documents rather than a projection, for the reason the companies query gives — the cards are
 * edited in place and there is no second query behind them.
 */
export const CompanyItemsDocument = graphql(`
	query CompanyItems($idCompany: ID!) {
		companyItems(idCompany: $idCompany) {
			_id
			idCompany
			idCategory
			name
			description
			slug
			published
		}
	}
`)

/**
 * The platform-wide category tree, flat.
 *
 * Read-only on this tier: only the Admin tier writes `itemCategory`, and that asymmetry is the point of
 * a shared taxonomy — a per-owner one would make the public category pages meaningless. This app renders
 * it as the options of one select and offers no way to add to it.
 *
 * `idParent` is what carries the shape: absent means a top-level category, present means a subcategory
 * of the one it names, and the depth cap of two lives on the Admin tier. The resolver sorts by
 * `position` then `_id`; the two levels arrive interleaved and `orderedCategories` in the items feature
 * is what puts each child under its own parent.
 */
export const ItemCategoriesDocument = graphql(`
	query ItemCategories {
		itemCategories {
			_id
			idParent
			name
			slug
			position
		}
	}
`)
