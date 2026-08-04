import type { ReactNode } from 'react'
import { useId } from 'react'

/**
 * The bordered card the detail page groups fields into.
 *
 * The tint arrives as a **class name**, never as an inline style string. The account states it encodes
 * — deleted, disabled, waiting for approval — are domain facts, so they are named utilities in
 * src/styles.css; a colour computed into a `style` prop puts the same fact in a component as an
 * unsearchable literal.
 *
 * `aria-labelledby` is what makes each card a landmark a screen reader can list and jump between. A
 * `<section>` with no accessible name is not a region at all — it is an anonymous `<div>` as far as
 * assistive technology is concerned, and the detail page is nine of them stacked.
 */
export const Infobox = ({
	title,
	className = '',
	actions,
	children
}: {
	title: string
	className?: string
	/**
	 * Controls that act on the card as a whole rather than on one of its rows — the plus that adds an
	 * opening hour is the only one so far. They sit on the title line, pushed right, because a card
	 * whose rows are a list has nowhere else to put "and one more".
	 */
	actions?: ReactNode
	children: ReactNode
}) => {
	const headingId = useId()

	return (
		<section
			aria-labelledby={headingId}
			className={`h-full overflow-hidden rounded-box border-4 border-third bg-white p-[10px] shadow ${className}`}
		>
			{/* The row is unconditional: with no actions the heading is its only child and `justify-between`
			    leaves it exactly where it was, so there is no branch here to leave half-tested. */}
			<div className="mb-2 flex items-center justify-between gap-2">
				<h3 id={headingId} className="font-bold">
					{title}
				</h3>
				{actions}
			</div>
			{children}
		</section>
	)
}

/** One `label → value` row. Every Infobox on the detail page is a stack of these. */
export const InfoRow = ({ label, value }: { label: string; value: ReactNode }) => (
	<div className="flex justify-between gap-4 border-b border-palette-bg1 py-1 text-sm last:border-b-0">
		<span className="text-tip">{label}</span>
		<span className="text-right">{value}</span>
	</div>
)
