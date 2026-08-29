/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
/**
 * The company as the owner fills it in: `GraphQLCompany` minus the two fields the server owns — `_id`,
 * and `idShopOwner`, which comes from the session and is never an argument on this tier.
 */
export type GraphQlInputCompany = {
  address: GraphQlInputCompanyAddress;
  administrator: string;
  certifiedEmail: string;
  contactPerson: string;
  legalName: string;
  registryExtract: string;
  taxCode?: string | null | undefined;
  uniqueCode?: string | null | undefined;
  vatNumber: string;
};

export type GraphQlInputCompanyAddress = {
  city: string;
  position: GraphQlInputCompanyPosition;
  postalCode: string;
  province: string;
  street: string;
};

export type GraphQlInputCompanyPosition = {
  coordinates: Array<number>;
  type: string;
};

/**
 * The item as its owner fills it in: `GraphQLItem` minus `_id`, which the server mints, and `published`,
 * which is not part of the card.
 *
 * ⚠️ `idCompany` **is** here, where `GraphQLInputCompany` has no `idShopOwner`. An owner may hold several
 * companies, so which shop an item belongs to is a choice the client makes rather than something the
 * session determines — and it is checked against the session on every write, because an id the client
 * sends is an id the client can guess.
 *
 * ⚠️ **`published` is deliberately absent.** It was a `Boolean!` here until 2026-08-14, which made every
 * save of the card a write of the flag; `itemUpdatePublished` is the only writer now. Putting it back
 * would republish, on the next ordinary save, whatever an operator had just taken down.
 *
 * Every field is non-null, matching the collection's `required` list, and `itemUpdate` `$set`s the whole
 * object — so an optional field here would be a field that can never be cleared.
 */
export type GraphQlInputItem = {
  description: string;
  idCategory: string | number;
  idCompany: string | number;
  name: string;
  slug: string;
};

export type CompanyAddMutationVariables = Exact<{
  company: GraphQlInputCompany;
}>;


export type CompanyAddMutation = { companyAdd: { _id: string } };

export type CompanyUpdateMutationVariables = Exact<{
  _id: string | number;
  company: GraphQlInputCompany;
}>;


export type CompanyUpdateMutation = { companyUpdate: boolean };

export type CompanyDelMutationVariables = Exact<{
  _id: string | number;
}>;


export type CompanyDelMutation = { companyDel: boolean };

export type ItemAddMutationVariables = Exact<{
  item: GraphQlInputItem;
}>;


export type ItemAddMutation = { itemAdd: { _id: string } };

export type ItemUpdateMutationVariables = Exact<{
  _id: string | number;
  item: GraphQlInputItem;
}>;


export type ItemUpdateMutation = { itemUpdate: boolean };

export type ItemUpdatePublishedMutationVariables = Exact<{
  _id: string | number;
  published: boolean;
}>;


export type ItemUpdatePublishedMutation = { itemUpdatePublished: boolean };

export type ItemDelMutationVariables = Exact<{
  _id: string | number;
}>;


export type ItemDelMutation = { itemDel: boolean };

export type ItemsUpdatePublishedMutationVariables = Exact<{
  _ids: Array<string | number> | string | number;
  published: boolean;
}>;


export type ItemsUpdatePublishedMutation = { itemsUpdatePublished: boolean };

export type ShopOwnerDelMutationVariables = Exact<{ [key: string]: never; }>;


export type ShopOwnerDelMutation = { shopOwnerDel: boolean };

export type ShopOwnerCompaniesQueryVariables = Exact<{ [key: string]: never; }>;


export type ShopOwnerCompaniesQuery = { shopOwnerCompanies: Array<{ _id: string, legalName: string, vatNumber: string, taxCode: string | null, contactPerson: string, administrator: string, uniqueCode: string | null, certifiedEmail: string, registryExtract: string, address: { street: string, postalCode: string, city: string, province: string, position: { type: string, coordinates: Array<number> } } }> };

export type CompanyItemsQueryVariables = Exact<{
  idCompany: string | number;
}>;


export type CompanyItemsQuery = { companyItems: Array<{ _id: string, idCompany: string, idCategory: string, name: string, description: string, slug: string, published: boolean }> };

export type ItemCategoriesQueryVariables = Exact<{ [key: string]: never; }>;


export type ItemCategoriesQuery = { itemCategories: Array<{ _id: string, idParent: string | null, name: string, slug: string, position: number }> };


