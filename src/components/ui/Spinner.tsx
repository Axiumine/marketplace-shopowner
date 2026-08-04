/**
 * Indeterminate progress. `role="status"` with a visually-hidden label, so a screen reader announces
 * the wait instead of silence — and so tests can find it by role rather than by class name.
 */
export const Spinner = ({ label = 'Loading' }: { label?: string }) => (
	<span role="status" className="inline-flex items-center gap-2">
		<span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-third border-t-transparent" />
		<span className="sr-only">{label}</span>
	</span>
)
