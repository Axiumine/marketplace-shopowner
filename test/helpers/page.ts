import type { BoundFunctions, queries } from '@testing-library/react'
import { screen, within } from '@testing-library/react'

/**
 * The page without the toast stack — everything the app shell renders, and nothing that floats over it.
 *
 * Needed because a refused save now says the same sentence twice: under the box that has to be fixed, and
 * again in the validation toast that lists every one of them. A bare `screen.getByText(message)` sees
 * both and throws "found multiple elements", which is a true statement about a page that is behaving
 * correctly.
 *
 * Scoping to `main` is what separates them: `Toast` portals into a stack appended straight to
 * `document.body`, so it is a sibling of the shell rather than a descendant of it.
 *
 * Returns the bound queries rather than one of them, so a call site picks its own — `findByText` while a
 * save is in flight, `getByText` for the second and third message of the same refusal, `queryByText` to
 * assert one is gone.
 */
export const page = (): BoundFunctions<typeof queries> => within(screen.getByRole('main'))
