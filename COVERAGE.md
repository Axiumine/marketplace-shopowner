# Coverage and mutation policy

**The suite exists and both numbers are met: 497 tests over 38 files, 100% on all four coverage
metrics, 100% mutation score.** No `--no-verify` is needed here any more, and none should be used.

It was seeded from the operator app's suite rather than written blind — `cp -r ../marketplace-admin/test/.`
and then adapted file by file — which is why the conventions below read as `marketplace-admin`'s: they
are. What did *not* survive the copy is worth knowing before the next test is written, because each
divergence is a tier difference and not an oversight: `Companies.test.tsx` lost its `ShopOwnerById`
fixture and its `/p/shopOwners/id/$_id` route (the owner is the session's, so the page has nothing to be
told), `SideMenu.test.tsx` was rewritten around two sections instead of three, and `CompaniesPage.test.tsx`
had no counterpart at all — the operator app reaches `useDiscardWarning` through a different page.

Two numbers, both 100, both blocking — plus a scan that re-checks the first one and much else:

| Gate | Command | Where the threshold lives |
|---|---|---|
| Coverage — statements, branches, functions, lines | `yarn test:cov` | `vitest.config.ts`, `qodana.yaml` |
| Mutation score | `yarn test:mutation` | `stryker.config.mjs` (`thresholds.break: 100`) |
| Inspections, SAST, SCA, license audit, coverage | `./qodana.sh` | `qodana.yaml` (`failureConditions`) |

All three run in `.githooks/pre-push`, after `tsc --noEmit`; coverage and Qodana run again in
`.githooks/pre-commit`. Nothing may be lowered — the fix for a red run is a test, or the deletion of
the code that has no reason to exist.

| Layer | File | What it does |
|---|---|---|
| Local test run | `vitest.config.ts` → `test.coverage.thresholds` | `yarn test:cov` exits non-zero if any metric < 100% |
| Local mutation run | `stryker.config.mjs` → `thresholds.break` | `yarn test:mutation` exits non-zero if the score < 100 |
| Qodana scan gate | `qodana.yaml` → `failureConditions.testCoverageThresholds` (`total`/`fresh` = 100) | `./qodana.sh` fails the scan if coverage < 100% |
| Git `pre-commit` | `.githooks/pre-commit` | blocks the commit if `yarn typecheck`, `yarn test:cov` **or** the Qodana scan fails |
| Git `pre-push` | `.githooks/pre-push` | blocks the push if `yarn lint:check`, `yarn typecheck`, `yarn test:cov`, `yarn test:mutation` **or** the Qodana scan fails |

The three coverage layers read the same run (vitest, v8 provider, lcov → `coverage/lcov.info`).
Change coverage config in `vitest.config.ts` only. Qodana has no mutation gate — `pre-push` is the
only one.

Both hooks run the scan on purpose. `git merge --no-ff` never fires `pre-commit` — git runs that hook
for `git commit` only — so the merge commit, the one revision that reaches `origin`, is the single
commit no pre-commit scan ever sees. And Qodana Cloud files each report under the branch it ran on,
so a repo scanned only at commit time never produces a `main`-tagged report to baseline against. Each
hook hands `qodana.sh` `SKIP_TESTS=1`, reusing the `coverage/lcov.info` its own coverage step just
wrote rather than letting the script regenerate it with a test run whose failure it swallows.
`SKIP_QODANA=1` skips the scan alone; the coverage and mutation gates stay.

The scan needs a `QODANA_TOKEN` — this repo's own project on [qodana.cloud](https://qodana.cloud), in
`.env` or exported. A backend service's token is not interchangeable: reports would be filed under
that project and corrupt its baseline.

## Why both

Coverage answers "did this line run". Mutation answers "would a test have failed had this line been
wrong". Every package on this platform has sat at 100% coverage with mutants alive; `marketplace-common`
scored 45.95% the first time it was measured. A `toBeInTheDocument()` with no text matcher, a
`toHaveBeenCalled()` with no argument matcher, and a snapshot written from already-wrong output all
pass for the original and for the mutant.

