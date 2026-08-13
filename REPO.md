# Repository mechanics

How this repo's git plumbing and lint scope behave, and why. Nothing here changes what you write — it
explains what happens when you commit, push, or watch a gate fail. [`CLAUDE.md`](./CLAUDE.md) carries the rules
themselves, [`COVERAGE.md`](./COVERAGE.md) the thresholds.

## The hooks

`.githooks/pre-push` is a blocking six-step gate: `yarn semgrep:ci` (Semgrep SAST, rules vendored under
`semgrep/`, pinned image, `--network none`), then `yarn lint:check`, then `tsc --noEmit`, then
`yarn test:cov` (100 on all four metrics), then `yarn test:mutation` (100), then `./qodana.sh`.

`.githooks/pre-commit` repeats lint, typecheck, coverage and Qodana on top of the secret guard. Semgrep and
mutation are push-only — both need Docker, and push is the layer that sees the merge commit. Both hooks pass `SKIP_TESTS=1` to the scan so it reuses the `coverage/lcov.info` the step
before it just wrote.

Semgrep is first because it is the cheapest of the six by an order of magnitude — about three seconds
against the minutes the rest take together. Lint leads the five that follow because it is the cheapest of
them and the only one that can fail on a file the other four are perfectly happy with — the next `yarn lint` would rewrite it anyway. `.prettierrc` and
`.prettierignore` joined `eslint.config.js` in the hooks' `RELEVANT_PATHS` at the same time, since the gate
reads all three; before that, a commit touching only them skipped every gate there is.

## Why Qodana runs in both hooks

**`git merge --no-ff` never fires `pre-commit`** — git runs that hook for `git commit` only — so the merge
commit, the only revision that reaches `origin`, is the one thing a commit-time scan never inspects. Two
individually clean branches can merge into a tree that is not.

The second reason is Qodana Cloud: it files every report under the branch it ran on, and pre-commit always
runs on the feature branch, so a repo gated only at commit time never produces a `main`-tagged report for
the baseline to compare against.

Both hooks *block* on a missing prerequisite — the `qodana` CLI, the docker daemon, the
`jetbrains/qodana-js` tag `qodana.yaml` names, `QODANA_TOKEN` — and print the fixing command rather than
skipping. **The token is per project**: this repo has its own on qodana.cloud, separate from the operator
app's and from the nine backend ones. Another repo's token would file these reports under that repo's
project.

## Node selection

Ahead of its six gates the pre-push hook selects node itself. It reads `engines.node` from `package.json`
— never a hard-coded version — and sources nvm to switch if the current node does not satisfy it.

This is necessary because every gate shells out to yarn and yarn's `engines` check is a hard failure: on
the wrong node the push used to die at step 1 with `The engine "node" is incompatible with this module`,
printed under the banner about type errors, which is not what had gone wrong. If nvm is absent or the
version is not installed, the hook blocks with the `nvm install` line instead of letting yarn report
nonsense. All fourteen sub-repos that carry hooks have the same block now; it started in `marketplace-common`'s
*pre-commit*, which is where it was copied from.

## Lint scope

`yarn lint` runs `eslint --fix . && prettier --write .`, and `lint:check` runs both read-only. The scope is
the **whole tree**, not `src/` — which is how test files and configs drifted unnoticed for as long as they
did. All thirteen sub-repos that have a lint config (every one but `marketplace-db-setup`) work this way.

What is out of scope lives in `.prettierignore`, and markdown is in there on purpose: `proseWrap: "never"`
would flatten every hand-wrapped paragraph in these docs onto one line.

The backend nine never hit the flat-config `files`-glob bug described in [`CLAUDE.md`](./CLAUDE.md), because
`@axiumine/eslint-config-be` scopes everything to `src/**`.

## Bypasses

`SKIP_QODANA=1` (scan only — the other gates stay) · `git commit --no-verify` / `git push --no-verify` (the
whole hook). Both are gate removals. See [`CLAUDE.md`](./CLAUDE.md) for when they may be used, which is: when the user
says so, and not otherwise.
