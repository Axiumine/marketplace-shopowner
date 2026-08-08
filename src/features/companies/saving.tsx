import { useBlocker } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { FieldValues, UseFormHandleSubmit } from 'react-hook-form'

import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'

/**
 * One savable block of the page — one company card.
 *
 * `save` answers whether the write went through, so the page can stop at the first failure instead of
 * firing the rest and leaving the owner with several half-applied cards and one error message.
 */
export interface SavableSection {
	/** True when the owner changed something inside this section. */
	changed: boolean
	save: () => Promise<boolean>
}

/** Registers a section, or forgets it — `null` means the section unmounted. */
export type RegisterSection = (id: string, section: SavableSection | null) => void

/**
 * The page-level registry behind the single Save button.
 *
 * It exists because each company card is its own form with its own mutation, while the owner gets one
 * button at the bottom for all of them — and because one card failing on a duplicate VAT number must
 * not discard what is in the others.
 * The button therefore has to reach forms it does not render, and the forms have to tell it whether
 * they are dirty.
 *
 * Deliberately a hook plus a prop, not a React context. Passing `register` down is one level of
 * drilling on this page, and a context needs either a `null` default whose "used outside the provider"
 * branch has to be tested through a thrown render, or a no-op default that turns a mis-wired section
 * into a Save button that silently saves nothing.
 *
 * The sections live in a ref rather than in state: their `save` closures change on every keystroke —
 * they read the form — and re-rendering the whole page for that would be a re-render per character.
 * Only the *set of dirty ids* is state, and `register` returns the previous set unchanged when nothing
 * moved, which is what keeps a section re-registering itself from looping.
 */
export const useSaving = () => {
	const sections = useRef(new Map<string, SavableSection>())
	const [changed, setChanged] = useState<ReadonlySet<string>>(() => new Set())
	/*
	 * How many times the page has been saved, and the key the caller remounts its sections with.
	 *
	 * A remount is the whole mechanism behind "after Save the page looks freshly loaded": every open
	 * `EditableRow` goes back to a value and a pen, every address editor folds away, every form re-seeds
	 * itself from the data the save just invalidated in the cache. ⚠️ It has to be a remount and cannot be
	 * a `close()` passed down — `EditableRow` deliberately has no way to close, because closing a row
	 * while react-hook-form still holds its edited value is how a page comes to display the server's
	 * value and save a different one (see the note on that component). Unmounting takes the form with the
	 * row, so there is no stale value left to disagree with.
	 */
	const [version, setVersion] = useState(0)

	/*
	 * Both functions are built once and keep their identity for the life of the page, which is what
	 * `useSavableSection` leans on: `register` sits in the dependency list of the effect that registers a
	 * section, so a fresh identity per render would re-register every section on every render — and since
	 * `register` can re-render the page, that is a loop.
	 *
	 * A lazy `useState` initialiser and not `useCallback(fn, [])`. The two behave identically, but an empty
	 * dependency list is a claim nothing can check: replace it with a list holding any constant and the
	 * behaviour is unchanged, so the one guarantee this hook has to make would be asserted nowhere.
	 */
	const [actions] = useState<{ register: RegisterSection; saveAll: () => Promise<boolean> }>(() => ({
		register: (id, section) => {
			if (section === null) sections.current.delete(id)
			else sections.current.set(id, section)

			setChanged((previous) => {
				const dirty = section?.changed === true

				if (previous.has(id) === dirty) return previous

				const next = new Set(previous)

				if (dirty) next.add(id)
				else next.delete(id)

				return next
			})
		},

		/**
		 * Saves every registered section, in registration order, stopping at the first refusal.
		 *
		 * Clean sections are asked too: each one decides which of its own writes to send, and a section with
		 * nothing to do answers true without a round-trip. Putting that decision here instead would need the
		 * registry to know which mutation covers which field.
		 */
		saveAll: async () => {
			for (const section of sections.current.values()) {
				if (!(await section.save())) return false
			}

			// Only a save that went through all the way bumps it — a page left half-written is a page the
			// owner still has edits on, and closing their rows would hide the values they would have to
			// retype.
			setVersion((number) => number + 1)

			return true
		}
	}))

	return { ...actions, changed: changed.size > 0, version }
}

/**
 * A section's write, run only if the form validates — and through `handleSubmit`, deliberately.
 *
 * ⚠️ **`trigger()` is not interchangeable with this and was what every section used to call.** It
 * validates and fills `formState.errors`, but it does *not* set `isSubmitted`, and `isSubmitted` is what
 * turns on react-hook-form's default `reValidateMode: 'onChange'`. Without it a field marked red by a
 * refused save stays red while it is being corrected, until the owner presses Save a second time to
 * find out whether they fixed it. `handleSubmit` sets the flag, after which each keystroke re-runs the
 * schema for that one field and clears its own error — which is the whole mechanism behind the red
 * background disappearing as the box becomes valid.
 *
 * The values handed to `write` are the **resolver's output**, not the raw form state: zod's transforms
 * have already run, so trimmed strings and the upper-cased province arrive here exactly as the old
 * `schema.parse(getValues())` produced them.
 *
 * `=== true` because `handleSubmit` resolves to `undefined` when the form is invalid — the handler is
 * never called — and `undefined` is also what a `void` handler would return, so the comparison is what
 * separates "refused" from "written".
 */