## Fixing a survivor

Read `reports/mutation/mutation.html`. In order of what it usually is:

1. **A weak assertion.** Assert the rendered text, not the presence of a node. Assert the variables of
   the request, not that a request happened.
2. **A branch that cannot be reached.** Delete it rather than testing it. Two were removed that way in
   the operator app: a second `?? []` on a list the empty check had already unwrapped, and a
   `{session?.email ?? ''}` whose fallback rendered a bordered empty strip in a state that is real —
   `useLogout` clears the session before it navigates. ⚠️ The second one does **not** transfer: here
   `session.email` is legitimately `null` after every reload, because no ShopOwner-tier query answers
   "who am I", so `SideMenu` guards on `session?.email == null` and that branch is reachable and needs
   a test rather than a deletion.
3. **A load-time mutant** in a module-scope constant: the module was imported once, before any test
   could observe it. Re-import it with a dynamic `await import()` inside `beforeEach`.
4. **A genuinely equivalent mutant** — and only then — gets
   `// Stryker disable next-line <Mutator>: <why>` in `src/`, with the reachability argument written
   above it.

**Never add `ignoreStatic`.** It masks the whole third category, and the survivor it appears to fix is
the one worth fixing.

## Exclusions, and why each is not a hole

The same four paths are excluded from coverage and from mutation:

| Path | Reason |
|---|---|
| `src/gql/**` | graphql-codegen output. Mutating it tests the generator, and the document strings are compared by identity — a flipped character produces a document no test can send. |
| `src/main.tsx` | `createRoot(...).render(...)`. Runs only against a real document; the one thing it could get wrong is mounting the wrong tree, which every other test covers. |
| `src/instrument.ts` | One `Sentry.init` behind a DSN check. Every mutant is either ignored by the SDK or observable only by asserting the SDK exists. |
| `src/vite-env.d.ts` | Ambient types. No runtime. |

`qodana.yaml` excludes `src/gql` from inspection for the same reason.

## Running the scan by hand

```bash
./qodana.sh                              # full: yarn test:cov, then the scan
SKIP_TESTS=1 ./qodana.sh                 # reuse the existing coverage/lcov.info
./qodana.sh --results-dir .qodana/results   # SARIF readable from the repo root
```

Prerequisites are checked by both hooks and each one *blocks* with the command that fixes it — a gate
that steps aside when it cannot run is not a gate. They are: the `qodana` CLI in `PATH`, a reachable
docker daemon, the `jetbrains/qodana-js` image the `image:` key in `qodana.yaml` names (the hooks read
the tag from there, so bumping it in one place cannot leave them scanning with an older linter), and
the token.

## Three traps the operator app's suite already hit

The configs here already carry all three fixes. Do not undo them because nothing in this repo appears
to need them yet — the first test that renders a date or a form will.

**Timezone.** Every date on screen goes through `Intl`, which reads the ambient zone. `vitest.config.ts`
sets `env: { TZ: 'UTC' }`, and that is enough for a plain `vitest run` — but Stryker's vitest runner
uses a worker pool where assigning `process.env.TZ` does not move ICU's zone, so the dry run failed with
`expected '10 January 2026 at 10:30:00' to be '…09:30:00'` on a developer machine one hour ahead of
UTC. The scripts therefore export `TZ=UTC` at process level as well; keep both.

**`useId`.** React counts per test *file*, so inserting a test above a snapshot renumbers `id` and
`aria-labelledby` in a snapshot nobody touched. `vitest.setup.ts` installs a serializer that renumbers
both ends from zero per snapshot: the pairing an `aria-labelledby` depends on still diffs, the counter
does not.

**Stryker sandbox.** `ignorePatterns` in `stryker.config.mjs` drops `.claude` and `.agents`, whose
`skills/*` entries are symlinks to directories — `copyFile` answers `EISDIR` and the run aborts before
a single mutant exists.
