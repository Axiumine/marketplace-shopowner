import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, expect } from 'vitest'

import { clearAccessToken } from '@/api/tokenStore'
import { clearSession } from '@/auth/session'

/** React's `useId` output, in both the `_r_1_` and the `«r1»` spelling. */
const GENERATED_ID = /_r_[0-9a-z]+_|«r[0-9a-z]+»/g

/** Attributes that hold one, either as the id itself or as a reference to it. */
const ID_ATTRS = ['id', 'for', 'aria-labelledby', 'aria-describedby', 'aria-controls']

/** Clones already rewritten, so the recursion into children does not clone the same subtree again. */
const normalised = new WeakSet<Element>()

const rewrite = (element: Element, stable: Map<string, string>): void => {
	normalised.add(element)

	for (const attribute of ID_ATTRS) {
		const value = element.getAttribute(attribute)
		if (value === null) continue

		element.setAttribute(
			attribute,
			value.replace(GENERATED_ID, (generated) => {
				const known = stable.get(generated)
				if (known !== undefined) return known

				const token = `:id-${String(stable.size)}:`
				stable.set(generated, token)
				return token
			})
		)
	}
}

/**
 * `useId` counts per test *file*, not per render, so its ids shift whenever a test is inserted above the
 * one that snapshots — `id="_r_2_"` becomes `id="_r_38_"` in a file nobody touched, and the diff says
 * nothing. What the snapshot is protecting is the *pairing* between an `id` and the `aria-labelledby`
 * pointing at it; the number itself carries no meaning. Both ends are renumbered from zero per snapshot,
 * so a broken pairing still shows up as a diff and an added test does not.
 */
expect.addSnapshotSerializer({
	test: (value: unknown) => value instanceof Element && !normalised.has(value),
	serialize: (value, config, indentation, depth, refs, printer) => {
		const clone = (value as Element).cloneNode(true) as Element
		const stable = new Map<string, string>()

		rewrite(clone, stable)
		for (const descendant of clone.querySelectorAll('*')) rewrite(descendant, stable)

		return printer(clone, config, indentation, depth, refs)
	}
})

// jsdom has no layout, so it answers every `scrollTo` with a "Not implemented" line on stderr. The
// router calls it on each navigation, which buries real failures under a dozen identical warnings.
window.scrollTo = () => {
	/* no layout to scroll in jsdom */
}

// The access token and the signed-in identity are module-scoped singletons — that is the point of
// them, and it means one test's login leaks into the next file's first render. Resetting both before
// every test makes "signed out" the default state a test has to opt out of.
beforeEach(() => {
	clearAccessToken()
	clearSession()
})

// Testing Library's auto-cleanup only fires when it detects a global `afterEach`, and it detects it
// through the test framework's globals. `globals: true` is set in vitest.config.ts, but registering
// the hook explicitly means a snapshot never picks up the previous test's DOM if that ever changes —
// a failure mode that shows up as one unrelated test's markup appearing inside another's snapshot.
afterEach(() => {
	cleanup()
})
