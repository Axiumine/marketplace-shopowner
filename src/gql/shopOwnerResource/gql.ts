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
    "\n  mutation CompanyAdd($company: GraphQLInputCompany!) {\n    companyAdd(company: $company) {\n      _id\n    }\n  }\n": typeof types.CompanyAddDocument,
    "\n  mutation CompanyUpdate($_id: ID!, $company: GraphQLInputCompany!) {\n    companyUpdate(_id: $_id, company: $company)\n  }\n": typeof types.CompanyUpdateDocument,
    "\n  mutation CompanyDel($_id: ID!) {\n    companyDel(_id: $_id)\n  }\n": typeof types.CompanyDelDocument,
    "\n  mutation ItemAdd($item: GraphQLInputItem!) {\n    itemAdd(item: $item) {\n      _id\n    }\n  }\n": typeof types.ItemAddDocument,
    "\n  mutation ItemUpdate($_id: ID!, $item: GraphQLInputItem!) {\n    itemUpdate(_id: $_id, item: $item)\n  }\n": typeof types.ItemUpdateDocument,
    "\n  mutation ItemUpdatePublished($_id: ID!, $published: Boolean!) {\n    itemUpdatePublished(_id: $_id, published: $published)\n  }\n": typeof types.ItemUpdatePublishedDocument,
    "\n  mutation ItemDel($_id: ID!) {\n    itemDel(_id: $_id)\n  }\n": typeof types.ItemDelDocument,
    "\n  mutation ItemsUpdatePublished($_ids: [ID!]!, $published: Boolean!) {\n    itemsUpdatePublished(_ids: $_ids, published: $published)\n  }\n": typeof types.ItemsUpdatePublishedDocument,
    "\n  mutation ShopOwnerDel {\n    shopOwnerDel\n  }\n": typeof types.ShopOwnerDelDocument,
    "\n  query ShopOwnerCompanies {\n    shopOwnerCompanies {\n      _id\n      legalName\n      vatNumber\n      taxCode\n      contactPerson\n      administrator\n      uniqueCode\n      certifiedEmail\n      registryExtract\n      address {\n        street\n        postalCode\n        city\n        province\n        position {\n          type\n          coordinates\n        }\n      }\n    }\n  }\n": typeof types.ShopOwnerCompaniesDocument,
    "\n  query CompanyItems($idCompany: ID!) {\n    companyItems(idCompany: $idCompany) {\n      _id\n      idCompany\n      idCategory\n      name\n      description\n      slug\n      published\n    }\n  }\n": typeof types.CompanyItemsDocument,
    "\n  query ItemCategories {\n    itemCategories {\n      _id\n      idParent\n      name\n      slug\n      position\n    }\n  }\n": typeof types.ItemCategoriesDocument,
};
const documents: Documents = {
    "\n  mutation CompanyAdd($company: GraphQLInputCompany!) {\n    companyAdd(company: $company) {\n      _id\n    }\n  }\n": types.CompanyAddDocument,
    "\n  mutation CompanyUpdate($_id: ID!, $company: GraphQLInputCompany!) {\n    companyUpdate(_id: $_id, company: $company)\n  }\n": types.CompanyUpdateDocument,
    "\n  mutation CompanyDel($_id: ID!) {\n    companyDel(_id: $_id)\n  }\n": types.CompanyDelDocument,
    "\n  mutation ItemAdd($item: GraphQLInputItem!) {\n    itemAdd(item: $item) {\n      _id\n    }\n  }\n": types.ItemAddDocument,
    "\n  mutation ItemUpdate($_id: ID!, $item: GraphQLInputItem!) {\n    itemUpdate(_id: $_id, item: $item)\n  }\n": types.ItemUpdateDocument,
    "\n  mutation ItemUpdatePublished($_id: ID!, $published: Boolean!) {\n    itemUpdatePublished(_id: $_id, published: $published)\n  }\n": types.ItemUpdatePublishedDocument,
    "\n  mutation ItemDel($_id: ID!) {\n    itemDel(_id: $_id)\n  }\n": types.ItemDelDocument,
    "\n  mutation ItemsUpdatePublished($_ids: [ID!]!, $published: Boolean!) {\n    itemsUpdatePublished(_ids: $_ids, published: $published)\n  }\n": types.ItemsUpdatePublishedDocument,
    "\n  mutation ShopOwnerDel {\n    shopOwnerDel\n  }\n": types.ShopOwnerDelDocument,
    "\n  query ShopOwnerCompanies {\n    shopOwnerCompanies {\n      _id\n      legalName\n      vatNumber\n      taxCode\n      contactPerson\n      administrator\n      uniqueCode\n      certifiedEmail\n      registryExtract\n      address {\n        street\n        postalCode\n        city\n        province\n        position {\n          type\n          coordinates\n        }\n      }\n    }\n  }\n": types.ShopOwnerCompaniesDocument,
    "\n  query CompanyItems($idCompany: ID!) {\n    companyItems(idCompany: $idCompany) {\n      _id\n      idCompany\n      idCategory\n      name\n      description\n      slug\n      published\n    }\n  }\n": types.CompanyItemsDocument,
    "\n  query ItemCategories {\n    itemCategories {\n      _id\n      idParent\n      name\n      slug\n      position\n    }\n  }\n": types.ItemCategoriesDocument,
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
export function graphql(source: "\n  mutation CompanyAdd($company: GraphQLInputCompany!) {\n    companyAdd(company: $company) {\n      _id\n    }\n  }\n"): (typeof documents)["\n  mutation CompanyAdd($company: GraphQLInputCompany!) {\n    companyAdd(company: $company) {\n      _id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CompanyUpdate($_id: ID!, $company: GraphQLInputCompany!) {\n    companyUpdate(_id: $_id, company: $company)\n  }\n"): (typeof documents)["\n  mutation CompanyUpdate($_id: ID!, $company: GraphQLInputCompany!) {\n    companyUpdate(_id: $_id, company: $company)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CompanyDel($_id: ID!) {\n    companyDel(_id: $_id)\n  }\n"): (typeof documents)["\n  mutation CompanyDel($_id: ID!) {\n    companyDel(_id: $_id)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ItemAdd($item: GraphQLInputItem!) {\n    itemAdd(item: $item) {\n      _id\n    }\n  }\n"): (typeof documents)["\n  mutation ItemAdd($item: GraphQLInputItem!) {\n    itemAdd(item: $item) {\n      _id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ItemUpdate($_id: ID!, $item: GraphQLInputItem!) {\n    itemUpdate(_id: $_id, item: $item)\n  }\n"): (typeof documents)["\n  mutation ItemUpdate($_id: ID!, $item: GraphQLInputItem!) {\n    itemUpdate(_id: $_id, item: $item)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ItemUpdatePublished($_id: ID!, $published: Boolean!) {\n    itemUpdatePublished(_id: $_id, published: $published)\n  }\n"): (typeof documents)["\n  mutation ItemUpdatePublished($_id: ID!, $published: Boolean!) {\n    itemUpdatePublished(_id: $_id, published: $published)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ItemDel($_id: ID!) {\n    itemDel(_id: $_id)\n  }\n"): (typeof documents)["\n  mutation ItemDel($_id: ID!) {\n    itemDel(_id: $_id)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ItemsUpdatePublished($_ids: [ID!]!, $published: Boolean!) {\n    itemsUpdatePublished(_ids: $_ids, published: $published)\n  }\n"): (typeof documents)["\n  mutation ItemsUpdatePublished($_ids: [ID!]!, $published: Boolean!) {\n    itemsUpdatePublished(_ids: $_ids, published: $published)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ShopOwnerDel {\n    shopOwnerDel\n  }\n"): (typeof documents)["\n  mutation ShopOwnerDel {\n    shopOwnerDel\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ShopOwnerCompanies {\n    shopOwnerCompanies {\n      _id\n      legalName\n      vatNumber\n      taxCode\n      contactPerson\n      administrator\n      uniqueCode\n      certifiedEmail\n      registryExtract\n      address {\n        street\n        postalCode\n        city\n        province\n        position {\n          type\n          coordinates\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query ShopOwnerCompanies {\n    shopOwnerCompanies {\n      _id\n      legalName\n      vatNumber\n      taxCode\n      contactPerson\n      administrator\n      uniqueCode\n      certifiedEmail\n      registryExtract\n      address {\n        street\n        postalCode\n        city\n        province\n        position {\n          type\n          coordinates\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query CompanyItems($idCompany: ID!) {\n    companyItems(idCompany: $idCompany) {\n      _id\n      idCompany\n      idCategory\n      name\n      description\n      slug\n      published\n    }\n  }\n"): (typeof documents)["\n  query CompanyItems($idCompany: ID!) {\n    companyItems(idCompany: $idCompany) {\n      _id\n      idCompany\n      idCategory\n      name\n      description\n      slug\n      published\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ItemCategories {\n    itemCategories {\n      _id\n      idParent\n      name\n      slug\n      position\n    }\n  }\n"): (typeof documents)["\n  query ItemCategories {\n    itemCategories {\n      _id\n      idParent\n      name\n      slug\n      position\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;