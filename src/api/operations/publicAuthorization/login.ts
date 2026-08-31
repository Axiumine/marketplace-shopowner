import { graphql } from '@gql/publicAuthorization'

/**
 * The only operation this app sends to the public endpoint.
 *
 * `login` is the ShopOwner-tier sibling of `loginAdmin`: same arguments, same `LoginAppType`, a
 * different collection behind it and a different Redis session namespace. The two share one endpoint,
 * which is why the schema slice for this app carries only this one.
 *
 * ⚠️ `onboardingStep` and `onboardingDone` are selected here and **not** in the admin app, and that
 * asymmetry is the whole point of the two fields: they are ShopOwner concepts, `loginAdmin` hard-codes
 * them because the `admin` collection has no such fields, and this is the tier they mean something on.
 * `login` derives `onboardingStep` from `makeOnboardingData(user.login)` at sign-in.
 *
 * ⚠️ Both are nevertheless dead on arrival today, and the resolver is why: `login.mts` declares
 * `let onboardingStep = ''` / `let onboardingDone = false` outside its transaction, computes `step`
 * inside it, writes that into the Redis payload — and never assigns it back to either variable before
 * the `return`. So the mutation answers `''` and `false` for every shop owner regardless of state.
 * They are selected anyway so the document does not have to change when the resolver is fixed, but
 * **nothing in this app may branch on them until it is**.
 *
 * `rememberMe` chooses the session cap the server stamps into the refresh session at login — one day
 * unchecked, thirty checked — not the cookie's lifetime, which is the same either way.
 * The cap is fixed at that moment and enforced on every refresh, so it is a real checkbox on the login form
 * rather than a constant: pinning it here would silently decide how long an owner stays signed in.
 *
 * ⚠️ `turnstileToken` is nullable on both sides, and the gate still holds. The widget is disabled on a
 * machine with no `VITE_TURNSTILE_SITE_KEY`, so this variable is `null` on every developer box and in
 * every test; the server verifies a token only when it holds a secret key of its own, which is exactly
 * where the tokenless request gets refused. Sending `null` cannot weaken the gate — it can only fail to
 * help — so the variable is declared `String`, not `String!`.
 */
export const LoginDocument = graphql(`
	mutation Login($email: String!, $password: String!, $rememberMe: Boolean!, $turnstileToken: String) {
		login(email: $email, password: $password, rememberMe: $rememberMe, turnstileToken: $turnstileToken) {
			accessToken
			onboardingStep
			onboardingDone
		}
	}
`)
