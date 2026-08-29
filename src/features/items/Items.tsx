import type { CompanyItemsQuery, ItemCategoriesQuery, ShopOwnerCompaniesQuery } from '@gql/shopOwnerResource/graphql'
import { zodResolver } from '@hookform/resolvers/zod'
import type { OperationContext } from '@urql/core'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery } from 'urql'
import { z } from 'zod'

import { CTX_SHOP_OWNER_RESOURCE } from '@/api/endpoints'
import { messageOf } from '@/api/errors'
import {
	ItemAddDocument,
	ItemDelDocument,
	ItemsUpdatePublishedDocument,
	ItemUpdateDocument,
	ItemUpdatePublishedDocument
} from '@/api/operations/shopOwnerResource/mutations'
import {
	CompanyItemsDocument,
	ItemCategoriesDocument,
	ShopOwnerCompaniesDocument
} from '@/api/operations/shopOwnerResource/queries'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { CheckboxField } from '@/components/ui/CheckboxField'
import { EditableRow } from '@/components/ui/EditableRow'
import { IconButton } from '@/components/ui/IconButton'
import { IconPlus, IconTrash } from '@/components/ui/icons'
import { Infobox } from '@/components/ui/Infobox'
import { SelectField } from '@/components/ui/SelectField'
import { Spinner } from '@/components/ui/Spinner'
import { TextareaField } from '@/components/ui/TextareaField'
import { TextField } from '@/components/ui/TextField'
import { Toast } from '@/components/ui/Toast'
import { ToastValidation } from '@/components/ui/ToastValidation'
import { required } from '@/lib/fields'
import { handleNull, handleNullBoolYN, NO_VALUE } from '@/lib/format'

import type { RegisterSection } from '../saving'
import { saveValidated, useSavableSection } from '../saving'

/*
 * From marketplace-db-setup/lib/schemas/item.js, by way of the service's own `GraphQLInputItem`.
 *
 * ⚠️ There is no price box on this form and none is missing. `item` carries no `price` field: cart,
 * order, delivery and payment have no model anywhere on this platform, so a price would be a guess at a
 * currency, a precision and a VAT treatment at once. Do not add one here ahead of that collection.
 */
const MAX_NAME = 150
const MAX_DESCRIPTION = 2000
const MIN_SLUG = 2
const MAX_SLUG = 160

/**
 * The URL segment's own grammar, copied from the collection validator rather than loosened for the
 * form: lowercase letters and digits in groups, joined by single hyphens, with no hyphen at either end.
 *
 * Checked here as well as there because the database's refusal arrives as a validation error naming a
 * field the owner cannot see, while this one arrives under the box they typed into.
 */
const SHAPE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** What separates a parent from its subcategory in one option's label. */
const CATEGORY_SEPARATOR = '/'

/**
 * One item, flat — the card is one form and one Save, exactly as the mutation is one `$set`.
 *
 * `idCategory` is a plain non-empty check and not an id shape: the picker only ever offers ids that came
 * back from `itemCategories`, and the empty string is the placeholder option — which is also what a
 * stored item falls back to when its category is no longer in the list, so this message is what an owner
 * sees when a category was retired under them.
 *
 * ⚠️ **`published` is not here, and that is the shape of the mutation.** It left `GraphQLInputItem` on
 * 2026-08-14: `itemUpdate` `$set`s the whole object, so a flag inside the form was written on every
 * save, and a card left open since before an admin took the item down republished it the next time
 * the owner fixed a typo. The button in the card's header is the only thing that writes it.
 */
export const itemSchema = z.object({
	name: required('Name', MAX_NAME),
	description: required('Description', MAX_DESCRIPTION),
	slug: z
		.string()
		.trim()
		.min(MIN_SLUG, `The slug is at least ${MIN_SLUG} characters`)
		.max(MAX_SLUG, `The slug cannot exceed ${MAX_SLUG} characters`)
		.regex(SHAPE_SLUG, 'The slug is lowercase letters and digits, joined by single hyphens'),
	idCategory: z.string().min(1, 'Category is required')
})

