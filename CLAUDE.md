# marketplace-shopowner

Shop-owner SPA, `ShopOwner` tier. Vite + React + TypeScript. Dev port **3044** (admin app is 3043).
Mirror of `marketplace-admin` — same stack, conventions, hooks — thinner because the ShopOwner-tier
backend is thinner.

**Read parent first** — [`../CLAUDE.md`](https://github.com/Axiumine/fullstack-marketplace-blueprint/blob/main/CLAUDE.md)
One of fifteen sub-repos; almost nothing here is changeable on its own.

| Need | File |
|---|---|
| what the app is, screens that do not exist yet | [`README.md`](./README.md) |
| hooks, gate order, lint scope, schema-vs-resolver divergences, source layout, testing conventions, gotchas | [`REPO.md`](./REPO.md) |
| gate policy, Stryker survivors | [`COVERAGE.md`](./COVERAGE.md) |
| GitNexus rules, registry name, CLI skill map | [`AGENTS.md`](./AGENTS.md) |
| anything cross-repo | parent `CLAUDE.md` |

⚠️ **A shop owner sees their own companies and nothing else, and nothing in this app enforces it.**
`shopOwnerCompanies`, `companyAdd`, `companyUpdate` and `companyDel` take no owner id; the resolvers read
it from `ctx.state.user._id`, the Redis session behind the access token. **Never add an owner id to a
variable set here**, not even "for symmetry with the Admin tier": that asks the backend to accept from a
browser the one thing the session already proves. The Admin tier's mutations of the same name *do* take
that id — the whole difference between an admin filing a company for someone and an owner filing their own.

⚠️ **English only** — identifiers, UI text, form labels, comments, routes. No exception; these are the
names the database and the resolvers use, so a rename is never local to this repo. The **`en-GB` locale**
`formatDateTime` renders with is a market choice, not a name.

⚠️ **Never run the mutation gate by hand.** `yarn test:mutation` is **hook-only** — it runs when
`pre-push` calls it and at no other time, not to check a change, not on one file. Never invoke `stryker`
directly either. To reproduce a survivor, apply the mutant by hand in the source and run `yarn test`
instead. Why: [`REPO.md`](./REPO.md).
⚠️ Since ADR-055 the script has a second caller, `.github/workflows/gates.yml`, which runs it on
every pull request — two callers, both automated, and a hand is neither.

⚠️ **`/admin-authenticated-resource` does not 404 for this tier's requests.** It implements
`shopOwnerCompanies`, `companyAdd`, `companyUpdate` and `companyDel` under the same names with
**different arguments**, so pointing this app there answers 200 with a GraphQL validation error, on the
tier that manages everyone's data. Endpoint table: [`README.md`](./README.md).

**`schema/*.graphql` is a hand-written copy, not the source of truth** — the platform has no SDL. Verify
against the resolver in the service repo before trusting a slice; recorded divergences from the admin
app's slices are in [`REPO.md`](./REPO.md). `src/gql/` is **generated** — never edit it, run
`yarn codegen`.

⚠️ **Tabs, not spaces** (eslint `indent: ['error','tab']`), matching every repo in the workspace.

⚠️ **Never read, echo or commit a secret file.** The dotted env file is git-ignored and the pre-commit
hook refuses it; `env` (no dot) is the committed template and is safe to read. To inspect the dotted one,
print key names only: `grep -oE '^[A-Za-z_0-9]+' .env`.

⚠️ **Never commit on `main`.** Branch first: `git switch -c <type>/<slug>`. **Push-on-request**: this
repo has no remote yet — where it gets published, and under which org, is the user's call and has not
been made — never run `git push` unless the user asked for it in that message. Merging is the user's
call alone.

⚠️ **Never lower a coverage or mutation threshold, and never remove a gate.** 100% on all four coverage
metrics, mutation score 100 — the same bar as every other repo. `git commit --no-verify` is not needed
here and must not be used; a red gate is fixed with a test.

## Cross-repo

A change here often is not local: operation shape → the resolver in
`marketplace-dev-authenticated-resource` (its own 100% coverage + mutation gates), then the `schema/`
slice, then `yarn codegen`. A model field → `marketplace-common`, published, then every consumer bumped.
An index or a validator → `marketplace-db-setup`, as a new migration — **applied migrations are
immutable**. **One logical change = N commits, one per repo.** There is no atomic cross-repo commit.

## GitNexus

Rules, registry name (`marketplace-shopowner`) and the CLI skill map are in
[`AGENTS.md`](./AGENTS.md) — the block there is hand-maintained, not regenerated (`.gitnexusrc` sets
`skipContextFiles`). Two rules apply everywhere in this workspace: run `impact({target, repo})` before
editing a symbol, and run `detect_changes()` before committing — `repo:` is mandatory and must be a
`marketplace*` registry name.
