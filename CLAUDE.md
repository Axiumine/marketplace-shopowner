# marketplace-shopowner

Shop-owner SPA, `ShopOwner` tier. Vite + React + TypeScript. Dev port **3044** (operator app is 3043).

**Read parent first** — [`../CLAUDE.md`](https://github.com/Axiumine/fullstack-marketplace-blueprint/blob/main/CLAUDE.md)
One of fifteen sub-repos; almost nothing here is changeable on its own.

| Need | File |
|---|---|
| what the app is, screens that do not exist yet | [`README.md`](./README.md) |
| hooks, gate order, node selection, lint scope | [`REPO.md`](./REPO.md) |
| gate policy, Stryker survivors | [`COVERAGE.md`](./COVERAGE.md) |
| anything cross-repo | parent `CLAUDE.md` |

Mirror of `marketplace-admin`. Same stack, conventions, hooks. Thinner because the ShopOwner-tier backend
is thinner.

⚠️ **A shop owner sees their own companies and nothing else, and nothing in this app enforces it.**
`shopOwnerCompanies`, `companyAdd`, `companyUpdate` and `companyDel` take no owner id; the resolvers read
it from `ctx.state.user._id`, the Redis session behind the access token. **Never add an owner id to a
variable set here**, not even "for symmetry with the Admin tier": that asks the backend to accept from a
browser the one thing the session already proves. The Admin tier's mutations of the same name *do* take
that id — which is the whole difference between an operator filing a company for someone and an owner
filing their own.

⚠️ **English only** — identifiers, UI text, form labels, comments, routes. No exception; these are the
names the database and the resolvers use, so a rename is never local to this repo. The **`en-GB` locale**
`formatDateTime` renders with is a market choice, not a name: changing it changes every date on screen and
every snapshot that shows one.

## Endpoints — the ones *without* `admin` in the name

| Path | Service | Port | Operations |
|---|---|---|---|
| `/public-authorization` | `marketplace-dev-public-authorization` | 4028 | `login` |
| `/authenticated-authorization` | `marketplace-dev-authenticated-authorization` | 4029 | `refresh` |
| `/authenticated-resource` | `marketplace-dev-authenticated-resource` | 4026 | everything else |
| `/logout` | `marketplace-dev-authenticated-logout` | 4030 | `logout` |

⚠️ **Pointing the resource endpoint at the admin service does not 404.**
`/admin-authenticated-resource` implements `shopOwnerCompanies`, `companyAdd`, `companyUpdate` and
`companyDel` under those exact names with **different arguments**, so the request reaches the tier that
manages everyone's data and comes back 200 with a GraphQL validation error about unknown arguments. The
other three paths do 404 when mistyped.

## Do not trust `schema/*.graphql`

The platform has **no SDL**. All nine backend services build their schema programmatically with graphql-js.
The four files under `schema/` are hand-written slices, kept only because graphql-codegen needs a schema to
type documents against.

**They are a copy, and a copy drifts.** Before adding or changing any operation, read the resolver in the
service repo — `BEs/dev/marketplace-dev-*/src/graphQLApi/` — and make the slice match. The resolvers are
the contract. A slice can declare an operation no service implements, or give an argument a different name
from the resolver's; both compile, both pass codegen, and both fail only at run time.

Three divergences from the operator app's slices were verified against source and recorded in the files
themselves — **do not "fix" them back**:

- **`companyAdd` answers `OnlyIdType`**, not `Boolean`. The call site tests
  `result.data?.companyAdd._id === undefined`, not the object, so it stays honest if the field ever goes
  nullable.
- **`GraphQLInputCompanyPosition` requires `type: String!`** here and forbids it there. This tier's input
  spreads `GraphQLPositionFrag`; the Admin tier's declares `coordinates` alone and stamps `'Point'` in
  `validateAddress`. No server-side stamp exists on this side — `grep -rn "'Point'"` in
  `marketplace-dev-authenticated-resource/src` returns nothing — so the client must send it.
- **`companyUpdate` does not 500 on a no-op save.** `funCompanyUpdate` checks `matchedCount`, not
  `modifiedCount`. The operator app's note blaming `shopOwnerUpdate` describes a mutation this tier does
  not have.

`src/gql/` is generated. Never edit it; run `yarn codegen`.

## Layout

```
schema/                     hand-maintained SDL slices, one per endpoint
src/
├── api/
│   ├── client.ts           the single urql Client + exchange chain
│   ├── endpoints.ts        ENDPOINT + the frozen CTX_* context objects
│   ├── errors.ts           status extraction from the platform's error shape
│   ├── operations/<tier>/  the documents, one directory per access level
│   └── tokenStore.ts       in-memory access token
├── auth/                   session store + useLogout
├── components/layout|ui/   AppShell, SideMenu, and the primitives
├── features/<area>/        the screens' actual content
├── pages/                  one component per route, props in, no URL access
├── gql/                    GENERATED
└── router.tsx              route tree, search-param schemas, URL → props
```

`pages/` read nothing from the URL; `router.tsx` is the only place params and search become props. That is
what lets a page be rendered in a test without a router assertion in the way.

## Things that bite

- **The session's `email` is nullable, and null after every reload.** The login form is the only place this
  app learns the owner's address — no ShopOwner-tier query answers "who am I" — and it hands it to
  `/loading` through a module variable in `src/auth/session.ts`, never the URL, which would put the address
  in the browser history and in every referrer the app leaks. `/loading` **reads it without clearing it**:
  React runs every effect twice in development, and a read-and-clear would let the second run overwrite the
  session with a nameless one. `useLogout` clears it, the one moment it genuinely stops describing the
  current user. Nothing survives a reload either way — a page load rebuilds the module.
- **`onboardingStep` and `onboardingDone` come back constant.** `login.mts` declares `let onboardingStep = ''`
  / `let onboardingDone = false`, computes the real step inside the transaction, writes *that* into Redis and
  returns the untouched locals. The document selects them so it is ready the day the service is fixed;
  **no code here may branch on them until it is.**
- **`context.url` objects must be module-level constants.** urql re-executes an operation when its context
  changes and compares by key → a `{ url }` literal in a component body is a new object per render, an
  infinite refetch loop. Use `CTX_*` from `src/api/endpoints.ts`; never inline.
- **`preferGetMethod: false` is load-bearing.** Every service sets `csrfPrevention: true`, which rejects a
  GET without the preflight-forcing headers urql does not send. Flip it and every query short enough to fit
  in a URL fails with a CSRF message while mutations keep working.
- **Create and delete mutations need `additionalTypenames`.** The document cache invalidates by the
  `__typename`s a mutation's *response* mentions; `companyUpdate` / `companyDel` answer a bare `Boolean`
  and `companyAdd` an `OnlyIdType` → nothing is invalidated unless the call site names the affected types.
- **Codegen has one project per access level and must never be given a merged schema.** Three of the four
  slices declare root types literally named `QueriesApi` / `MutationsApi`, so a merge collides `refresh`,
  `logout` and `companyAdd` onto one type.
- **Adding an operation on a new endpoint** = a new `schema/` slice + a new `codegen.ts` project + a new
  `CTX_*` + a proxy entry in `vite.config.ts`. Not just a file in `src/api/operations/`. Password recovery
  is exactly that shape of job: `resetPwd` / `updatePwd` live on `marketplace-dev-public-resource` (4027)
  and *are* bound to the `ShopOwner` model, so this tier can have it — the screens simply are not built.
  See `src/pages/LoginPage.tsx`.
- **Every block in `eslint.config.js` carries a `files` glob.** A flat-config entry without one applies to
  *every* file eslint walks into, including minified Qodana HTML reports — thousands of `no-undef` errors
  in code nobody wrote. The globs live in `SOURCES` and `CONFIG_ROOT` at the top of the file; add a block by reusing them, never by
  omitting `files`.
- **Tabs, not spaces** (eslint `indent: ['error','tab']`). Prettier: no semicolons, single quotes,
  `trailingComma: "none"`, `printWidth: 129`, `useTabs: true` — byte-identical to the other twelve repos
  that carry a `.prettierrc`.
- **Node `^24.18.0`**, yarn classic. `engines` is a hard gate: `nvm use 24.18.0` before any yarn command or
  the install exits 1.
- **Never read, echo or commit a secret file.** The dotted env file is git-ignored and the pre-commit hook
  refuses it; `env` (no dot) is the committed template and is safe to read. To inspect the dotted one,
  print key names only: `grep -oE '^[A-Za-z_0-9]+' .env`.

## Version control

- **This repo has no remote yet.** Where it gets published, and under which org, is the user's call and has
  not been made. **Push-on-request**: never run `git push` unless the user asked for it in that message.
- **Never commit on `main`.** Branch first: `git switch -c <type>/<slug>`. Merging is the user's call.
- **Delete the branch once it is merged.** `git branch -d <slug>`, right after the merge. `-d`, never `-D`:
  it refuses a branch whose commits are not already reachable, so the safe case is quiet and the unsafe one
  stops you.

## Tests

**100% coverage on all four metrics, 100% mutation score** — the same bar as every
other repo. `git commit --no-verify` is not needed here and must not be used; a red gate is fixed with a
test, never by lowering a threshold or deleting the gate. [`COVERAGE.md`](./COVERAGE.md) has the layers and what to do with
a Stryker survivor.

Seeded from the operator app's suite and adapted file by file, so its conventions are the ones below. Where
it diverges, the divergence is a tier difference: no `ShopOwnerById` fixture and no id in any URL, a
two-section sidebar, a `CompaniesPage.test.tsx` with no counterpart there.

- **GraphQL is stubbed at `fetch`**, not with a mock urql client. Everything above `fetch` is then real:
  the cache, the 498 retry, the status extraction, the session teardown. Replies are queued per operation
  name, and an operation nobody configured **throws** — deliberate, an unexpected request is the
  interesting half of a regression.
- **`renderRoute(path)`** mounts the real router at a real URL.
- **jsdom enforces interactive form validation.** A value that fails an `<input type="email">`'s own check
  never fires submit, so a zod email rule is only reachable with something the HTML validator accepts —
  `owner@marketplace` (no TLD), not `owner`.
- **`fireEvent.change`, not `userEvent.type`,** for any field with a `maxLength` or a date input.
- `Alert` is `role="alert"` only for the error tone; success and info are `role="status"`.
- `TZ=UTC` is exported by the test scripts *and* set in `vitest.config.ts`. Both are needed: Stryker's
  worker pool ignores the config one.
- The route tree is built by a factory (`createAppRouteTree()`) rather than a module constant, so Stryker's
  module registry cannot cache route definitions across mutants.

## Gates

commit → secret guard, lint, typecheck, coverage, Qodana. push → same + mutation. All blocking. Why:
[`REPO.md`](./REPO.md).

## Cross-repo

A change here often is not local:

- operation shape → the resolver in `marketplace-dev-authenticated-resource` (and its own 100% coverage +
  mutation gates), then the `schema/` slice, then `yarn codegen`
- a model field → `marketplace-common`, published, then every consumer bumped
- an index or a validator → `marketplace-db-setup`, as a new migration; applied migrations are immutable

One logical change = N commits, one per repo. There is no atomic cross-repo commit.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **marketplace-shopowner**. Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/marketplace-shopowner/context` | Codebase overview, check index freshness |
| `gitnexus://repo/marketplace-shopowner/clusters` | All functional areas |
| `gitnexus://repo/marketplace-shopowner/processes` | All execution flows |
| `gitnexus://repo/marketplace-shopowner/process/{name}` | Step-by-step execution trace |

## Cross-Repo Groups

This repository is listed under GitNexus **group(s): marketplace-platform** (see `~/.gitnexus/groups/`). For cross-repo analysis, use MCP tools `impact`, `query`, and `context` with `repo` set to `@<groupName>` or `@<groupName>/<memberPath>` (paths match keys in that group’s `group.yaml`). Use `group_list` / `group_sync` for membership and sync. From the project root: `node .gitnexus/run.cjs group list`, `node .gitnexus/run.cjs group sync <name>`, `node .gitnexus/run.cjs group impact <name> --target <symbol> --repo <group-path>` (the `.gitnexus/run.cjs` path is repo-root-relative).

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