type ItemValues = z.infer<typeof itemSchema>

type Item = CompanyItemsQuery['companyItems'][number]

type Category = ItemCategoriesQuery['itemCategories'][number]

type Company = ShopOwnerCompaniesQuery['shopOwnerCompanies'][number]

/** One `<option>` of the category picker: the id it writes, and the name the owner reads. */
export interface CategoryOption {
	_id: string
	label: string
}

/**
 * The flat taxonomy as a picker reads it — each top-level category followed by its own subcategories.
 *
 * `itemCategories` answers sorted by `position` then `_id`, which orders the two levels *against each
 * other* rather than nesting them: a subcategory at position 1 arrives before a top-level category at
 * position 2, and the list reads as an alphabet soup. The tree is rebuilt here rather than asked for
 * nested, because the depth cap of two lives on the Admin tier and a recursive GraphQL type would
 * outlive it.
 *
 * ⚠️ A subcategory whose parent is not in the list is kept, at the end, under its bare name — it is
 * still a category an item points at, and dropping it from the picker would silently re-file every item
 * using it on the next save. That is a state the Admin tier can produce by retiring a parent, so it is
 * handled rather than assumed away.
 */
export const orderedCategories = (categories: readonly Category[]): readonly CategoryOption[] => {
	const tops = categories.filter((category) => category.idParent === null)
	const topIds = new Set(tops.map((top) => top._id))

	const nested = tops.flatMap((top) => [
		{ _id: top._id, label: top.name },
		...categories
			.filter((category) => category.idParent === top._id)
			.map((child) => ({ _id: child._id, label: `${top.name} ${CATEGORY_SEPARATOR} ${child.name}` }))
	])

	const orphans = categories
		.filter((category) => category.idParent !== null && !topIds.has(category.idParent))
		.map((orphan) => ({ _id: orphan._id, label: orphan.name }))

	return [...nested, ...orphans]
}

/** The picker's label for a stored id, or the placeholder when the category is no longer offered. */
export const labelOfCategory = (options: readonly CategoryOption[], idCategory: string): string =>
	handleNull(options.find((option) => option._id === idCategory)?.label)

/**
 * The save context: this endpoint, plus the typename the document cache has to be told about.
 *
 * Same arrangement as the companies page and for the same reason — `itemUpdate` and `itemDel` answer a
 * bare `Boolean!` and `itemAdd` an `OnlyIdType`, so no response here mentions `GraphQLItem` and the
 * cached list would survive every write untouched.
 *
 * One typename: `companyItems` is the only query on this page whose cached response carries an item.
 * `itemCategories` is not invalidated by anything this app can do — the taxonomy is the Admin tier's.
 */
const CTX_SAVE_ITEM: Partial<OperationContext> = Object.freeze({
	...CTX_SHOP_OWNER_RESOURCE,
	additionalTypenames: ['GraphQLItem']
})

/**
 * How many ids one `itemsUpdatePublished` call may carry.
 *
 * ⚠️ **The server's bound, mirrored — not this app's own idea of a sensible batch.** `itemsUpdatePublished`
 * answers 400 to a longer list, so a selection past this size is not slow here, it is refused there. Raise
 * it and the select-all breaks on exactly the large catalogue it exists for; the number moves in
 * `marketplace-dev-authenticated-resource/src/graphQLApi/schema/mutations/itemsUpdatePublished.mts` first.
 */
export const MAX_ITEMS_PER_CALL = 500

/**
 * The list in runs of at most `size`, in order, with no empty run at the end.
 *
 * A selection bigger than one call is several calls, and they are made one after another rather than at
 * once: each is a write of its own, and a shop taken down half-way is a state the owner has to be told
 * about honestly rather than a promise the client quietly retried.
 */
export const chunk = <T,>(list: readonly T[], size: number): T[][] => {
	const runs: T[][] = []

	for (let start = 0; start < list.length; start += size) runs.push(list.slice(start, start + size))

	return runs
}

