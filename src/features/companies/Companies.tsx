import type { ShopOwnerCompaniesQuery } from '@gql/shopOwnerResource/graphql'
import { zodResolver } from '@hookform/resolvers/zod'
import type { OperationContext } from '@urql/core'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useMutation, useQuery } from 'urql'
import { z } from 'zod'

import { CTX_SHOP_OWNER_RESOURCE } from '@/api/endpoints'
import { messageOf } from '@/api/errors'
import { CompanyAddDocument, CompanyDelDocument, CompanyUpdateDocument } from '@/api/operations/shopOwnerResource/mutations'
import { ShopOwnerCompaniesDocument } from '@/api/operations/shopOwnerResource/queries'
import { AddressField } from '@/components/ui/AddressField'
import { AddressMap } from '@/components/ui/AddressMap'
import { Alert } from '@/components/ui/Alert'
import { EditableRow } from '@/components/ui/EditableRow'
import { IconButton } from '@/components/ui/IconButton'
import { IconPlus, IconTrash } from '@/components/ui/icons'
import { Infobox } from '@/components/ui/Infobox'
import { Spinner } from '@/components/ui/Spinner'
import { TextField } from '@/components/ui/TextField'
import { Toast } from '@/components/ui/Toast'
import { ToastValidation } from '@/components/ui/ToastValidation'
import { addressError, composedAddress, coordinatesText, mapPoint } from '@/lib/address'
import { writeAddress } from '@/lib/addressForm'
import { ADDRESS_MESSAGE, coordinate, EMPTY_ADDRESS, required, SHAPE_EMAIL } from '@/lib/fields'
import { emptyInNull, formatAddress, handleNull } from '@/lib/format'
import type { FoundAddress } from '@/lib/nominatim'

import type { RegisterSection } from './saving'
import { saveValidated, useSavableSection } from './saving'

/*
 * From marketplace-db-setup/migrations/20260803000000-create-company.js, by way of the service's own
 * `validateCompany.mts`. They are the shop's embedded `company` bounds unchanged, with the two
 * differences that migration introduces: `registryExtract` was unbounded there and is capped here, and `taxCode` is
 * new.
 *
 * ⚠️ `MAX_ADDRESS` is **100**, as on a shop and not the 250 an shopOwner's own address
 * gets. Same field name, same GraphQL fragment, three different collections.
 */
const MAX_LEGAL_NAME = 100
const MAX_CONTACT_PERSON = 50
const MAX_ADMINISTRATOR = 50
const MAX_REGISTRY_EXTRACT = 1000
const MAX_EMAIL = 250
const MAX_ADDRESS = 100
const MAX_CITY = 100

/**
 * Exactly 11, and not the 16 of a personal codice fiscale: this is the company's, which for a legal
 * entity is the 11-digit form and usually equals its partita IVA. Optional, because no company stored
 * before the extraction carries one — the field did not exist.
 */
const TAX_CODE_LENGTH = 11

/** The SDI recipient code. Seven alphanumerics, or nothing at all. */
const UNIQUE_CODE_LENGTH = 7

/**
 * One company, flat — the card is one form and one Save, exactly as the mutation is one `$set`.
 *
 * `certifiedEmail` here is the company's certified address: required, and unique across the whole collection. The
 * shop card has a `certifiedEmail` of its own which is neither, and the two live on different forms precisely so
 * that flattening cannot write one into the other.
 */
