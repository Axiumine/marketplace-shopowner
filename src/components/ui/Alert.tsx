import type { ReactNode } from 'react'

export type AlertTone = 'error' | 'success' | 'info'

const TONE_CLASS: Record<AlertTone, string> = {
	error: 'border-app-error bg-app-error/10 text-app-error',
	success: 'border-app-ok bg-app-ok/10 text-app-ok',
	info: 'border-third bg-secondary/40 text-palette-bg'
}

/**
 * `role="alert"` only for the error tone.
 *
 * `alert` is an assertive live region: it interrupts whatever a screen reader is saying. That is
 * right for a failed login and wrong for "saved", which is why the other tones use the polite
 * `status` role instead.
 */
export const Alert = ({ tone, children }: { tone: AlertTone; children: ReactNode }) => (
	<div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-box border px-4 py-3 text-sm ${TONE_CLASS[tone]}`}>
		{children}
	</div>
)