/**
 * What a failed bulk write says, which depends on whether anything landed before it.
 *
 * ⚠️ **A run that fails does not undo the runs before it.** The ids travel in groups of
 * `MAX_ITEMS_PER_CALL` and each group is its own transaction, so a selection of 1200 that fails on the
 * third call has already changed 1000 items. Reporting a bare "it failed" over that would leave the owner
 * believing the shop is as it was, which is the one thing it is not — hence the count, and hence a
 * selection that is *kept* rather than cleared, so pressing the button again re-applies the same flag
 * over the same ids and finishes the job.
 */
export const bulkFailure = (done: number, total: number, reason: string): string =>
	done === 0 ? reason : `${reason} ${done} of ${total} items were changed before it stopped — press again to finish.`

/**
 * How many ids the runs before `index` carried — the count `bulkFailure` reports as already written.
 *
 * A function over the runs rather than a counter added up inside the loop, and that is a testability
 * decision with teeth: an accumulator is only ever non-zero on a selection past `MAX_ITEMS_PER_CALL`, so
 * every mutant of it would need a catalogue of five hundred and one rendered cards to be caught. Here the
 * same arithmetic is a pure function three assertions cover.
 *
 * Summed rather than `index * MAX_ITEMS_PER_CALL`, so it stays right for the last run, which is short.
 */
export const doneBefore = (runs: readonly (readonly string[])[], index: number): number =>
	runs.slice(0, index).reduce((total, run) => total + run.length, 0)

/** The refusal, when the server answers `false` with no error of its own to quote. */
export const BULK_REFUSED = 'The write was refused.'

/**
 * A blank card, for an item that does not exist yet.
 *
 * No `published` among them, and nothing missing: `itemAdd` stamps `false` on the server, so a new item
 * is a draft whatever the card holds — which is the only default that cannot publish something by
 * accident, and one the client can no longer get wrong.
 */
const NEW_VALUES: ItemValues = {
	name: '',
	description: '',
	slug: '',
	idCategory: ''
}

const dataOf = (item: Item, options: readonly CategoryOption[]): ItemValues => ({
	name: item.name,
	description: item.description,
	slug: item.slug,
	// The placeholder when the stored category is not among the options, so a taxonomy change is a
	// refused save the owner can fix rather than a silent re-filing under whichever option is first.
	idCategory: options.some((option) => option._id === item.idCategory) ? item.idCategory : ''
})

/**
 * What a card's boxes hold before anybody types: the item as stored, or a blank draft.
 *
 * ⚠️ Exported for its tests, like `orderedCategories` and `labelOfCategory` above, and for a reason those
 * two do not have: `NEW_VALUES` is a module constant, so it is built once when the module is imported and
 * a card rendered through the router cannot observe a change to it. Reached through here, inside a
 * `beforeEach` that re-imports the module, it can.
 */
export const valuesInitial = (item: Item | null, options: readonly CategoryOption[]): ItemValues =>
	item === null ? NEW_VALUES : dataOf(item, options)

/**
 * One item, editable — or one that does not exist yet.
 *
 * Deletion is queued rather than written on the spot and masked while it is, exactly as on a company
 * card: everything on this page waits for the one Save button, and a trash icon that wrote immediately
 * would be the only control here that did not.
 *
 * ⚠️ **The publish button is the exception, and writes on its own.** It has to: `published` is not in
 * `GraphQLInputItem` any more, so the page's Save cannot carry it, and `itemUpdatePublished` is a
 * mutation of its own on both tiers. It is also not the same kind of decision as fixing a description —
 * an owner publishes an item once and edits it a dozen times — so queueing it behind the same Save
 * would hide the one action here with a public consequence behind the one with none.
 */
