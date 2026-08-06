# marketplace-shopowner

Marketplace shop-owner area (`ShopOwner` tier). Vite + React SPA, TypeScript strict.

**Shop-owner tier only.** A shop owner logs in through `login` and manages their **own** companies —
nothing else, and nobody else's. The tenant boundary is not a filter this app applies: the resolvers on
this tier take no owner id at all and read it from the Redis session behind the access token, so there
is nothing here that could be pointed at another owner's data.

Mirrored from `marketplace-admin`, the operator app for the `Admin` tier — same stack, same
conventions. The customer (`User`) frontend is a third app that does not exist yet.

## What this app is not, yet

The mirror is thinner than the original because the backend behind it is thinner.
`marketplace-dev-authenticated-resource` exposes **one query and three mutations** in total —
`shopOwnerCompanies`, `companyAdd`, `companyUpdate`, `companyDel` — and that is the whole authenticated
surface of this tier. Every operator-app screen missing here is missing for the same reason: there is
no resolver to call.

| Operator app screen | Backed by | Here |
|---|---|---|
| profile after login | `infoAdminAfterLogin` | **none** — the sidebar shows the address typed at sign-in, and nothing after a reload |
| change own password | `adminUpdatePwd` | **none** — no `shopOwnerUpdatePwd` exists |
| edit own personal data | `shopOwnerUpdate` (an operator acting on someone) | **none** — an owner cannot edit their own record |
| dashboard stats and chart | `shopOwnersStats`, `shopOwnersPerPeriod` | **none** — no aggregate on this tier |
| paginated table | `shopOwnersActiveTbl` | **none** — the companies list is short and unpaged |

Building any of them starts in `BEs/dev/marketplace-dev-authenticated-resource`, not here. They were
pruned rather than stubbed: a screen that renders and cannot save is worse than one that is absent.

Password recovery is the one capability this tier has and the operator tier does not — `resetPwd` and
`updatePwd` on `marketplace-dev-public-resource` are bound to the `ShopOwner` model — and it is still
not wired up. It needs a fifth endpoint (port 4027), its own slice, its own codegen project, a
`CTX_PUBLIC_RESOURCE`, a proxy entry and two screens. See the note in `src/pages/LoginPage.tsx`.

## Stack

| Concern | Choice |
|---|---|
| Build | Vite 8, React 19, TypeScript 6 (`strict` + `exactOptionalPropertyTypes`) |
| Routing | TanStack Router — route tree in code, URL is the state (`validateSearch` + zod) |
| GraphQL | urql + `cacheExchange` + `@urql/exchange-auth`, one `Client`, endpoint per operation via `context.url` |
| Types | graphql-codegen `client-preset`, one project per access level → `TypedDocumentNode` |
| Forms | react-hook-form + zod |
| Styling | Tailwind 4, Radix `Label` |
| Errors | Sentry (`@sentry/react`), disabled without a DSN |

TanStack Table is installed and unused — nothing on this surface is a table yet. It stays for the day
a second collection hangs off `company`.

## Getting started

Node **24.18.0** via nvm — `engines` is a hard gate under yarn classic, a mismatch exits 1.

```bash
nvm use 24.18.0
yarn install          # `prepare` points core.hooksPath at .githooks
cp env .env           # then edit: the dotted file is git-ignored, `env` is the committed template
yarn codegen          # writes src/gql/ from schema/*.graphql
yarn dev              # http://127.0.0.1:3044
./dev.sh              # same, with node_modules on a tmpfs ramdisk (wipes node_modules first)
```

`yarn dev` proxies the four GraphQL paths to the backend services on 4028 / 4029 / 4026 / 4030. A
service that is not running fails its own endpoint and leaves the rest of the app working.

## Commands

```bash
yarn dev            # vite dev server
yarn build          # codegen && tsc --noEmit && vite build
yarn preview        # serve dist/
yarn codegen        # regenerate src/gql/ (also codegen:watch)
yarn typecheck      # tsc --noEmit
yarn lint           # eslint --fix + prettier --write   (lint:check for CI)
./qodana.sh         # Qodana Ultimate scan: inspections, SAST, SCA, licenses, coverage
```

