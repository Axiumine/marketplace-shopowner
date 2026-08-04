import { PageHeader } from '@/components/layout/PageHeader'
import { WigButton } from '@/features/dashboard/WigButton'

/**
 * The dashboard. One tile, because one section exists.
 *
 * There is no counter, chart or period breakdown on it, and that is a backend fact rather than a
 * design choice: `marketplace-dev-authenticated-resource` exposes a single query, `shopOwnerCompanies`,
 * with no aggregate anywhere. The operator app's tiles read `shopOwnersStats` and `shopOwnersPerPeriod`,
 * which have no ShopOwner-tier counterpart — inventing one client-side would mean counting an array
 * this page would have to fetch in full to say a number about.
 */
export const HomePage = () => (
	<>
		<PageHeader title="Dashboard" />
		<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<WigButton title="Companies" phrase="Manage your companies" to="/companies" />
		</div>
	</>
)