export const saveValidated = async <T extends FieldValues>(
	handleSubmit: UseFormHandleSubmit<T>,
	write: (values: T) => Promise<boolean>
): Promise<boolean> => (await handleSubmit(write)()) === true

/** What the owner is asked before an edit is thrown away. */
export const DISCARD_WARNING = 'There are unsaved changes. Do you really want to leave the page?'

/**
 * Asks before leaving a page that is holding unsaved edits.
 *
 * Nothing on the page is written until Save is pressed, which is the whole point of it — and the
 * cost of that is that everything typed is thrown away by a stray click on the breadcrumb. Thirteen
 * fields and several shops can be gone that way with nothing to undo it, since the edits never reached
 * the server to be re-read.
 *
 * `useBlocker` covers both exits at once: it blocks in-app navigation, and its `enableBeforeUnload`
 * defaults on, so a reload or a closed tab gets the browser's own prompt. That second one is left at
 * its default rather than passed explicitly — it is the behaviour we want and naming it would only
 * invite it to be turned off.
 *
 * `window.confirm` and not a modal of our own: this app has no dialog primitive, and the browser's is
 * the one thing that is guaranteed to be on screen before the navigation it is holding up.
 *
 * `disabled` is what keeps a clean page from asking. It must not be `shouldBlockFn` returning false
 * instead: the beforeunload listener is registered by the blocker's presence, so a blocker that is
 * installed and merely answers "no" still makes the browser prompt on every reload.
 *
 * ⚠️ Called from the page, not from `useSaving` — the hook is used in tests without a router
 * around it, and `useBlocker` reads the router context.
 */
export const useDiscardWarning = (changed: boolean) => {
	useBlocker({
		disabled: !changed,
		shouldBlockFn: () => !window.confirm(DISCARD_WARNING)
	})
}

/**
 * Keeps one section registered with the page for as long as it is mounted.
 *
 * `save` is kept in a ref and re-registered through a stable wrapper, so the registry is written to
 * only when the section's *dirtiness* flips — not on every keystroke, which is when the closure itself
 * changes. Without that indirection the effect would re-run per character and the page would re-render
 * with it.
 */
export const useSavableSection = (id: string, register: RegisterSection, changed: boolean, save: () => Promise<boolean>) => {
	const saveRef = useRef(save)

	useEffect(() => {
		saveRef.current = save
	})

	useEffect(() => {
		register(id, { changed, save: () => saveRef.current() })
	}, [id, register, changed])

	// Its own effect, with `changed` out of the dependencies: merged into the one above, the cleanup
	// would fire on every dirtiness flip and unregister the section a beat before it re-registers.
	useEffect(
		() => () => {
			register(id, null)
		},
		[id, register]
	)
}

/**
 * The page's one Save button.
 *
 * Disabled until something is dirty. The operator app's copy of this note blamed `shopOwnerUpdate`,
 * which answers 500 when its write matched a document and modified none — that mutation does not exist
 * on this tier and the reasoning does not carry over: `funCompanyUpdate` checks `matchedCount`, not
 * `modifiedCount`, so re-saving an untouched card is a plain 200 here. The guard stays because a save
 * that changes nothing still costs a round-trip per open card and still answers with a green
 * confirmation that claims something happened.
 *
 * The confirmation is shown for a save that succeeded *and* has not been superseded: the moment the
 * owner edits anything again the section goes dirty and the message goes away, so "Changes saved" can
 * never sit above a form holding unsaved changes.
 */
export const SaveChanges = ({ changed, saveAll }: { changed: boolean; saveAll: () => Promise<boolean> }) => {
	const [saving, setSaving] = useState(false)
	const [saved, setSaved] = useState(false)

	/*
	 * No clearing of `saved` on the way in, deliberately. Every save produces its own toast anyway, and
	 * `!changed` is what guarantees it: the button is dead unless something is dirty, so by the time a
	 * second save can be pressed the condition below has already gone false and unmounted the first
	 * confirmation — dismissed or not. A pre-clear here could only re-state that, and stated twice it
	 * became a line no test could prove wrong.
	 */
	const press = async () => {
		setSaving(true)

		const outcome = await saveAll()

		setSaving(false)
		setSaved(outcome)
	}

	return (
		<div className="mt-8 flex items-center justify-end gap-4">
			{saved && !changed ? <Toast tone="success">Changes saved.</Toast> : null}
			<Button
				padding="form"
				loading={saving}
				disabled={!changed}
				onClick={() => {
					void press()
				}}
			>
				Save
			</Button>
		</div>
	)
}
