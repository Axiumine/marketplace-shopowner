/**
 * Mutation testing gate — 100, the same as the seven backend services and marketplace-common.
 *
 * Coverage proves a line ran. Mutation proves a test would have failed had that line been wrong.
 * The two answers diverge badly: every package on this platform sat at 100% coverage while mutants
 * survived. Do not lower `thresholds.break`, and do not add `ignoreStatic` to silence a survivor —
 * it masks real gaps, and the survivor it appears to fix is usually a load-time mutant that needs a
 * dynamic `await import()` inside `beforeEach` instead.
 *
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
export default {
	testRunner: 'vitest',
	vitest: { configFile: 'vitest.config.ts' },
	coverageAnalysis: 'perTest',
	reporters: ['clear-text', 'progress', 'html'],
	/**
	 * 28 workers on a 32-thread box, and the number is measured rather than guessed — the `4` this
	 * replaced was a copy-paste that every repo on the platform carries. Same 2241 mutants, same machine:
	 *
	 *   concurrency 4  → 59m08s
	 *   concurrency 28 → 17m53s
	 *
	 * ⚠️ "It still scored 100" is **not** what justified the change, and must not be what justifies the
	 * next one. A starved worker misses a `waitFor` deadline, the test fails, and Stryker records the
	 * mutant as *killed* — overload inflates the score, so 100 at any concurrency is consistent with a
	 * gate that has quietly stopped checking. The score has no headroom to show it.
	 *
	 * What was compared instead is the timeout set, which is where load shows up first: both runs timed
	 * out on the same four mutants — `client.ts:51`, `Pagination.tsx:21` and the two at `router.tsx:107`
	 * — same files, same lines, same mutators. Identical, not merely equal in count.
	 *
	 * Re-measure that way before raising this again, and expect the run to swap: 28 jsdom workers cost
	 * ~570 MB each against 30 GB of RAM, and the 28-worker run sat at 12.7 GB of swap with 502 MB free.
	 * It was still 3.3x faster because swap here is a PCIe 5.0 NVMe, so this number does not travel to a
	 * machine whose swap is slower or whose RAM is busier.
	 */
	concurrency: 28,
	timeoutMS: 60000,
	thresholds: { high: 100, low: 95, break: 100 },
	// The sandbox is a file-by-file copy of the repo, and `copyFile` refuses a symlink that points at a
	// directory: `.claude/skills/*` are symlinks into `.agents/`, and the first one aborts the whole run
	// with `EISDIR` before a single mutant exists. None of these are inputs to a test anyway.
	//
	// `.qodana` was the one scan-output directory this list missed, and it is the largest at ~23 MB.
	// Copying it cost more than time: `disableTypeChecks: true` resolves to the glob
	// `**\/*.{js,ts,jsx,tsx,html,vue,mjs,mts,cts,cjs}` matched with `dot: true`, so it descends into
	// dotted directories, and every run logged a `ParseError` trying to strip `@ts-` directives out of
	// Qodana's own `thirdPartySoftwareList.html`. Stryker swallows that error and carries on, so the
	// gate stayed green while printing a stack trace nobody could act on.
	ignorePatterns: ['.agents', '.claude', '.qodana', 'coverage', 'dist'],
	mutate: [
		'src/**/*.{ts,tsx}',
		// graphql-codegen output: `graphql()` document maps and generated types. Mutating a generated
		// file tests the generator, and the mutants are unkillable by design — the document strings are
		// compared by identity, so flipping a character in one produces a document no test can send.
		'!src/gql/**',
		// `createRoot(document.getElementById('root')!).render(...)`. Excluded from coverage for the same
		// reason (see vitest.config.ts): it runs only against a real document, and the one thing it could
		// get wrong — mounting the wrong tree — is what every other test already covers.
		'!src/main.tsx',
		// A single `Sentry.init` call behind a DSN check. Every mutant of it is either equivalent (the
		// SDK ignores the option) or only observable by asserting the SDK was configured, which asserts
		// that the SDK exists.
		'!src/instrument.ts',
		// Ambient type declarations. No runtime, nothing to mutate.
		'!src/vite-env.d.ts'
	]
}
