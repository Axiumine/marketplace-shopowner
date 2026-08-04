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

export type ShopOwnerCompaniesQueryVariables = Exact<{ [key: string]: never; }>;


export type ShopOwnerCompaniesQuery = { shopOwnerCompanies: Array<{ _id: string, legalName: string, vatNumber: string, taxCode: string | null, contactPerson: string, administrator: string, uniqueCode: string | null, certifiedEmail: string, registryExtract: string, address: { street: string, postalCode: string, city: string, province: string, position: { type: string, coordinates: Array<number> } } }> };


export const CompanyAddDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CompanyAdd"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"company"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"GraphQLInputCompany"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"companyAdd"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"company"},"value":{"kind":"Variable","name":{"kind":"Name","value":"company"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"_id"}}]}}]}}]} as unknown as DocumentNode<CompanyAddMutation, CompanyAddMutationVariables>;
export const CompanyUpdateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CompanyUpdate"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"company"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"GraphQLInputCompany"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"companyUpdate"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"_id"}}},{"kind":"Argument","name":{"kind":"Name","value":"company"},"value":{"kind":"Variable","name":{"kind":"Name","value":"company"}}}]}]}}]} as unknown as DocumentNode<CompanyUpdateMutation, CompanyUpdateMutationVariables>;
export const CompanyDelDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CompanyDel"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"companyDel"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"_id"}}}]}]}}]} as unknown as DocumentNode<CompanyDelMutation, CompanyDelMutationVariables>;
export const ShopOwnerCompaniesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ShopOwnerCompanies"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shopOwnerCompanies"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"_id"}},{"kind":"Field","name":{"kind":"Name","value":"legalName"}},{"kind":"Field","name":{"kind":"Name","value":"vatNumber"}},{"kind":"Field","name":{"kind":"Name","value":"taxCode"}},{"kind":"Field","name":{"kind":"Name","value":"contactPerson"}},{"kind":"Field","name":{"kind":"Name","value":"administrator"}},{"kind":"Field","name":{"kind":"Name","value":"uniqueCode"}},{"kind":"Field","name":{"kind":"Name","value":"certifiedEmail"}},{"kind":"Field","name":{"kind":"Name","value":"registryExtract"}},{"kind":"Field","name":{"kind":"Name","value":"address"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"street"}},{"kind":"Field","name":{"kind":"Name","value":"postalCode"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"province"}},{"kind":"Field","name":{"kind":"Name","value":"position"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"coordinates"}}]}}]}}]}}]}}]} as unknown as DocumentNode<ShopOwnerCompaniesQuery, ShopOwnerCompaniesQueryVariables>;