export const companySchema = z
	.object({
		legalName: required('Legal name', MAX_LEGAL_NAME),
		vatNumber: z
			.string()
			.trim()
			.regex(/^\d{11}$/, 'The VAT number is 11 digits'),
		// Blank or the full length, with nothing in between and no format: the collection sets `minLength`
		// and `maxLength` and says nothing about the characters, so neither does this.
		taxCode: z
			.string()
			.trim()
			.refine((value) => value === '' || value.length === TAX_CODE_LENGTH, `The tax code is ${TAX_CODE_LENGTH} characters`),
		contactPerson: required('Contact person', MAX_CONTACT_PERSON),
		administrator: required('Administrator', MAX_ADMINISTRATOR),
		uniqueCode: z
			.string()
			.trim()
			.refine(
				(value) => value === '' || /^[A-Za-z0-9]{7}$/.test(value),
				`The unique code is ${UNIQUE_CODE_LENGTH} alphanumeric characters`
			),
		certifiedEmail: z.string().trim().regex(SHAPE_EMAIL, 'The certified email is not a valid address'),
		registryExtract: required('Registry extract', MAX_REGISTRY_EXTRACT),
		/**
		 * The whole address on one line, and the only part of it with a box of its own. Unvalidated by
		 * itself — it is text the owner may be halfway through typing — and checked instead by the rule
		 * at the bottom, which is the only place the six fields below and this one have to agree.
		 */
		addressComplete: z.string(),
		street: required('Street', MAX_ADDRESS),
		postalCode: z.string().regex(/^\d{5}$/, 'The postal code must be 5 digits'),
		city: required('City', MAX_CITY),
		province: z
			.string()
			.trim()
			.regex(/^[A-Za-z]{2}$/, 'The province is the 2-letter code')
			.transform((value) => value.toUpperCase()),
		longitude: coordinate('Longitude', 180),
		latitude: coordinate('Latitude', 90)
	})
	.refine((values) => values.addressComplete === formatAddress(values), {
		message: ADDRESS_MESSAGE,
		path: ['addressComplete']
	})

type CompanyValues = z.infer<typeof companySchema>

type Company = ShopOwnerCompaniesQuery['shopOwnerCompanies'][number]

/**
 * The save context: this endpoint, plus the typename the document cache has to be told about.
 *
 * urql's document cache invalidates a query when a mutation's *response* mentions one of the typenames
 * that query returned, and none of the three writes here mentions any — `companyUpdate` and `companyDel`
 * answer a bare `Boolean!`, and `companyAdd` answers an `OnlyIdType`, whose `_id` is not a
 * `GraphQLCompany`. Without this list every write would leave the list on screen exactly as it was.
 *
 * One typename, because `shopOwnerCompanies` is the only query on the page whose cached response carries
 * a `GraphQLCompany`. Add another the day a second query starts nesting one.
 */
const CTX_SAVE_COMPANY: Partial<OperationContext> = Object.freeze({
	...CTX_SHOP_OWNER_RESOURCE,
	additionalTypenames: ['GraphQLCompany']
})

/**
 * A blank card, for a company that does not exist yet.
 *
 * Every field is `''` and not absent, for the reason a blank card needs stating: an
 * `undefined` reaching the schema answers with zod's own "expected string, received undefined" instead
 * of this form's messages.
 */
const NEW_VALUES: CompanyValues = {
	legalName: '',
	vatNumber: '',
	taxCode: '',
	contactPerson: '',
	administrator: '',
	uniqueCode: '',
	certifiedEmail: '',
	registryExtract: '',
	...EMPTY_ADDRESS
}

const dataOf = (company: Company): CompanyValues => ({
	legalName: company.legalName,
	vatNumber: company.vatNumber,
	taxCode: company.taxCode ?? '',
	contactPerson: company.contactPerson,
	administrator: company.administrator,
	uniqueCode: company.uniqueCode ?? '',
	certifiedEmail: company.certifiedEmail,
	registryExtract: company.registryExtract,
	addressComplete: composedAddress(company.address),
	street: company.address.street,
	postalCode: company.address.postalCode,
	city: company.address.city,
	province: company.address.province,
	...coordinatesText(company.address.position.coordinates)
})

const valuesInitial = (company: Company | null): CompanyValues => (company === null ? NEW_VALUES : dataOf(company))

/** The one value `address.position.type` may hold — the model declares it as an enum of one. */
const POSITION_TYPE = 'Point'

