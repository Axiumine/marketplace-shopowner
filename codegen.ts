import type { CodegenConfig } from '@graphql-codegen/cli'

/**
 * One project per access level, not one merged schema.
 *
 * The four endpoints are four independent GraphQL servers that happen to share a browser. Merging
 * them into a single schema would invent an API that exists nowhere — and here it would not even
 * merge: three of the four slices declare a root pair literally called `QueriesApi`/`MutationsApi`,
 * so `refresh`, `logout` and `companyAdd` would collide onto one type and a document could be written
 * that type-checks against the merged shape while no single server can answer it. Keeping them apart also
 * means a document physically cannot be sent to the wrong endpoint — the `graphql()` helper it was
 * built with only knows its own schema, and `endpointFor` in src/api/endpoints.ts maps it back to the
 * one URL that serves it.
 *
 * `documents` is scoped per tier for the same reason. A document living under
 * src/api/operations/shopOwnerResource/ is typed against the ShopOwner resource schema only — which
 * matters more here than it looks: the Admin tier serves `shopOwnerCompanies`, `companyAdd`,
 * `companyUpdate` and `companyDel` under the same names with different arguments, so a document typed
 * against the wrong slice compiles cleanly and fails at run time.
 */
const preset = 'client' as const

/**
 * Shared by all four projects.
 *
 * `fragmentMasking: false` — the app reads fragment fields directly off the query result rather than
 * threading `useFragment` through every component, which is the right trade for a codebase this size.
 * `enumsAsTypes` keeps the generated sort enums as string unions, so a sort column can be carried in
 * the URL search params and handed to the query without a cast.
 */
const presetConfig = { fragmentMasking: false }

/**
 * `scalars` is kept even though no slice here currently mounts a custom scalar — the ShopOwner tier
 * exposes none, where the Admin tier's `registeredAt` and `birth.date` need both. It costs nothing
 * while unused and stops the first date field that arrives from being typed `unknown`, which on an
 * input field means the value cannot be assigned without a cast: that is how a date input silently
 * becomes `any`. Both cross the wire as ISO-8601 strings: `DateTime` a full timestamp, `Date` as
 * `YYYY-MM-DD`.
 */
const config = {
	enumsAsTypes: true,
	skipTypename: true,
	useTypeImports: true,
	scalars: { DateTime: 'string', Date: 'string' }
}

const codegenConfig: CodegenConfig = {
	// Tabs, to match every other file in this repo and the eslint `indent` rule the generated output
	// is exempt from but the config file is not.
	config: { useTypeImports: true },
	ignoreNoDocuments: true,
	generates: {
		'src/gql/publicAuthorization/': {
			schema: 'schema/public-authorization.graphql',
			documents: 'src/api/operations/publicAuthorization/**/*.ts',
			preset,
			presetConfig,
			config
		},
		'src/gql/shopOwnerAuthorization/': {
			schema: 'schema/authenticated-authorization.graphql',
			documents: 'src/api/operations/shopOwnerAuthorization/**/*.ts',
			preset,
			presetConfig,
			config
		},
		'src/gql/logout/': {
			schema: 'schema/logout.graphql',
			documents: 'src/api/operations/logout/**/*.ts',
			preset,
			presetConfig,
			config
		},
		'src/gql/shopOwnerResource/': {
			schema: 'schema/authenticated-resource.graphql',
			documents: 'src/api/operations/shopOwnerResource/**/*.ts',
			preset,
			presetConfig,
			config
		}
	}
}

export default codegenConfig
