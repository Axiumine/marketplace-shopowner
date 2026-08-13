import { useState } from 'react'

import { PageHeader } from '@/components/layout/PageHeader'
import { CompanyPicker, Items } from '@/features/items/Items'
import { SaveChanges, useDiscardWarning, useSaving } from '@/features/saving'

/**
 * The catalogue of one of the owner's shops.
 *
 * ⚠️ **The chosen shop is state, not a URL segment**, and that is a deliberate difference from the
 * operator app's habit of putting every id in the path. `companyItems` takes an `idCompany`, so a
 * `/items/$idCompany` route would be technically possible — and it would put an id a stranger can paste
 * into the one place this app has always kept free of them. The resolver refuses a shop the session does
 * not hold either way; what the URL decides is whether a wrong id is something an owner can be handed in
 * a link. It cannot be here.
 *
 * `key={`items-${idCompany}-${version}`}` does two jobs with one prop. The `version` half is the
 * companies page's: a successful save has to leave every card clean, and remounting the subtree reseeds
 * each react-hook-form from the data the save just invalidated. The `idCompany` half is this page's own —
 * a different shop is a different set of cards, and reusing the mounted ones would carry one shop's open
 * editors onto another's catalogue.
 *
 * The picker sits **outside** that key on purpose: remounting it after every save would drop the choice
 * and send the owner back to an empty page each time they pressed Save.
 */
export const ItemsPage = () => {
	const { register, saveAll, changed, version } = useSaving()
	const [idCompany, setIdCompany] = useState('')

	useDiscardWarning(changed)

	return (
		<>
			<PageHeader title="Items" crumbs={[{ name: 'Dashboard', to: '/home' }, { name: 'Items' }]} />
			<CompanyPicker idCompany={idCompany} locked={changed} onSelect={setIdCompany} />
			{idCompany === '' ? (
				<p className="mt-8 text-tip">Select a shop to see its items.</p>
			) : (
				<>
					<Items key={`items-${idCompany}-${version}`} idCompany={idCompany} registerSection={register} />
					<SaveChanges changed={changed} saveAll={saveAll} />
				</>
			)}
		</>
	)
}