/**
 * The `GraphQLInputCompany` the two writes share: `companyAdd` and `companyUpdate` take the same object,
 * and on this tier they differ only in whether the *other* argument is the company's `_id`.
 *
 * `taxCode` and `uniqueCode` go out as `null` when blank, which is how the service is told to drop them — the
 * collection is `additionalProperties: false` with `bsonType: 'string'`, so an empty string would be a
 * stored value and not an absent field.
 *
 * ⚠️ **`position.type` is sent, and on the Admin tier it must not be.** The two services disagree about
 * this one field and the disagreement is in the backends, not in the slices: the Admin tier's
 * `GraphQLInputCompanyPosition` declares `coordinates` alone and its `validateAddress` writes the
 * literal server-side, while this tier's spreads `GraphQLPositionFrag`, which makes `type: String!`
 * required — and nothing in `marketplace-dev-authenticated-resource` stamps it (the string `'Point'`
 * appears nowhere in that repo). So the client is the only place it can come from here.
 *
 * That is worth fixing in the service rather than living with, because it moves a value with exactly one
 * legal spelling onto the wire: `'point'` or `'POINT'` from any future client is a failed write against
 * the collection's enum, reported as a validation error naming a field the owner never saw. Until then
 * the literal belongs in one constant, not typed at the call site.
 */
const fieldsToSave = (values: CompanyValues) => ({
	legalName: values.legalName,
	vatNumber: values.vatNumber,
	taxCode: emptyInNull(values.taxCode),
	contactPerson: values.contactPerson,
	administrator: values.administrator,
	uniqueCode: emptyInNull(values.uniqueCode),
	certifiedEmail: values.certifiedEmail,
	address: {
		street: values.street,
		postalCode: values.postalCode,
		city: values.city,
		province: values.province,
		// Longitude first — the order GeoJSON stores and the order this form does not display.
		position: { type: POSITION_TYPE, coordinates: [Number(values.longitude), Number(values.latitude)] }
	},
	registryExtract: values.registryExtract
})

/**
 * The stored company's position, drawn under its address.
 *
 * A component of its own so that the two nulls are two decisions: the card says whether *a* map belongs
 * here at all — a company that does not exist yet has no seat to draw, and the editor's own map takes
 * over while it is open — and this says whether the pair the company carries is one a map can take.
 * Written as a single condition at the call site, the `company === null` half could not be falsified:
 * `position` is derived from that same `company`, so it was already null wherever that test would have
 * fired, and no test could tell the two halves apart.
 */
const MapCompany = ({ company }: { company: Company }) => {
	const position = mapPoint(company.address.position.coordinates)

	if (position === null) return null

	return (
		<div className="flex flex-col gap-2 pt-2">
			<AddressMap lat={position.lat} lon={position.lon} title={`Map of ${company.legalName}`} />
		</div>
	)
}

/**
 * One company, editable — or one that does not exist yet.
 *
 * The deletion is queued rather than written on the spot, and masked while it is: the card sits under
 * the page's one Save button, and a trash icon that wrote immediately would be the only control here
 * that did not wait for it.
 *
 * There is no ban icon. A company is not something the owner opens and closes, and there is nothing
 * on the collection to flip — `deleted` is stamped by `companyDel` and is not a state the card offers.
 *
 * Any refusal the backend does return arrives through the card's own error toast, which is why the toast
 * sits outside the mask.
 */