const FormItem = ({
	item,
	cardKey,
	idCompany,
	options,
	registerSection,
	discard
}: {
	item: Item | null
	/** What the page's save registry files this card under: the item's `_id`, or a new card's own key. */
	cardKey: string
	/**
	 * The shop the card belongs to — the one whose catalogue is on screen, not a field of the item.
	 *
	 * ⚠️ `itemUpdate` reads `idCompany` out of the input and moves the item to that shop, so this value
	 * is a transfer instruction as much as an identifier. This screen does not offer transfers: it sends
	 * back the shop whose list the card was drawn in, which for a stored item is the shop it is already
	 * in. Wiring the picker to this prop would make every save of an open card a move.
	 */
	idCompany: string
	options: readonly CategoryOption[]
	registerSection: RegisterSection
	/** Removes a new card from the list — pressing its trash, and succeeding at saving it. */
	discard: (key: string) => void
}) => {
	const isNew = item === null

	const [error, setError] = useState<string | undefined>(undefined)
	const [deleted, setDeleted] = useState(false)
	const [, runAdd] = useMutation(ItemAddDocument)
	const [, runUpdate] = useMutation(ItemUpdateDocument)
	const [, runDel] = useMutation(ItemDelDocument)
	const [publishing, runPublish] = useMutation(ItemUpdatePublishedDocument)

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isDirty }
	} = useForm<ItemValues>({
		resolver: zodResolver(itemSchema),
		defaultValues: valuesInitial(item, options)
	})

	// A new card counts as a pending change from the moment it appears: it is an item the owner asked
	// for and the page has not written yet, so Save has to be live and leaving has to warn.
	const changed = isNew || isDirty || deleted

	/**
	 * The whole input both writes take. `values` is the resolver's output rather than what is in the
	 * boxes, so the trimmed strings are the ones that travel.
	 */
	const fieldsToSave = (values: ItemValues) => ({
		idCompany,
		idCategory: values.idCategory,
		name: values.name,
		description: values.description,
		slug: values.slug
	})

	/**
	 * Publishes the item, or withdraws it — one call, made now, on the flag the card no longer carries.
	 *
	 * The stored item is passed in rather than read from the prop: TypeScript drops the `item !== null`
	 * narrowing across a function boundary, and the button that calls this is rendered inside exactly
	 * that check.
	 *
	 * Nothing here holds the new value. `CTX_SAVE_ITEM` invalidates `GraphQLItem`, `companyItems` is
	 * refetched, and the label below is drawn from the answer — so what the button says is what the
	 * server stored, never what this card hoped it would.
	 */
	const publish = async (stored: Item) => {
		const outcome = await runPublish({ _id: stored._id, published: !stored.published }, CTX_SAVE_ITEM)

		if (outcome.data?.itemUpdatePublished !== true) {
			setError(outcome.error === undefined ? 'Publishing failed.' : messageOf(outcome.error))
			return
		}

		setError(undefined)
	}

	const add = async (values: ItemValues): Promise<boolean> => {
		const result = await runAdd({ item: fieldsToSave(values) }, CTX_SAVE_ITEM)

		// `itemAdd` answers `OnlyIdType`. Testing the `_id` and not the object keeps this honest if the
		// field ever goes nullable: an object is truthy even when everything inside it is missing.
		if (result.data?.itemAdd._id === undefined) {
			setError(result.error === undefined ? 'Save failed.' : messageOf(result.error))
			return false
		}

		// The card has done its job. `additionalTypenames` refetches the list, the stored item takes its
		// place, and a placeholder left behind would offer to add it a second time.
		discard(cardKey)

		return true
	}

	const save = async (): Promise<boolean> => {
		if (!changed) return true

		// Everything below reads `item._id`, and a new card has none: the add is the whole save.
		if (item === null) return await saveValidated(handleSubmit, add)

		// Deletion wins over the field edits: an item about to be withdrawn does not need its card
		// written first. A second delete of the same item answers 403 rather than `false`, and that
		// message is what the toast below shows.
		if (deleted) {
			const outcome = await runDel({ _id: item._id }, CTX_SAVE_ITEM)

			if (outcome.data?.itemDel !== true) {
				setError(outcome.error === undefined ? 'Deletion failed.' : messageOf(outcome.error))
				return false
			}

			return true
		}

		// Read out here rather than inside the closure below: TypeScript drops the `item !== null`
		// narrowing across a function boundary, since the prop is a binding it cannot prove was never
		// reassigned. A const carries it through.
		const _id = item._id

		const update = async (values: ItemValues): Promise<boolean> => {
			const result = await runUpdate({ _id, item: fieldsToSave(values) }, CTX_SAVE_ITEM)

			if (result.data?.itemUpdate !== true) {
				setError(result.error === undefined ? 'Save failed.' : messageOf(result.error))
				return false
			}

			reset(values)

			// The card's own toast, cleared by the save that fixed what it was about — see the company
			// card's copy of this line for why a page-level remount does not cover it.
			setError(undefined)

			return true
		}

		return await saveValidated(handleSubmit, update)
	}

	useSavableSection(cardKey, registerSection, changed, save)

	return (
		<section>
			<div className="mb-1 flex items-center justify-between gap-2">
				{/* The heading is the item's stored name, not what is in the box: it is what tells two cards
				    apart, and a heading that followed the keystrokes would rename the card the owner is
				    still deciding about. */}
				<h3 className={`text-lg font-bold ${deleted ? 'text-tip line-through' : ''}`}>
					{item === null ? 'New item' : item.name}
				</h3>
				<div className="flex items-center gap-2">
					{/* The state in words beside the button that changes it: on its own, a button reading
					    "Unpublish" asks the owner to infer the current state from the action offered, and
					    the two are read the wrong way round exactly when it matters. A new card says "No"
					    because an item that does not exist yet is published nowhere. */}
					<span className="text-sm text-tip">Published: {handleNullBoolYN(item?.published)}</span>
					{item === null ? null : (
						<Button
							variant={item.published ? 'ghost' : 'primary'}
							// Queued for withdrawal: publishing something about to be taken down is the one
							// combination of these two controls that contradicts itself, and the write would
							// land before the delete rather than instead of it.
							disabled={deleted}
							loading={publishing.fetching}
							onClick={() => {
								void publish(item)
							}}
						>
							{item.published ? 'Unpublish' : 'Publish'}
						</Button>
					)}
					<IconButton
						name={isNew ? 'Cancel new item' : deleted ? 'Cancel item deletion' : 'Delete item'}
						onClick={() => {
							// A card with nothing behind it is thrown away rather than queued: there is no
							// document to withdraw, and discarding it is also the only way out of the leave
							// guard it arms.
							if (isNew) discard(cardKey)
							else setDeleted((current) => !current)
						}}
					>
						<IconTrash />
					</IconButton>
				</div>
			</div>

			{error === undefined ? null : <Toast tone="error">{error}</Toast>}
			<ToastValidation errors={errors} />

			{/* `relative` so the mask below covers exactly the item's fields — the title row keeps its
			    trash, which is the only way back out of a queued deletion, and the toast above stays sharp
			    because a refused delete is reported through it. */}
			<div className="relative">
				<Infobox title="Item data">
					{/* `openInitial={isNew}` on every row, and `value` read through `?.`: a new item has
					    nothing stored, so each row opens on its editor and the closed value is never
					    rendered — the optional chain is there so the expression is evaluable. */}
					<EditableRow label="Name" value={item?.name} openInitial={isNew}>
						<TextField label="Name" maxLength={MAX_NAME} error={errors.name?.message} {...register('name')} />
					</EditableRow>
					<EditableRow label="Description" value={item?.description} openInitial={isNew}>
						<TextareaField
							label="Description"
							maxLength={MAX_DESCRIPTION}
							error={errors.description?.message}
							{...register('description')}
						/>
					</EditableRow>
					<EditableRow label="Slug" value={item?.slug} openInitial={isNew}>
						<TextField label="Slug" maxLength={MAX_SLUG} error={errors.slug?.message} {...register('slug')} />
					</EditableRow>
					<EditableRow
						label="Category"
						value={item === null ? NO_VALUE : labelOfCategory(options, item.idCategory)}
						openInitial={isNew}
					>
						<SelectField label="Category" error={errors.idCategory?.message} {...register('idCategory')}>
							{/* The empty option is not decoration: it is what a stored item falls back to when
							    its category has been retired, and picking it again is refused by the schema
							    rather than written as a blank id. */}
							<option value="">Select a category</option>
							{options.map((option) => (
								<option key={option._id} value={option._id}>
									{option.label}
								</option>
							))}
						</SelectField>
					</EditableRow>
					{/* No Published row. It would be a row of "Item data" that the Save button does not send,
					    which is the one thing every other row here promises. The flag lives in the header,
					    beside the control that writes it. */}
				</Infobox>

				{/* The mask — the company card's own, which this matches deliberately. */}
				{deleted ? (
					<div className="absolute inset-0 z-10 flex items-center justify-center rounded-box bg-palette-bg1/60 backdrop-blur-sm">
						<p className="rounded-box border border-third bg-white px-4 py-2 text-sm font-semibold text-third shadow">
							It will be withdrawn on save.
						</p>
					</div>
				) : null}
			</div>
		</section>
	)
}

