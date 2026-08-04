import type { ReactNode } from 'react'
import { useState } from 'react'

import { IconButton } from './IconButton'
import { IconPen, IconTrash } from './icons'

/**
 * An `InfoRow` that turns into its own editor.
 *
 * The row starts read-only with a pen beside the value; pressing the pen swaps the value for whatever
 * `children` is — the registered input, or the two or three that make up one logical field. Nothing is
 * written here: the inputs belong to the section's form, and the page's Save button is what sends them.
 *
 * `onDelete` adds a bin next to the pen, for rows that are part of a list rather than fixed fields of
 * a document. It stays reachable once the row is open, which is the whole point: a row is usually
 * opened *before* the owner decides it should not exist.
 *
 * ⚠️ **The row never closes again, and that is deliberate.** A toggle would unmount the input the
 * moment the owner pressed the pen a second time, and react-hook-form keeps the value of an
 * unmounted field — so the row would go back to showing the *server's* value while the form still held
 * the edited one, and the save would write a value the page had stopped displaying. One-way is the
 * shape with no way to disagree with itself. To abandon an edit, leave the page.
 */
export const EditableRow = ({
	label,
	value,
	action,
	actionDelete,
	openInitial = false,
	onOpen = () => {},
	onDelete,
	children
}: {
	label: string
	value: ReactNode
	/**
	 * The pen's accessible name, when `Change ${label}` would not be unique. Opening hours are the
	 * case: a shop may open twice on the same day, so two rows carry the same visible label and the two
	 * pens would announce identically.
	 */
	action?: string
	/** The bin's accessible name, for the same reason and on the same rows. */
	actionDelete?: string
	/**
	 * Starts the row open. For a row that was just added: it has no stored value to display, so a closed
	 * one would read as an empty label beside an empty value and the owner would have to find the pen
	 * of a row that looks like a rendering bug.
	 */
	openInitial?: boolean
	/**
	 * Called the once, when the pen opens the row.
	 *
	 * For a card that shows something *beside* the row which the open editor duplicates — the shop's map,
	 * where the address editor brings a map of its own — and which therefore has to know the row is no
	 * longer closed. There is no matching `onClose`, because the row never closes again.
	 *
	 * Defaulted rather than optional-called, so there is no branch here for a caller that does not pass
	 * it: every row runs the same two statements and the empty function is the whole difference.
	 */
	onOpen?: () => void
	/** Given, a bin appears beside the pen. Rows of a fixed document leave it out and get no bin. */
	onDelete?: () => void
	children: ReactNode
}) => {
	const [open, setOpen] = useState(openInitial)

	const nameEdit = action ?? `Change ${label}`
	const nameDelete = actionDelete ?? `Delete ${label}`

	// Built once and rendered in whichever half is showing, so the bin is the same control before and
	// after the row is opened rather than two that happen to look alike.
	const trash =
		onDelete === undefined ? null : (
			<IconButton name={nameDelete} onClick={onDelete}>
				<IconTrash />
			</IconButton>
		)

	// The wrapper is unconditional. With no bin the growing child is the whole width, so a row without
	// one renders exactly as it did before — and there is no branch here to leave half-tested.
	if (open) {
		return (
			<div className="border-b border-palette-bg1 py-2 last:border-b-0">
				<div className="flex items-start gap-1">
					<div className="grow">{children}</div>
					{trash}
				</div>
			</div>
		)
	}

	return (
		<div className="flex items-center justify-between gap-4 border-b border-palette-bg1 py-1 text-sm last:border-b-0">
			<span className="text-tip">{label}</span>
			<span className="flex items-center gap-1 text-right">
				{value}
				<IconButton
					name={nameEdit}
					onClick={() => {
						setOpen(true)
						onOpen()
					}}
				>
					<IconPen />
				</IconButton>
				{trash}
			</span>
		</div>
	)
}