```bash
yarn test           # vitest run          (test:watch to keep it open)
yarn test:cov       # coverage, gated at 100% on all four metrics
yarn test:mutation  # Stryker, gated at a score of 100
```

**497 tests over 38 files, 100% coverage, 100% mutation score** — the same bar as every other repo on
the platform, so no commit here needs `--no-verify`. The suite was seeded from the operator app's and
adapted screen by screen; `COVERAGE.md` has the gate layers and the recipe for a surviving mutant.

`.githooks/pre-push` runs lint → typecheck → coverage → mutation → Qodana, all blocking, and
`.githooks/pre-commit` runs lint → typecheck → coverage → Qodana on top of the secret guard. Qodana is
in both on purpose: `git merge --no-ff` never fires `pre-commit`, so the merge commit is the one
revision a commit-time scan never sees, and Qodana Cloud files each report under the branch it ran on —
only the pre-push scan, standing on `main` after the merge, produces a report the "new problems"
baseline can use. `SKIP_QODANA=1` skips the scan alone. The scan needs a `QODANA_TOKEN` from **this
repo's own** qodana.cloud project; a backend service's token files these reports under that service and
corrupts its baseline. See `COVERAGE.md`.

## Endpoints

Four GraphQL servers, one origin. The paths are the `ENDPOINT` constants each service exports from its
`src/index.mts`.

| Path | Service | Port (dev) | Operations |
|---|---|---|---|
| `/public-authorization` | `marketplace-dev-public-authorization` | 4028 | `login` |
| `/authenticated-authorization` | `marketplace-dev-authenticated-authorization` | 4029 | `refresh` |
| `/authenticated-resource` | `marketplace-dev-authenticated-resource` | 4026 | everything else |
| `/logout` | `marketplace-dev-authenticated-logout` | 4030 | `logout` |

⚠️ **These are the services *without* `admin` in the name.** Getting one wrong is usually a 404 — but
not the resource endpoint: `/admin-authenticated-resource` serves `shopOwnerCompanies`, `companyAdd`,
`companyUpdate` and `companyDel` under the same names with **different arguments**, so pointing this
app there answers 200 with a GraphQL validation error about unknown arguments, on the tier that manages
*everyone's* data.

Single origin is not a convenience: the refresh token is a signed httpOnly cookie, and cross-origin
would need `SameSite=None` on it plus a CORS allow-list on every service. Same origin makes
`credentials: 'include'` sufficient. nginx does in production what the vite proxy table does in
development.

## Auth

Opaque tokens and Redis sessions — **not JWT**. A stale `JWT` type still appears in the platform's
schema slices; it describes nothing that exists.

- The access token lives in memory only (`src/api/tokenStore.ts`). A reload wipes it on purpose.
- The refresh token is an httpOnly cookie the browser never exposes to JS.
- `authExchange` refreshes *before* sending when there is no token and the endpoint needs one — that
  is the whole page-reload story — and retries once on **498**.
- 401, 412 and 499 are terminal and end the session (`mapExchange`, below `authExchange` in the chain
  so results reach it on the way back up).
- Requests are **POST, always** (`preferGetMethod: false`). Every service builds its `ApolloServer`
  with `csrfPrevention: true`, which blocks a GET carrying none of the preflight-forcing headers, and
  urql sends none of them.
- Each tier has its own Redis session namespace, so an operator's access token is not a shop owner's
  and does not resolve on these services.

## Routes

| Path | Screen |
|---|---|
| `/` | login |
| `/loading` | session restore, then `?redirect=` |
| `/home` | dashboard |
| `/companies` | the owner's companies — add, edit, soft-delete |

Four routes, and no path or search param anywhere except `/loading`'s `?redirect=`. That is the tenant
boundary showing up in the URL space: the operator app needs `/p/shopOwners/id/$_id` because an
operator has to say *whose* companies they are looking at, and here there is nobody else to name.