/**
 * Select-all, and the two buttons that write the flag over everything ticked.
 *
 * ⚠️ **This is how an owner takes their whole shop down**, which is why it exists at all: the card's own
 * Publish button is one round trip per item, and a hundred of them means a shop that is half withdrawn
 * for as long as the clicking lasts. One gesture, one intent.
 *
 * The selection lives on the page rather than here — the checkboxes are down in the list, and a bar that
 * owned the set would be telling the cards what they are while reading it from nowhere. What *is* here is
 * the write: the mutation, the runs it is split into, and the one error line they share.
 *
 * ⚠️ **A card queued for deletion can still be ticked, and this writes the flag over it anyway.** The
 * queue is card-local state that no write has happened for yet; the flag is a write that happens now.
 * Publishing an item that is about to be withdrawn is harmless — Save withdraws it a moment later — and
 * the alternative, reaching into every card's state from up here, would tie the two controls together
 * for a case nobody meets.
 */
const BulkPublishBar = ({
	ids,
	selected,
	onSelected
}: {
	/** Every stored item on screen, in the order the list draws them. */
	ids: readonly string[]
	selected: readonly string[]
	onSelected: (next: readonly string[]) => void
}) => {
	const [error, setError] = useState<string | undefined>(undefined)
	const [bulk, runBulk] = useMutation(ItemsUpdatePublishedDocument)

	const allSelected = selected.length === ids.length

	/**
	 * Writes the flag over the selection, in runs of `MAX_ITEMS_PER_CALL`, stopping at the first refusal.
	 *
	 * Nothing here holds the new value: `CTX_SAVE_ITEM` invalidates `GraphQLItem`, the list is refetched,
	 * and every card's "Published" label is redrawn from what the server actually stored.
	 *
	 * The selection is cleared only on the way out of a clean run. Kept after a failure, on purpose —
	 * see `bulkFailure` for why the half-applied case is the one that needs it.
	 */
	const apply = async (published: boolean) => {
		const runs = chunk(selected, MAX_ITEMS_PER_CALL)

		for (const [index, run] of runs.entries()) {
			const outcome = await runBulk({ _ids: run, published }, CTX_SAVE_ITEM)

			if (outcome.data?.itemsUpdatePublished !== true) {
				const reason = outcome.error === undefined ? BULK_REFUSED : messageOf(outcome.error)

				setError(bulkFailure(doneBefore(runs, index), selected.length, reason))
				return
			}
		}

		setError(undefined)
		onSelected([])
	}

	return (
		<>
			<div className="mb-4 flex flex-wrap items-center gap-3 rounded-box border border-tip bg-white p-3">
				<CheckboxField
					label="Select all"
					checked={allSelected}
					onChange={() => {
						onSelected(allSelected ? [] : ids)
					}}
				/>
				{/* The count in words, because the two buttons act on a set the owner assembled by scrolling:
				    what is ticked off-screen is exactly what a bulk write is easy to be surprised by. */}
				<span className="text-sm text-tip">
					{selected.length} of {ids.length} selected
				</span>
				<div className="ml-auto flex gap-2">
					<Button
						disabled={selected.length === 0}
						loading={bulk.fetching}
						onClick={() => {
							void apply(true)
						}}
					>
						Publish selected
					</Button>
					<Button
						variant="ghost"
						disabled={selected.length === 0}
						loading={bulk.fetching}
						onClick={() => {
							void apply(false)
						}}
					>
						Unpublish selected
					</Button>
				</div>
			</div>

			{error === undefined ? null : <Toast tone="error">{error}</Toast>}
		</>
	)
}

