import { PageHeader } from '@/components/layout/PageHeader'
import { CloseAccount } from '@/features/account/CloseAccount'

/**
 * The account page. One card, because one self-service mutation exists.
 *
 * ⚠️ **This is not a settings screen and must not grow into one by guesswork.**
 * `marketplace-dev-authenticated-resource` has no `shopOwnerUpdatePwd` and no self-service personal-data
 * mutation of any kind — the operator app's settings page changes a password through `adminUpdatePwd`,
 * which is the Admin tier's and has no counterpart here. A password field on this page would have
 * nowhere to submit. `shopOwnerDel` is the single exception, and it is why the page exists at all.
 *
 * No `useSaving` and no `SaveChanges` bar, unlike the other two domain pages: closing an account is not
 * a draft that is collected with other edits and written on Save. It is one press with its own
 * confirmation, and it ends the session it was pressed in.
 */
export const AccountPage = () => (
	<>
		<PageHeader title="Account" crumbs={[{ name: 'Dashboard', to: '/home' }, { name: 'Account' }]} />
		<CloseAccount />
	</>
)
