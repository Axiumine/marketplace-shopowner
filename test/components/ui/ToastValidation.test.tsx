import { render, screen, within } from '@testing-library/react'
import type { FieldErrors } from 'react-hook-form'
import { describe, expect, it } from 'vitest'

import { ToastValidation, VALIDATION_HEADER } from '@/components/ui/ToastValidation'

/** See `formErrors.test.ts`: `FieldErrors` is the untyped error map, and an object literal needs the cast. */
const errors = (tree: Record<string, unknown>): FieldErrors => tree as unknown as FieldErrors

describe('ToastValidation', () => {
	// Nothing at all, not an empty toast: the admin has nothing to correct, and a box in the corner
	// saying so is one more thing to dismiss.
	it('is nothing when there is nothing to correct', () => {
		render(<ToastValidation errors={errors({})} />)

		expect(screen.queryByRole('alert')).not.toBeInTheDocument()
	})

	// One `<li>` per box, under a line that says what the list is — the messages themselves do not.
	it('lists what has to be corrected', () => {
		render(
			<ToastValidation
				errors={errors({
					firstName: { message: 'First name is required' },
					certifiedEmail: { message: 'The certified email is not a valid address' }
				})}
			/>
		)

		const warning = screen.getByRole('alert')
		// Spelled out rather than compared against the constant, which would pass whatever the constant
		// holds — the sentence is the requirement, not the export.
		expect(warning).toHaveTextContent('Fix these fields before saving:')
		expect(VALIDATION_HEADER).toBe('Fix these fields before saving:')
		expect(
			within(warning)
				.getAllByRole('listitem')
				.map((riga) => riga.textContent)
		).toEqual(['First name is required', 'The certified email is not a valid address'])
	})

	// `role="alert"` and not `status`: a refused save is assertive, and the tone is what carries that —
	// see `Toast`, which this leans on rather than reimplementing.
	it('is an error toast', () => {
		render(<ToastValidation errors={errors({ firstName: { message: 'First name is required' } })} />)

		expect(screen.getByRole('alert')).toHaveClass('border-app-error')
	})

	/*
	 * The whole point of deriving the list from `formState.errors` on every render rather than from a
	 * snapshot taken when Save was pressed: a corrected field takes its line with it, and the last one
	 * takes the toast.
	 */
	it('shrinks as the fields are corrected, and goes away with the last of them', () => {
		const { rerender } = render(
			<ToastValidation
				errors={errors({
					firstName: { message: 'First name is required' },
					certifiedEmail: { message: 'The certified email is not a valid address' }
				})}
			/>
		)

		expect(screen.getAllByRole('listitem')).toHaveLength(2)

		rerender(<ToastValidation errors={errors({ certifiedEmail: { message: 'The certified email is not a valid address' } })} />)

		expect(screen.getAllByRole('listitem').map((riga) => riga.textContent)).toEqual([
			'The certified email is not a valid address'
		])

		rerender(<ToastValidation errors={errors({})} />)

		expect(screen.queryByRole('alert')).not.toBeInTheDocument()
	})

	it('renders', () => {
		render(
			<ToastValidation
				errors={errors({
					firstName: { message: 'First name is required' },
					certifiedEmail: { message: 'The certified email is not a valid address' }
				})}
			/>
		)
		expect(screen.getByRole('alert')).toMatchSnapshot()
	})
})