/** The stored items of the chosen shop, plus whatever new cards the owner has open. */
const ListItems = ({
	items,
	idCompany,
	options,
	registerSection,
	newKeys,
	discard,
	selected,
	onToggle
}: {
	items: readonly Item[]
	idCompany: string
	options: readonly CategoryOption[]
	registerSection: RegisterSection
	newKeys: string[]
	discard: (key: string) => void
	selected: readonly string[]
	/** Ticks or unticks one stored item. */
	onToggle: (_id: string) => void
}) => {
	// "None" is about the catalogue, but it cannot be on screen under an open new card: the card is the
	// answer to it.
	if (items.length === 0 && newKeys.length === 0) return <p className="text-tip">No item in this shop.</p>

	return (
		<div className="flex flex-col gap-6">
			{/* The tick sits beside the card rather than inside its header, and that is a boundary rather
			    than a layout choice: the card is a form with a dirty state and a save of its own, while
			    the box is the page's — a new card has no id to select and gets none, which falls out of
			    this shape instead of needing a guard inside `FormItem`. */}
			{items.map((item) => (
				<div key={item._id} className="flex items-start gap-3">
					<div className="pt-1">
						<CheckboxField
							label={`Select ${item.name}`}
							hideLabel
							checked={selected.includes(item._id)}
							onChange={() => {
								onToggle(item._id)
							}}
						/>
					</div>
					<div className="grow">
						<FormItem
							cardKey={item._id}
							item={item}
							idCompany={idCompany}
							options={options}
							registerSection={registerSection}
							discard={discard}
						/>
					</div>
				</div>
			))}
			{/* New cards last, under the items that exist: the list is the record, and what is being added
			    to it belongs at the bottom rather than pushing the record down the page. */}
			{newKeys.map((cardKey) => (
				<FormItem
					key={cardKey}
					cardKey={cardKey}
					item={null}
					idCompany={idCompany}
					options={options}
					registerSection={registerSection}
					discard={discard}
				/>
			))}
		</div>
	)
}