const FormCompany = ({
	company,
	cardKey,
	registerSection,
	discard
}: {
	company: Company | null
	/** What the page's save registry files this card under: the company's `_id`, or a new card's own key. */
	cardKey: string
	registerSection: RegisterSection
	/** Removes a new card from the list — pressing its trash, and succeeding at saving it. */
	discard: (key: string) => void
}) => {
	const isNew = company === null

	const [error, setError] = useState<string | undefined>(undefined)
	const [deleted, setDeleted] = useState(false)
	const [, runAdd] = useMutation(CompanyAddDocument)
	const [, runUpdate] = useMutation(CompanyUpdateDocument)
	const [, runDel] = useMutation(CompanyDelDocument)

	const {
		register,
		control,
		handleSubmit,
		setValue,
		trigger,
		reset,
		formState: { errors, isDirty }
	} = useForm<CompanyValues>({
		resolver: zodResolver(companySchema),
		defaultValues: valuesInitial(company)
	})

	/** While the address editor is on screen its own map takes over, and the stored one steps aside. */
	const [addressInChange, setAddressInChange] = useState(false)

	const position = company === null ? null : mapPoint(company.address.position.coordinates)

	/** A pick writes all seven boxes and revalidates them — see `writeAddress`, shared with both cards. */
	const applyAddress = (found: FoundAddress) => writeAddress(found, setValue, trigger)

	// A new card counts as a pending change from the moment it appears: it is a company the owner asked
	// for and the page has not written yet, so Save has to be live and leaving has to warn.
	const changed = isNew || isDirty || deleted

	/**
	 * The add, once the form has validated.
	 *
	 * `values` is the resolver's output and not what is in the boxes — see the personalData's `write`: the
	 * schema's `trim` and its upper-cased province are transforms, and this is the shape they produced.
	 */
	const add = async (values: CompanyValues): Promise<boolean> => {
		// No owner id in the variables, and there is nowhere to get one from: `companyAdd` on this tier takes
		// the company alone and stamps the owner from `ctx.state.user._id`, the Redis session behind the
		// access token. The Admin tier's mutation of the same name takes that id as its first argument, which
		// is the whole difference between an operator filing a company for someone and an owner filing their
		// own — and the reason a client-supplied id must never appear here.
		const result = await runAdd({ company: fieldsToSave(values) }, CTX_SAVE_COMPANY)

		// `companyAdd` answers `OnlyIdType`, where the Admin tier's answers `Boolean`. Testing the `_id` and
		// not the object keeps this honest if the field ever goes nullable: an object is truthy even when
		// everything inside it is missing.
		if (result.data?.companyAdd._id === undefined) {
			setError(result.error === undefined ? 'Save failed.' : messageOf(result.error))
			return false
		}

		// The card has done its job. `additionalTypenames` refetches the list, the stored company takes its
		// place, and a placeholder left behind would offer to add it a second time.
		discard(cardKey)

		return true
	}

	const save = async (): Promise<boolean> => {
		if (!changed) return true

		// Everything below reads `company._id`, and a new card has none: the add is the whole save.
		if (company === null) return await saveValidated(handleSubmit, add)

		// Deletion wins over the field edits: a company about to be removed does not need its card written
		// first. Unlike a shop's, this one is refused while anything still points at the company — the
		// message is the server's 409 and the card stays exactly as it was, still queued for deletion.
		if (deleted) {
			const outcome = await runDel({ _id: company._id }, CTX_SAVE_COMPANY)

			if (outcome.data?.companyDel !== true) {
				setError(outcome.error === undefined ? 'Deletion failed.' : messageOf(outcome.error))
				return false
			}

			return true
		}

		/*
		 * What is left is a field edit, with no `if (isDirty)` around it: `changed` is
		 * `new || isDirty || deleted`, the early return above rules out all three being false and the two
		 * branches above handle the other two, so `isDirty` is true by the time execution reaches here. The
		 * shop card does carry that test, because its own `changed` has a fourth term — the ban icon,
		 * which writes through a different mutation and leaves the form clean.
		 */

		// Read out here rather than inside the closure below: TypeScript drops the `company !== null`
		// narrowing across a function boundary, since the prop is a binding it cannot prove was never
		// reassigned. A const carries it through.
		const _id = company._id

		const update = async (values: CompanyValues): Promise<boolean> => {
			const result = await runUpdate({ _id, company: fieldsToSave(values) }, CTX_SAVE_COMPANY)

			if (result.data?.companyUpdate !== true) {
				setError(result.error === undefined ? 'Save failed.' : messageOf(result.error))
				return false
			}

			reset(values)

			// The card's own toast, cleared by the save that fixed what it was about. Not redundant with the
			// remount a save triggers: the page only puts itself back when *every* section succeeded, so a card
			// that has just been written while a later one failed stays mounted, and its stale refusal would sit
			// on screen beside the new one.
			setError(undefined)

			return true
		}

		return await saveValidated(handleSubmit, update)
	}

	useSavableSection(cardKey, registerSection, changed, save)

	return (
		<section>
			<div className="mb-1 flex items-center justify-between gap-2">
				{/* The heading is the ragione sociale, which is the company's name and the one thing that
				    identifies the card. It is edited from a row inside the box like every other field —
				    there is no pen up here, unlike a shop, whose insegna has no box of its own at all. */}
				<h3 className={`text-lg font-bold ${deleted ? 'text-tip line-through' : ''}`}>
					{company === null ? 'New company' : company.legalName}
				</h3>
				<IconButton
					name={isNew ? 'Cancel new company' : deleted ? 'Cancel company deletion' : 'Delete company'}
					onClick={() => {
						// A card with nothing behind it is thrown away rather than queued: there is no document
						// to delete, and discarding it is also the only way out of the leave guard it arms.
						if (isNew) discard(cardKey)
						else setDeleted((current) => !current)
					}}
				>
					<IconTrash />
				</IconButton>
			</div>

			{error === undefined ? null : <Toast tone="error">{error}</Toast>}
			<ToastValidation errors={errors} />

			{/* `relative` so the mask below covers exactly the company's information — the title row keeps
			    its trash, which is the only way back out of a queued deletion, and the toast above stays
			    sharp because a refused delete is reported through it. */}
			<div className="relative">
				<div className="grid gap-4 md:grid-cols-2">
					<Infobox title="Company data">
						{/* `openInitial={isNew}` on every row, and `value` read through `?.`: a new company has
						    nothing stored, so each row opens on its editor and the closed value is never
						    rendered — the optional chain is there so the expression is evaluable. */}
						<EditableRow label="Legal name" value={company?.legalName} openInitial={isNew}>
							<TextField
								label="Legal name"
								maxLength={MAX_LEGAL_NAME}
								error={errors.legalName?.message}
								{...register('legalName')}
							/>
						</EditableRow>
						<EditableRow label="VAT number" value={company?.vatNumber} openInitial={isNew}>
							<TextField
								label="VAT number"
								inputMode="numeric"
								maxLength={11}
								error={errors.vatNumber?.message}
								{...register('vatNumber')}
							/>
						</EditableRow>
						<EditableRow label="Tax code" value={handleNull(company?.taxCode)} openInitial={isNew}>
							<TextField label="Tax code" maxLength={TAX_CODE_LENGTH} error={errors.taxCode?.message} {...register('taxCode')} />
						</EditableRow>
						<EditableRow label="Contact person" value={company?.contactPerson} openInitial={isNew}>
							<TextField
								label="Contact person"
								maxLength={MAX_CONTACT_PERSON}
								error={errors.contactPerson?.message}
								{...register('contactPerson')}
							/>
						</EditableRow>
						<EditableRow label="Administrator" value={company?.administrator} openInitial={isNew}>
							<TextField
								label="Administrator"
								maxLength={MAX_ADMINISTRATOR}
								error={errors.administrator?.message}
								{...register('administrator')}
							/>
						</EditableRow>
						<EditableRow label="Unique code" value={handleNull(company?.uniqueCode)} openInitial={isNew}>
							<TextField
								label="Unique code"
								maxLength={UNIQUE_CODE_LENGTH}
								error={errors.uniqueCode?.message}
								{...register('uniqueCode')}
							/>
						</EditableRow>
						<EditableRow label="Certified email" value={company?.certifiedEmail} openInitial={isNew}>
							<TextField
								label="Certified email"
								type="email"
								maxLength={MAX_EMAIL}
								error={errors.certifiedEmail?.message}
								{...register('certifiedEmail')}
							/>
						</EditableRow>
						<EditableRow label="Registry extract" value={company?.registryExtract} openInitial={isNew}>
							<TextField
								label="Registry extract"
								maxLength={MAX_REGISTRY_EXTRACT}
								error={errors.registryExtract?.message}
								{...register('registryExtract')}
							/>
						</EditableRow>
					</Infobox>

					{/* The legal seat, and not the address of any of the company's shops — those have boxes of
					    their own further down the page. */}
					<Infobox title="Registered office">
						<EditableRow
							label="Address"
							value={company === null ? null : formatAddress(company.address)}
							openInitial={isNew}
							onOpen={() => {
								setAddressInChange(true)
							}}
						>
							{/*
							 * `Controller` and not `register` + `watch`, because this box is a controlled
							 * component and the two do not mix: `register` hands react-hook-form the input's DOM
							 * node, and the form then writes `ref.value` straight onto it on every `setValue`.
							 * The box was driven twice over — once by React through `value`, once by the form
							 * behind React's back — and the `value` prop could have been dropped entirely with
							 * nothing on screen changing. `Controller` keeps the ref out of it, so what the
							 * owner sees comes from one place.
							 */}
							<Controller
								control={control}
								name="addressComplete"
								render={({ field }) => (
									<AddressField
										label="Address"
										value={field.value}
										error={addressError(errors)}
										initialCenter={position}
										onSelect={applyAddress}
										name={field.name}
										onChange={field.onChange}
										onBlur={field.onBlur}
									/>
								)}
							/>
						</EditableRow>

						{/* Steps aside while the editor is open: `AddressField` brings a map of its own that
						    follows what is being typed, and two maps of two different places, stacked, is worse
						    than either. */}
						{addressInChange || company === null ? null : <MapCompany company={company} />}
					</Infobox>
				</div>

				{/* The mask — see the shop card's own, which this matches deliberately. */}
				{deleted ? (
					<div className="absolute inset-0 z-10 flex items-center justify-center rounded-box bg-palette-bg1/60 backdrop-blur-sm">
						<p className="rounded-box border border-third bg-white px-4 py-2 text-sm font-semibold text-third shadow">
							It will be deleted on save.
						</p>
					</div>
				) : null}
			</div>
		</section>
	)
}

