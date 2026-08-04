import { graphql } from '@gql/publicAuthorization'

/**
 * The only operation this app sends to the public endpoint.
 *
 * `login` is the ShopOwner-tier sibling of `loginAdmin`: same arguments, same `LoginAppType`, a
 * different collection behind it and a different Redis session namespace. The two share one endpoint,
 * which is why the schema slice for this app carries only this one.
 *
 * ⚠️ `onboardingStep` and `onboardingDone` are selected here and **not** in the operator app, and that
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
 * `rememberMe` controls the lifetime of the refresh-token cookie on the server, so it is a real
 * checkbox on the login form rather than a constant — pinning it here would silently decide how long
 * an owner stays signed in.
 */
export const LoginDocument = graphql(`
	mutation Login($email: String!, $password: String!, $rememberMe: Boolean!) {
		login(email: $email, password: $password, rememberMe: $rememberMe) {
			accessToken
			onboardingStep
			onboardingDone
		}
	}
`)