Everything except `/` and `/loading` sits behind a pathless guarded route. An empty session redirects
to `/loading`, not to `/`: only a round-trip can tell "never signed in" from "signed in and reloaded".

## Deployment

`yarn build` → `dist/`, static. nginx serves it and proxies the four paths above to the services, from
the same origin, with `try_files $uri /index.html` for the client-side routes. No nginx config lives in
this workspace — the vhosts are on the host that fronts the stack.

## Decisions that look wrong until you know why

Each entry is a plausible change someone will propose, and the reason it is not made. The mistakes they
guard against all render as a working screen.

- **`shopOwnerCompanies` is called with no variables, and no owner id is ever sent on a write.** Not an
  oversight and not a shorthand: the resolvers take none. Adding one would mean changing the backend to
  accept from the browser the very thing the session already proves.
- **The sidebar shows no address after a reload.** `session.email` is `null` there, because the login
  form is the only place this app ever learns it and no ShopOwner-tier query answers "who am I". It
  renders nothing rather than an empty string — a blank strip reads as a failed load. Fix it with an
  `infoShopOwnerAfterLogin` resolver, not with a placeholder.
- **`onboardingStep` and `onboardingDone` are selected and never read.** `login.mts` returns the two
  locals it declared and never assigns the computed step back into them, so every owner gets `''` and
  `false` whatever their real state. Selecting them keeps the document stable for the day that is
  fixed; branching on them today would branch on a constant.
- **`position.type` is sent here and must not be on the Admin tier.** The two services disagree: the
  Admin tier's input declares `coordinates` alone and stamps `'Point'` server-side, this one requires
  `type: String!` from the client and stamps nothing. The literal lives in one constant in
  `Companies.tsx`. Worth fixing in the service — a value with exactly one legal spelling should not
  cross the wire.
- **`companyDel` answers 403 on a company already deleted, where the Admin tier answers 200.** The
  difference is `throwIfShopOwnerDontOwnCompany`, which filters `deleted` and which only this tier
  runs. Both are correct: liveness belongs on the ownership guard, not on the delete write.
- **A retired company keeps its partita IVA forever.** `vatNumber_unique` and `certifiedEmail_unique`
  are plain global uniques with no partial filter, so re-registering one answers a duplicate-key error.
  That is the intended rule — one partita IVA is one company — not something to work around here.
- **Create and delete mutations pass `additionalTypenames`.** The document cache invalidates by the
  typenames a mutation's *response* mentions; `companyUpdate` and `companyDel` answer a bare `Boolean`
  and `companyAdd` an `OnlyIdType`, so without the list every write leaves the screen unchanged.
- **`context.url` objects are module constants.** urql compares context by key and re-executes when it
  changes, so a `{ url }` literal in a component body is a new object per render — an infinite refetch
  loop.
- **The email typed at sign-in travels through a module variable, not the URL.** A query string would
  put the owner's address in the browser history and in every referrer the app leaks. `/loading` reads
  it without consuming it, because React's development double-invoke would otherwise swallow it
  between the two runs of the same effect; `useLogout` is what clears it.

## Deviations from the technical specification

| Spec | Here | Why |
|---|---|---|
| TanStack Virtual | not used | Nothing here is a long list — an owner has a handful of companies. |
| TanStack Table | installed, unused | No table on this surface yet. |
| Radix Dialog / Toast | not used | Nothing is modal, and errors belong next to what failed — `Alert` is inline and `role="alert"` only for the error tone. |
| File-based routing | route tree in code | A generated `routeTree.gen.ts` cannot be tested, so it would have to be excluded from coverage and mutation — and every exclusion is a hole. Four routes do not need a generator. |
| Schema from the server | `schema/*.graphql`, hand-maintained | The platform has no SDL: all nine services build their schema programmatically with graphql-js. These four files are hand-written slices, and they are a copy — verify against the resolvers, never the other way round. |