/**
 * The stored companies, plus whatever new cards the owner has open.
 *
 * Each company is its own form and its own section of the page's save: one failing on a duplicate partita
 * IVA leaves the others' edits in the boxes, still dirty and still savable.
 */
const ListCompanies = ({
	companies,
	registerSection,
	newKeys,
	discard
}: {
	companies: readonly Company[]
	registerSection: RegisterSection
	newKeys: string[]
	discard: (key: string) => void
}) => {
	// "None registered" is about the collection, but it cannot be on screen under an open new card: the
	// card is the answer to it.
	if (companies.length === 0 && newKeys.length === 0) return <p className="text-tip">No company registered.</p>

	return (
		<div className="flex flex-col gap-6">
			{companies.map((company) => (
				<FormCompany
					key={company._id}
					cardKey={company._id}
					company={company}
					registerSection={registerSection}
					discard={discard}
				/>
			))}
			{/* New cards last, under the companies that exist: the list is the record, and what is being
			    added to it belongs at the bottom rather than pushing the record down the page. */}
			{newKeys.map((cardKey) => (
				<FormCompany key={cardKey} cardKey={cardKey} company={null} registerSection={registerSection} discard={discard} />
			))}
		</div>
	)
}

/**
 * The signed-in owner's companies: a heading, the plus that adds one, and the list.
 *
 * ⚠️ **Which companies these are is decided server-side and cannot be influenced from here.**
 * `shopOwnerCompanies` on this tier takes no arguments — the resolver filters on the owner in
 * `ctx.state.user._id` and on `deleted: { $exists: false }` — so there is no id to pass, no id to get
 * wrong, and no way for this app to ask for somebody else's. That is what the separate service pair buys:
 * the tenant boundary is the session, not a parameter the client fills in.
 *
 * The query is issued here rather than inside the list so the heading and the plus survive all three of
 * its outcomes: an owner with no companies yet is exactly who needs the button, and a failed fetch is no
 * reason to take it away.
 */
export const Companies = ({ registerSection }: { registerSection: RegisterSection }) => {
	const [newKeys, setNewKeys] = useState<string[]>([])

	const [result] = useQuery({
		query: ShopOwnerCompaniesDocument,
		context: CTX_SHOP_OWNER_RESOURCE
	})

	const companies = result.data?.shopOwnerCompanies ?? []

	return (
		<>
			<div className="mt-8 mb-2 flex items-center justify-between gap-2">
				<h2 className="text-lg font-bold">Companies</h2>
				<IconButton
					name="Add company"
					onClick={() => {
						setNewKeys((current) => [...current, crypto.randomUUID()])
					}}
				>
					<IconPlus />
				</IconButton>
			</div>

			{result.fetching ? (
				<Spinner label="Loading companies" />
			) : result.error !== undefined ? (
				<Alert tone="error">{messageOf(result.error)}</Alert>
			) : (
				<ListCompanies
					companies={companies}
					registerSection={registerSection}
					newKeys={newKeys}
					discard={(key) => {
						setNewKeys((current) => current.filter((open) => open !== key))
					}}
				/>
			)}
		</>
	)
}
