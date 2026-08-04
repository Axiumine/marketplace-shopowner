import type { ReactNode } from 'react'

import { Button } from '@/components/ui/Button'

interface FormSubmitProps {
	children: ReactNode
	/** The form's in-flight flag. Shows the spinner and blocks a second submit. */
	loading?: boolean
}

/**
 * The submit button of a form, and the row it sits on.
 *
 * Every form here ends the same way, so the ending is one component rather than three call sites that
 * drift: the button hugs its label, sits at the right edge of the form, and never stretches. That last
 * part is not decoration — `Button` is `inline-flex`, so as the child of a flex column it is stretched
 * to the container's width by `align-items: stretch`, and on a two-column form that is a metre of
 * button. Wrapped in a `justify-end` row it is the width of its text plus 30px on either side.
 *
 * `col-span-full` is on the row because the form it ends may be a grid: it puts the button under *both*
 * columns instead of at the bottom of the first. In a flex form the property does not apply and the
 * class is inert, so the same component fits either.
 */
export const FormSubmit = ({ children, loading = false }: FormSubmitProps) => (
	<div className="col-span-full flex justify-end">
		<Button type="submit" padding="form" loading={loading}>
			{children}
		</Button>
	</div>
)