/**
 * Which shop's catalogue is on screen.
 *
 * ⚠️ **The only place this app names something instead of letting the session name it.** Every other
 * operation on the ShopOwner tier is scoped by `ctx.state.user._id` alone; `companyItems` takes an
 * `idCompany`, because an owner may hold several shops and a catalogue is a per-shop screen. The
 * resolver refuses a shop the session does not hold, which is what keeps the choice from being a
 * boundary this select has to defend — the list it offers is the owner's own companies either way.
 *
 * Locked while anything on the page is dirty. Switching shop replaces every card at once, and the
 * discard guard cannot catch it: `useBlocker` sees navigations, and this is a `useState` on a page that
 * never moves.
 */
export const CompanyPicker = ({
	idCompany,
	locked,
	onSelect
}: {
	idCompany: string
	/** True while the page holds unsaved edits. */
	locked: boolean
	onSelect: (idCompany: string) => void
}) => {
	const [result] = useQuery({
		query: ShopOwnerCompaniesDocument,
		context: CTX_SHOP_OWNER_RESOURCE
	})

	const companies: readonly Company[] = result.data?.shopOwnerCompanies ?? []

	if (result.fetching) return <Spinner label="Loading shops" />

	if (result.error !== undefined) return <Alert tone="error">{messageOf(result.error)}</Alert>

	// Nothing to pick from, and nothing an item could be filed into either: `itemAdd` takes an
	// `idCompany` and there is none. The companies page is where that starts.
	if (companies.length === 0) return <Alert tone="info">Register a company first — an item belongs to one of your shops.</Alert>

	return (
		<div className="max-w-md">
			<SelectField
				label="Shop"
				value={idCompany}
				disabled={locked}
				onChange={(event) => {
					onSelect(event.target.value)
				}}
			>
				<option value="">Select a shop</option>
				{companies.map((company) => (
					<option key={company._id} value={company._id}>
						{company.legalName}
					</option>
				))}
			</SelectField>
			{locked ? <p className="mt-1 text-xs text-tip">Save or leave the page before changing shop.</p> : null}
		</div>
	)
}

