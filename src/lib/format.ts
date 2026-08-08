/**
 * Display formatting. English throughout, like every label on this platform.
 *
 * ⚠️ ISO strings are handed to `Date` directly, which is what an ISO-8601 timestamp is specified to
 * accept. Do not "improve" this into a hand-parse — splitting on `\D+` and rebuilding through
 * `Date.UTC` reads the timestamp as UTC and prints it in local time, so the date shifts by the offset
 * and a midnight value lands on the previous day.
 */

/** The placeholder for a field with nothing in it. */
export const NO_VALUE = '---'

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('en-GB', {
	day: 'numeric',
	month: 'long',
	year: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit'
})

/*
 * The three options are spelled out rather than inherited, even though `en-GB`'s own default is already
 * `dd/mm/yyyy` — which is exactly why the empty-object mutant here is equivalent and is the one place in
 * this repo that carries a disable. It was checked, not assumed: `{}` and this literal produce the same
 * string for every date the runtime can represent, from year 1 to year 275760 and on both sides of the
 * era boundary. Nothing this app can render distinguishes them, so no test can, and the literal stays
 * because the day the CLDR default moves is the day the owner's dates would silently change shape.
 */
// Stryker disable next-line ObjectLiteral: equivalent under en-GB — see the note above.
const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })

/*
 * UTC, unlike the two above, and the difference is not an oversight.
 *
 * `openingHours.from` / `.a` are not moments in time — they are clock readings the owner typed, which the
 * backend's `Time` scalar stamped onto an arbitrary calendar day at the offset they were sent with. The
 * app sends them as `HH:MM:00Z`, so reading them back in the browser's zone would print a foreign
 * shop's 11:30 opening as 13:30 in summer, and the edit box beside it — which is fed the UTC half —
 * would disagree with the value printed above it.
 */
/**
 * An unparseable timestamp renders as NO_VALUE rather than "Invalid Date". The backend types these
 * fields as non-null DateTime, so this branch should be unreachable — but a rendered "Invalid Date" in
 * an owner table is worse than a dash, and the check costs one comparison.
 */
export const formatDateTime = (iso: string): string => {
	const date = new Date(iso)
	return Number.isNaN(date.getTime()) ? NO_VALUE : DATE_TIME_FORMAT.format(date)
}

export const formatDate = (iso: string): string => {
	const date = new Date(iso)
	return Number.isNaN(date.getTime()) ? NO_VALUE : DATE_FORMAT.format(date)
}

/** A missing value renders as the placeholder, never as an empty cell or the string `null`. */
export const handleNull = (val: string | number | null | undefined): string => (val == null ? NO_VALUE : String(val))

/** As above, for a timestamp. */
export const handleNullDate = (val: string | null | undefined): string => (val == null ? NO_VALUE : formatDateTime(val))

/**
 * A reset hash is a secret-adjacent value, so only its first 20 characters are shown. Enough to
 * correlate with a log line, not enough to replay a reset link.
 */
export const handleNullHash = (val: string | null | undefined): string => (val == null ? NO_VALUE : `${val.substring(0, 20)}...`)

/**
 * Null and false both render "No". The fields this formats are absent-or-true on the backend, so a
 * missing value means the same thing as an explicit `false`; showing the placeholder instead would
 * turn "not set" into something an owner reads as broken data.
 */
export const handleNullBoolYN = (val: boolean | null | undefined): string => (val === true ? 'Yes' : 'No')

/**
 * A stored timestamp as `<input type="date">` needs it: `YYYY-MM-DD`, read in UTC.
 *
 * UTC and not local: `birth.date` is stored as midnight UTC, so a browser west of Greenwich would
 * seed the date box with the previous day — and, since react-hook-form compares against exactly this
 * value to decide what is dirty, the field would arrive already "edited" and be written back a day
 * earlier on every save that touched anything else in the same block.
 *
 * An unparseable value answers the empty string rather than the placeholder: this feeds a form control,
 * where `---` is not "nothing" but three characters the owner has to delete.
 */
export const toDateInput = (iso: string): string => {
	const date = new Date(iso)
	return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

/** As above for `<input type="time">`: the `HH:MM` half of a stored opening hour, in UTC. */
export const toTimeInput = (iso: string): string => {
	const date = new Date(iso)
	return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(11, 16)
}

/**
 * `HH:MM` from a time box, as the backend's `Time` scalar insists on receiving it.
 *
 * The `Z` is the whole point: graphql-scalars' `Time` **requires** a timezone designator and throws on
 * `11:30:00`, and without it the value would also be read at the server's offset rather than at the one
 * the rest of this file assumes.
 */
export const toTimeWire = (time: string): string => `${time}:00Z`

/**
 * `handleNull` in reverse: a cleared text box, as the wire wants it.
 *
 * An emptied optional field has to travel as `null`, never as `''`. Every collection on this platform
 * is validated with `additionalProperties: false` and `bsonType: 'string'`, so an empty string is a
 * *value* of the right type and gets written — a landline number of no digits, a unique code of no
 * characters — while `null` is what the services' validators turn into an absent key.
 */
export const emptyInNull = (value: string): string | null => (value === '' ? null : value)

/** `1 main street, 02109 Boston (MA)` */
export const formatAddress = (address: { street: string; postalCode: string; city: string; province: string }): string =>
	`${address.street}, ${address.postalCode} ${address.city} (${address.province})`