export const CompanyAddDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CompanyAdd"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"company"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"GraphQLInputCompany"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"companyAdd"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"company"},"value":{"kind":"Variable","name":{"kind":"Name","value":"company"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"_id"}}]}}]}}]} as unknown as DocumentNode<CompanyAddMutation, CompanyAddMutationVariables>;
export const CompanyUpdateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CompanyUpdate"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"company"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"GraphQLInputCompany"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"companyUpdate"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"_id"}}},{"kind":"Argument","name":{"kind":"Name","value":"company"},"value":{"kind":"Variable","name":{"kind":"Name","value":"company"}}}]}]}}]} as unknown as DocumentNode<CompanyUpdateMutation, CompanyUpdateMutationVariables>;
export const CompanyDelDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CompanyDel"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"companyDel"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"_id"}}}]}]}}]} as unknown as DocumentNode<CompanyDelMutation, CompanyDelMutationVariables>;
export const ItemAddDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ItemAdd"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"item"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"GraphQLInputItem"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"itemAdd"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"item"},"value":{"kind":"Variable","name":{"kind":"Name","value":"item"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"_id"}}]}}]}}]} as unknown as DocumentNode<ItemAddMutation, ItemAddMutationVariables>;
export const ItemUpdateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ItemUpdate"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"item"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"GraphQLInputItem"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"itemUpdate"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"_id"}}},{"kind":"Argument","name":{"kind":"Name","value":"item"},"value":{"kind":"Variable","name":{"kind":"Name","value":"item"}}}]}]}}]} as unknown as DocumentNode<ItemUpdateMutation, ItemUpdateMutationVariables>;
export const ItemUpdatePublishedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ItemUpdatePublished"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"published"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"itemUpdatePublished"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"_id"}}},{"kind":"Argument","name":{"kind":"Name","value":"published"},"value":{"kind":"Variable","name":{"kind":"Name","value":"published"}}}]}]}}]} as unknown as DocumentNode<ItemUpdatePublishedMutation, ItemUpdatePublishedMutationVariables>;
export const ItemDelDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ItemDel"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"itemDel"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"_id"}}}]}]}}]} as unknown as DocumentNode<ItemDelMutation, ItemDelMutationVariables>;
export const ItemsUpdatePublishedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ItemsUpdatePublished"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"_ids"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"published"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"itemsUpdatePublished"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"_ids"},"value":{"kind":"Variable","name":{"kind":"Name","value":"_ids"}}},{"kind":"Argument","name":{"kind":"Name","value":"published"},"value":{"kind":"Variable","name":{"kind":"Name","value":"published"}}}]}]}}]} as unknown as DocumentNode<ItemsUpdatePublishedMutation, ItemsUpdatePublishedMutationVariables>;
export const ShopOwnerDelDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ShopOwnerDel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shopOwnerDel"}}]}}]} as unknown as DocumentNode<ShopOwnerDelMutation, ShopOwnerDelMutationVariables>;
export const ShopOwnerCompaniesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ShopOwnerCompanies"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shopOwnerCompanies"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"_id"}},{"kind":"Field","name":{"kind":"Name","value":"legalName"}},{"kind":"Field","name":{"kind":"Name","value":"vatNumber"}},{"kind":"Field","name":{"kind":"Name","value":"taxCode"}},{"kind":"Field","name":{"kind":"Name","value":"contactPerson"}},{"kind":"Field","name":{"kind":"Name","value":"administrator"}},{"kind":"Field","name":{"kind":"Name","value":"uniqueCode"}},{"kind":"Field","name":{"kind":"Name","value":"certifiedEmail"}},{"kind":"Field","name":{"kind":"Name","value":"registryExtract"}},{"kind":"Field","name":{"kind":"Name","value":"address"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"street"}},{"kind":"Field","name":{"kind":"Name","value":"postalCode"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"province"}},{"kind":"Field","name":{"kind":"Name","value":"position"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"coordinates"}}]}}]}}]}}]}}]} as unknown as DocumentNode<ShopOwnerCompaniesQuery, ShopOwnerCompaniesQueryVariables>;
export const CompanyItemsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CompanyItems"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"idCompany"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"companyItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"idCompany"},"value":{"kind":"Variable","name":{"kind":"Name","value":"idCompany"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"_id"}},{"kind":"Field","name":{"kind":"Name","value":"idCompany"}},{"kind":"Field","name":{"kind":"Name","value":"idCategory"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"published"}}]}}]}}]} as unknown as DocumentNode<CompanyItemsQuery, CompanyItemsQueryVariables>;
export const ItemCategoriesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ItemCategories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"itemCategories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"_id"}},{"kind":"Field","name":{"kind":"Name","value":"idParent"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"position"}}]}}]}}]} as unknown as DocumentNode<ItemCategoriesQuery, ItemCategoriesQueryVariables>;