/**
 * One shop's catalogue: a heading, the plus that adds an item, and the list.
 *
 * Both queries are issued here rather than inside the list so the heading and the plus survive all
 * three of their outcomes — an empty shop is exactly the one that needs the button, and a failed fetch
 * is no reason to take it away.
 *
 * The taxonomy is fetched beside the items because every card needs it twice over: to render the name
 * of the category an item is in, and to offer the ones it could move to. It is the same list for every
 * card and for every shop, so it is read once here and passed down.
 */
export const Items = ({ idCompany, registerSection }: { idCompany: string; registerSection: RegisterSection }) => {
	const [newKeys, setNewKeys] = useState<string[]>([])

	/*
	 * Which items the bulk buttons act on. Ids rather than the items themselves, so a refetch that
	 * replaces every object leaves the selection standing.
	 *
	 * Held here rather than in the bar or the cards because it is the one piece of state both halves of
	 * this screen read. It does not survive a shop change or a save: `ItemsPage` keys this subtree on
	 * `idCompany` and on the save counter, so both remount it — which is the right answer to a selection
	 * assembled over a list that no longer exists.
	 */
	const [selected, setSelected] = useState<readonly string[]>([])

	const [itemsResult] = useQuery({
		query: CompanyItemsDocument,
		variables: { idCompany },
		context: CTX_SHOP_OWNER_RESOURCE
	})

	const [categoriesResult] = useQuery({
		query: ItemCategoriesDocument,
		context: CTX_SHOP_OWNER_RESOURCE
	})

	const items = itemsResult.data?.companyItems ?? []
	const options = orderedCategories(categoriesResult.data?.itemCategories ?? [])

	// One failure line for two queries: either one missing leaves a page that cannot save anything, and
	// the items query is named first because it is the one an owner can do something about.
	const failure = itemsResult.error ?? categoriesResult.error

	return (
		<>
			<div className="mt-8 mb-2 flex items-center justify-between gap-2">
				<h2 className="text-lg font-bold">Items</h2>
				<IconButton
					name="Add item"
					// Nothing to file it under. `itemAdd` refuses a category that does not exist, so a card
					// opened here could never be saved — and the taxonomy is the admin's to fill in.
					disabled={options.length === 0}
					onClick={() => {
						setNewKeys((current) => [...current, crypto.randomUUID()])
					}}
				>
					<IconPlus />
				</IconButton>
			</div>

			{itemsResult.fetching || categoriesResult.fetching ? (
				<Spinner label="Loading items" />
			) : failure !== undefined ? (
				<Alert tone="error">{messageOf(failure)}</Alert>
			) : options.length === 0 ? (
				<Alert tone="info">No category exists yet. An admin has to fill in the taxonomy before an item can be filed.</Alert>
			) : (
				<>
					{/* Nothing to select, and nothing the two buttons could be pressed against: an empty shop
					    gets the list's own "No item in this shop." and no bar above it. */}
					{items.length === 0 ? null : (
						<BulkPublishBar ids={items.map((item) => item._id)} selected={selected} onSelected={setSelected} />
					)}
					<ListItems
						items={items}
						idCompany={idCompany}
						options={options}
						registerSection={registerSection}
						newKeys={newKeys}
						discard={(key) => {
							setNewKeys((current) => current.filter((open) => open !== key))
						}}
						selected={selected}
						onToggle={(_id) => {
							setSelected((current) => (current.includes(_id) ? current.filter((id) => id !== _id) : [...current, _id]))
						}}
					/>
				</>
			)}
		</>
	)
}
