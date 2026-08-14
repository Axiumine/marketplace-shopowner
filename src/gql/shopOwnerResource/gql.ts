/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n\tmutation CompanyAdd($company: GraphQLInputCompany!) {\n\t\tcompanyAdd(company: $company) {\n\t\t\t_id\n\t\t}\n\t}\n": typeof types.CompanyAddDocument,
    "\n\tmutation CompanyUpdate($_id: ID!, $company: GraphQLInputCompany!) {\n\t\tcompanyUpdate(_id: $_id, company: $company)\n\t}\n": typeof types.CompanyUpdateDocument,
    "\n\tmutation CompanyDel($_id: ID!) {\n\t\tcompanyDel(_id: $_id)\n\t}\n": typeof types.CompanyDelDocument,
    "\n\tmutation ItemAdd($item: GraphQLInputItem!) {\n\t\titemAdd(item: $item) {\n\t\t\t_id\n\t\t}\n\t}\n": typeof types.ItemAddDocument,
    "\n\tmutation ItemUpdate($_id: ID!, $item: GraphQLInputItem!) {\n\t\titemUpdate(_id: $_id, item: $item)\n\t}\n": typeof types.ItemUpdateDocument,
    "\n\tmutation ItemUpdatePublished($_id: ID!, $published: Boolean!) {\n\t\titemUpdatePublished(_id: $_id, published: $published)\n\t}\n": typeof types.ItemUpdatePublishedDocument,
    "\n\tmutation ItemDel($_id: ID!) {\n\t\titemDel(_id: $_id)\n\t}\n": typeof types.ItemDelDocument,
    "\n\tquery ShopOwnerCompanies {\n\t\tshopOwnerCompanies {\n\t\t\t_id\n\t\t\tlegalName\n\t\t\tvatNumber\n\t\t\ttaxCode\n\t\t\tcontactPerson\n\t\t\tadministrator\n\t\t\tuniqueCode\n\t\t\tcertifiedEmail\n\t\t\tregistryExtract\n\t\t\taddress {\n\t\t\t\tstreet\n\t\t\t\tpostalCode\n\t\t\t\tcity\n\t\t\t\tprovince\n\t\t\t\tposition {\n\t\t\t\t\ttype\n\t\t\t\t\tcoordinates\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t}\n": typeof types.ShopOwnerCompaniesDocument,
    "\n\tquery CompanyItems($idCompany: ID!) {\n\t\tcompanyItems(idCompany: $idCompany) {\n\t\t\t_id\n\t\t\tidCompany\n\t\t\tidCategory\n\t\t\tname\n\t\t\tdescription\n\t\t\tslug\n\t\t\tpublished\n\t\t}\n\t}\n": typeof types.CompanyItemsDocument,
    "\n\tquery ItemCategories {\n\t\titemCategories {\n\t\t\t_id\n\t\t\tidParent\n\t\t\tname\n\t\t\tslug\n\t\t\tposition\n\t\t}\n\t}\n": typeof types.ItemCategoriesDocument,
};
const documents: Documents = {
    "\n\tmutation CompanyAdd($company: GraphQLInputCompany!) {\n\t\tcompanyAdd(company: $company) {\n\t\t\t_id\n\t\t}\n\t}\n": types.CompanyAddDocument,
    "\n\tmutation CompanyUpdate($_id: ID!, $company: GraphQLInputCompany!) {\n\t\tcompanyUpdate(_id: $_id, company: $company)\n\t}\n": types.CompanyUpdateDocument,
    "\n\tmutation CompanyDel($_id: ID!) {\n\t\tcompanyDel(_id: $_id)\n\t}\n": types.CompanyDelDocument,
    "\n\tmutation ItemAdd($item: GraphQLInputItem!) {\n\t\titemAdd(item: $item) {\n\t\t\t_id\n\t\t}\n\t}\n": types.ItemAddDocument,
    "\n\tmutation ItemUpdate($_id: ID!, $item: GraphQLInputItem!) {\n\t\titemUpdate(_id: $_id, item: $item)\n\t}\n": types.ItemUpdateDocument,
    "\n\tmutation ItemUpdatePublished($_id: ID!, $published: Boolean!) {\n\t\titemUpdatePublished(_id: $_id, published: $published)\n\t}\n": types.ItemUpdatePublishedDocument,
    "\n\tmutation ItemDel($_id: ID!) {\n\t\titemDel(_id: $_id)\n\t}\n": types.ItemDelDocument,
    "\n\tquery ShopOwnerCompanies {\n\t\tshopOwnerCompanies {\n\t\t\t_id\n\t\t\tlegalName\n\t\t\tvatNumber\n\t\t\ttaxCode\n\t\t\tcontactPerson\n\t\t\tadministrator\n\t\t\tuniqueCode\n\t\t\tcertifiedEmail\n\t\t\tregistryExtract\n\t\t\taddress {\n\t\t\t\tstreet\n\t\t\t\tpostalCode\n\t\t\t\tcity\n\t\t\t\tprovince\n\t\t\t\tposition {\n\t\t\t\t\ttype\n\t\t\t\t\tcoordinates\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t}\n": types.ShopOwnerCompaniesDocument,
    "\n\tquery CompanyItems($idCompany: ID!) {\n\t\tcompanyItems(idCompany: $idCompany) {\n\t\t\t_id\n\t\t\tidCompany\n\t\t\tidCategory\n\t\t\tname\n\t\t\tdescription\n\t\t\tslug\n\t\t\tpublished\n\t\t}\n\t}\n": types.CompanyItemsDocument,
    "\n\tquery ItemCategories {\n\t\titemCategories {\n\t\t\t_id\n\t\t\tidParent\n\t\t\tname\n\t\t\tslug\n\t\t\tposition\n\t\t}\n\t}\n": types.ItemCategoriesDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\tmutation CompanyAdd($company: GraphQLInputCompany!) {\n\t\tcompanyAdd(company: $company) {\n\t\t\t_id\n\t\t}\n\t}\n"): (typeof documents)["\n\tmutation CompanyAdd($company: GraphQLInputCompany!) {\n\t\tcompanyAdd(company: $company) {\n\t\t\t_id\n\t\t}\n\t}\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\tmutation CompanyUpdate($_id: ID!, $company: GraphQLInputCompany!) {\n\t\tcompanyUpdate(_id: $_id, company: $company)\n\t}\n"): (typeof documents)["\n\tmutation CompanyUpdate($_id: ID!, $company: GraphQLInputCompany!) {\n\t\tcompanyUpdate(_id: $_id, company: $company)\n\t}\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\tmutation CompanyDel($_id: ID!) {\n\t\tcompanyDel(_id: $_id)\n\t}\n"): (typeof documents)["\n\tmutation CompanyDel($_id: ID!) {\n\t\tcompanyDel(_id: $_id)\n\t}\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\tmutation ItemAdd($item: GraphQLInputItem!) {\n\t\titemAdd(item: $item) {\n\t\t\t_id\n\t\t}\n\t}\n"): (typeof documents)["\n\tmutation ItemAdd($item: GraphQLInputItem!) {\n\t\titemAdd(item: $item) {\n\t\t\t_id\n\t\t}\n\t}\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\tmutation ItemUpdate($_id: ID!, $item: GraphQLInputItem!) {\n\t\titemUpdate(_id: $_id, item: $item)\n\t}\n"): (typeof documents)["\n\tmutation ItemUpdate($_id: ID!, $item: GraphQLInputItem!) {\n\t\titemUpdate(_id: $_id, item: $item)\n\t}\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\tmutation ItemUpdatePublished($_id: ID!, $published: Boolean!) {\n\t\titemUpdatePublished(_id: $_id, published: $published)\n\t}\n"): (typeof documents)["\n\tmutation ItemUpdatePublished($_id: ID!, $published: Boolean!) {\n\t\titemUpdatePublished(_id: $_id, published: $published)\n\t}\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\tmutation ItemDel($_id: ID!) {\n\t\titemDel(_id: $_id)\n\t}\n"): (typeof documents)["\n\tmutation ItemDel($_id: ID!) {\n\t\titemDel(_id: $_id)\n\t}\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\tquery ShopOwnerCompanies {\n\t\tshopOwnerCompanies {\n\t\t\t_id\n\t\t\tlegalName\n\t\t\tvatNumber\n\t\t\ttaxCode\n\t\t\tcontactPerson\n\t\t\tadministrator\n\t\t\tuniqueCode\n\t\t\tcertifiedEmail\n\t\t\tregistryExtract\n\t\t\taddress {\n\t\t\t\tstreet\n\t\t\t\tpostalCode\n\t\t\t\tcity\n\t\t\t\tprovince\n\t\t\t\tposition {\n\t\t\t\t\ttype\n\t\t\t\t\tcoordinates\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t}\n"): (typeof documents)["\n\tquery ShopOwnerCompanies {\n\t\tshopOwnerCompanies {\n\t\t\t_id\n\t\t\tlegalName\n\t\t\tvatNumber\n\t\t\ttaxCode\n\t\t\tcontactPerson\n\t\t\tadministrator\n\t\t\tuniqueCode\n\t\t\tcertifiedEmail\n\t\t\tregistryExtract\n\t\t\taddress {\n\t\t\t\tstreet\n\t\t\t\tpostalCode\n\t\t\t\tcity\n\t\t\t\tprovince\n\t\t\t\tposition {\n\t\t\t\t\ttype\n\t\t\t\t\tcoordinates\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t}\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\tquery CompanyItems($idCompany: ID!) {\n\t\tcompanyItems(idCompany: $idCompany) {\n\t\t\t_id\n\t\t\tidCompany\n\t\t\tidCategory\n\t\t\tname\n\t\t\tdescription\n\t\t\tslug\n\t\t\tpublished\n\t\t}\n\t}\n"): (typeof documents)["\n\tquery CompanyItems($idCompany: ID!) {\n\t\tcompanyItems(idCompany: $idCompany) {\n\t\t\t_id\n\t\t\tidCompany\n\t\t\tidCategory\n\t\t\tname\n\t\t\tdescription\n\t\t\tslug\n\t\t\tpublished\n\t\t}\n\t}\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\tquery ItemCategories {\n\t\titemCategories {\n\t\t\t_id\n\t\t\tidParent\n\t\t\tname\n\t\t\tslug\n\t\t\tposition\n\t\t}\n\t}\n"): (typeof documents)["\n\tquery ItemCategories {\n\t\titemCategories {\n\t\t\t_id\n\t\t\tidParent\n\t\t\tname\n\t\t\tslug\n\t\t\tposition\n\t\t}\n\t}\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;