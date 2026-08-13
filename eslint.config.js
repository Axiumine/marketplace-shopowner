import js from '@eslint/js'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import prettierConfig from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import globals from 'globals'

/**
 * Standalone flat config, not `@axiumine/eslint-config-be`.
 *
 * The shared backend config assumes Node globals, `.mts` sources and no JSX; every one of those is
 * wrong here. The rules that matter across the platform are reproduced explicitly instead: tabs, and
 * prettier last so formatting is decided in exactly one place (.prettierrc).
 */

/**
 * Everything this repo actually owns: the two source trees and the root-level configs.
 *
 * Every block below is scoped to a glob from this list, and that is deliberate. A flat-config entry
 * with no `files` key applies to **every file eslint walks into**, so `js.configs.recommended`
 * without one turned any stray `.js` under the repo root into a linted file — the Qodana HTML report
 * `--results-dir` writes reached `yarn lint` as 1601 `no-undef` errors in minified browser code
 * nobody here wrote. Ignoring the directory patched that one case; scoping is what makes the next
 * one impossible, because a path that matches no `files` glob is never linted whether or not anyone
 * thought to ignore it.
 */
const SOURCES = ['src/**/*.{ts,tsx}', 'test/**/*.{ts,tsx}']
const CONFIG_ROOT = ['*.{ts,js,mjs}']

