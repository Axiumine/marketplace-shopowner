import { LoginForm } from '@/features/login/LoginForm'

/**
 * The unauthenticated landing page.
 *
 * ⚠️ The note in the card is the **opposite** of the operator app's, and copying that one across would
 * have been a lie. The platform's recovery pair — `resetPwd` and `updatePwd` on public-resource — is
 * bound to the `ShopOwner` model (`createResetPwdFlow({ model: ShopOwner, … })` in
 * `marketplace-dev-public-resource/src/lib/access/resetPwdFlow.mts`), so it answers for exactly the
 * accounts that sign in here and for no other tier. Recovery is unavailable in *this app* only because
 * the screens are not built yet, not because the backend refuses it.
 *
 * Building it is a self-contained piece of work and deliberately not part of the first cut: it needs a
 * fifth endpoint (public-resource, port 4027), its own `schema/` slice, its own codegen project, a
 * `CTX_PUBLIC_RESOURCE`, a proxy entry, and two screens — request the link, then confirm it with the
 * hash from the email. The wording below is written so that adding them changes a paragraph, not a
 * promise the app has already made.
 */
export const LoginPage = () => (
	<div className="flex h-full items-center justify-center bg-palette-bg1 p-6">
		<div className="w-full max-w-sm rounded-box border-4 border-third bg-white p-6 shadow">
			<h1 className="mb-4 text-2xl font-bold">Marketplace — shop owner area</h1>
			<LoginForm />
			<p className="mt-6 text-xs text-tip">
				Password forgotten? Self-service recovery is not available from this screen yet: ask the platform operator to send you a
				reset link.
			</p>
		</div>
	</div>
)
