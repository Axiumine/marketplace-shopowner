/**
 * What a box looks like while the save is waiting on it, and what it looks like when it is not.
 *
 * One string each, and never both: `border` and `border-2` set one property, `bg-white` and
 * `bg-app-error/10` set another, so a field carrying both halves of either pair would be resolved by
 * stylesheet order rather than by its error. The call sites pick one of the two — they never append the
 * invalid half to the valid one.
 *
 * The tint is the same `bg-app-error/10` an error `Alert` is drawn on, and for the same reason it is a
 * tint at all: full `--color-app-error` is a red box with black text in it, which is a colour rather than
 * a message. What it adds to the doubled border is reach — the border is a pixel, and on a form of
 * thirteen fields the eye has to find *which* box the red line under the section belongs to.
 *
 * ⚠️ `disabled:bg-palette-bg1` on each of the three boxes still wins over both: the variant compiles to
 * `.disabled\:bg-palette-bg1:disabled`, which outranks a plain utility on specificity rather than racing
 * it through stylesheet order.
 *
 * Shared by `TextField`, `TextareaField` and `SelectField` because the three sit side by side in the same
 * grid: a select that disagreed with the input beside it by one shade would read as a different kind of
 * field, and three copies of a colour is how that happens.
 */
export const FIELD_VALID = 'border bg-white'

export const FIELD_TO_FIX = 'border-2 bg-app-error/10'