export default [
	{
		// Tool output. With every block scoped these are already outside the linted set — except
		// `src/gql/**`, which the source glob does match and which must stay here. The rest are kept
		// for two reasons that survive the scoping: eslint skips the directory instead of walking it,
		// and the eight backend repos list the same paths, so the nine configs stay comparable.
		ignores: ['dist/**', 'coverage/**', '.stryker-tmp/**', 'reports/**', '.gitnexus/**', '.qodana/**', 'src/gql/**']
	},
	{ ...js.configs.recommended, files: [...SOURCES, ...CONFIG_ROOT] },
	{
		files: [...SOURCES, '*.ts'],
		languageOptions: {
			parser: tsParser,
			parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
			globals: { ...globals.browser }
		},
		plugins: {
			'@typescript-eslint': tsPlugin,
			'react-hooks': reactHooks,
			'simple-import-sort': simpleImportSort
		},
		rules: {
			...tsPlugin.configs.recommended.rules,
			...reactHooks.configs.recommended.rules,

			// Tabs, platform-wide. Enforced identically in every other repo here.
			indent: ['error', 'tab', { SwitchCase: 1 }],

			'simple-import-sort/imports': 'error',
			'simple-import-sort/exports': 'error',

			// `_`-prefixed args are the documented way to keep a signature that a caller depends on while
			// not using one of its parameters — a React event handler that ignores its event, for example.
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

			// The codebase talks to a GraphQL API whose error `extensions` are typed `unknown` by the spec.
			// `any` there is a lie that spreads; narrow at the boundary instead (see src/api/errors.ts).
			'@typescript-eslint/no-explicit-any': 'error',

			// A stray console.log in a browser bundle ships to production. Sentry is the reporting channel.
			'no-console': ['error', { allow: ['warn', 'error'] }],

			// `no-undef` cannot see TypeScript's type-only globals — it flags `ImportMetaEnv`, `JSX` and
			// every other ambient type as an undefined variable. The check it performs is one tsc already
			// does properly, with the type system rather than a scope walk, so it is redundant as well as
			// wrong here. This is the same call typescript-eslint makes in its own recommended TS configs.
			'no-undef': 'off'
		}
	},
	{
		// Two libraries hand back functions the React Compiler cannot prove stable, so it declines to
		// auto-memoize the component and the rule says so: `useReactTable` in the table, and react-hook-
		// form's `watch()` in the add form, which is read there because `AddressField` is controlled and
		// needs the current address text to geocode it.
		//
		// That is the correct outcome rather than a defect to route around: nothing in either file is
		// memoized, no memoized consumer receives a value from them, and every render recomputes from the
		// query result or the form state anyway.
		//
		// Turned off here rather than with an inline directive because the rule reports through the
		// compiler's own diagnostic channel: `eslint --fix` classifies an `eslint-disable-next-line` for
		// it as unused and deletes the comment, while the warning stays. A config override survives.
		files: ['src/features/shopOwners/TblShopOwners.tsx', 'src/features/shopOwners/ShopOwnerAddForm.tsx'],
		rules: { 'react-hooks/incompatible-library': 'off' }
	},
	{
		files: ['test/**/*.{ts,tsx}'],
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			// Tests assert on shapes that only exist at runtime (mock urql operations, partial GraphQL
			// payloads). Forcing a full type there produces fixtures larger than the tests.
			'@typescript-eslint/no-explicit-any': 'off'
		}
	},
	{
		files: [...CONFIG_ROOT],
		languageOptions: {
			globals: { ...globals.node }
		}
	},
	// E18-S08 — neither Sentry setting this backlog removed can come back here either.
	//
	// The same `no-restricted-syntax` block the ten backend repos carry, minus their Node-only
	// `maxIncomingRequestBodySize` selector: this app's `Sentry.init` takes no `httpIntegration`. Until
	// this block existed the three browser apps were the one tier with nothing watching those settings —
	// `src/instrument.ts` is excluded from coverage on purpose (a single init call behind a DSN check is
	// not worth a test), so a `sendDefaultPii: true` added there would have reached production with a
	// green run behind it.
	//
	// Scoped like every other block in this file rather than bare like the backends', because a
	// flat-config entry with no `files` key lints every file eslint walks into — the argument at the top
	// of this file. `test/restrictedSyntax.test.ts` is what makes the scoping safe to rely on: a rule
	// listed under the wrong glob is inert and reads exactly like a rule that holds.
	//
	// The `rejectUnauthorized` selectors stay despite a browser having no TLS agent. `marketplace-user`
	// renders server-side, so one of these three apps is also a Node process that reaches a backend over
	// TLS, and a selector present in two repos and missing from the third is the version of this nobody
	// can audit at a glance.
	{
		files: [...SOURCES, ...CONFIG_ROOT],
		rules: {
			'no-restricted-syntax': [
				'error',
				{
					selector: "AssignmentExpression[left.property.name='rejectUnauthorized']",
					message:
						'E12-S04: certificate verification stays on. Trust the collector CA from outside the process — NODE_EXTRA_CA_CERTS=/path/to/ca.pem — as the parent workspace SETUP.md §7 describes.'
				},
				{
					selector: "Property[key.name='rejectUnauthorized']",
					message:
						'E12-S04: certificate verification stays on. Trust the collector CA from outside the process — NODE_EXTRA_CA_CERTS=/path/to/ca.pem — as the parent workspace SETUP.md §7 describes.'
				},
				{
					selector: "Property[key.value='rejectUnauthorized']",
					message:
						'E12-S04: certificate verification stays on. Trust the collector CA from outside the process — NODE_EXTRA_CA_CERTS=/path/to/ca.pem — as the parent workspace SETUP.md §7 describes.'
				},
				{
					selector: "Property[key.name='sendDefaultPii']",
					message:
						'E12-S04: the blanket Sentry PII flag is absent by decision, not set to false. Name the individual dataCollection categories instead — the observability section of docs/architecture.md says which, and why.'
				},
				{
					selector:
						"ObjectExpression:has(> Property[key.name='beforeSend']):not(:has(> Property[key.name='beforeSendTransaction']))",
					message:
						'E12-S22: `beforeSend` and `beforeSendTransaction` are wired together or not at all. The SDK routes transaction events to the second hook only, and the address this app puts in a URL rides on the transaction — one hook without the other means a `tracesSampleRate` switches the redaction off.'
				},
				{
					selector: "MemberExpression[property.name='NODE_TLS_REJECT_UNAUTHORIZED']",
					message:
						'E12-S04: certificate verification stays on. Trust the collector CA from outside the process — NODE_EXTRA_CA_CERTS=/path/to/ca.pem — as the parent workspace SETUP.md §7 describes.'
				},
				{
					selector: "Literal[value='NODE_TLS_REJECT_UNAUTHORIZED']",
					message:
						'E12-S04: certificate verification stays on. Trust the collector CA from outside the process — NODE_EXTRA_CA_CERTS=/path/to/ca.pem — as the parent workspace SETUP.md §7 describes.'
				}
			]
		}
	},
	// Last: turns off every rule prettier owns, so `yarn lint` and `yarn lint:check` can never
	// disagree with `prettier --write` about formatting. Scoped like the rest — a bare entry here
	// would be harmless (it only switches rules off) but would still say the config applies to files
	// this repo does not own.
	{ ...prettierConfig, files: [...SOURCES, ...CONFIG_ROOT] }
]
