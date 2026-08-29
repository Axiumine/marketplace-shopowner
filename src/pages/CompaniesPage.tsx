import { PageHeader } from '@/components/layout/PageHeader'
import { Companies } from '@/features/companies/Companies'
import { SaveChanges, useDiscardWarning, useSaving } from '@/features/saving'

/**
 * The owner's companies.
 *
 * There is no id anywhere on this page — not in the path, not in a prop, not in the query variables.
 * The admin app reaches the same section through `/p/shopOwners/id/$_id`, because an admin has to
 * say *whose* companies they are looking at; here the answer is fixed by the Redis session the access
 * token names, so the route is a bare `/companies` and cannot be pointed at anyone else.
 *
 * `key={`companies-${version}`}` is what makes Save leave clean forms behind. Each card keeps its own
 * react-hook-form state, and a successful save has to reset every one of them to the values that were
 * just written — remounting the subtree does that in one move, where a per-card `reset()` would need the
 * section registry to hand each card its own new defaults.
 */
export const CompaniesPage = () => {
	const { register, saveAll, changed, version } = useSaving()

	useDiscardWarning(changed)

	return (
		<>
			<PageHeader title="Companies" crumbs={[{ name: 'Dashboard', to: '/home' }, { name: 'Companies' }]} />
			<Companies key={`companies-${version}`} registerSection={register} />
			<SaveChanges changed={changed} saveAll={saveAll} />
		</>
	)
}
