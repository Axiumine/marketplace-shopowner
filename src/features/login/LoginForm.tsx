import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { useMutation } from 'urql'
import { z } from 'zod'

import { CTX_PUBLIC_AUTHORIZATION } from '@/api/endpoints'
import { messageOf } from '@/api/errors'
import { LoginDocument } from '@/api/operations/publicAuthorization/login'
import { setAccessToken } from '@/api/tokenStore'
import { setPendingEmail } from '@/auth/session'
import { Button } from '@/components/ui/Button'
import { PasswordField } from '@/components/ui/PasswordField'
import { TextField } from '@/components/ui/TextField'
import { Toast } from '@/components/ui/Toast'
import { Turnstile } from '@/components/ui/Turnstile'

import { useTurnstileToken } from './useTurnstileToken'

/**
 * Client-side validation is a courtesy, not a gate.
 *
 * No minimum length on the password: the rules that matter live in the backend, and telling a
 * shop owner their existing password is "too short" to even try would lock out anyone whose account
 * predates the current policy. The email check is a well-formedness check so an obvious typo does not
 * cost a round-trip.
 */
const loginSchema = z.object({
	email: z.email('Enter a valid email address'),
	password: z.string().min(1, 'Enter the password'),
	rememberMe: z.boolean()
})

type LoginValues = z.infer<typeof loginSchema>

/**
 * The login card.
 *
 * ⚠️ Nothing is pre-filled, and no credential may ever be. There is no build-time distinction to hide
 * behind: every `VITE_`-prefixed value is substituted into the client bundle statically, so a
 * "development only" default address and password ship to production in plain text.
 *
 * `rememberMe` is a real checkbox: it picks the server-side session cap the login stamps into the refresh
 * session — one day unchecked, thirty checked (E14-S05, E14-S07) — which every later refresh is measured
 * against. The cookie's own lifetime does not change with it, so pinning the box here would silently decide
 * how long an owner stays signed in without changing a single thing the browser can see.
 *
 * The Turnstile widget below the checkbox is the client half of the platform's login gate; the other
 * half is `guardPublicLogin` on the service, which also meters this page at twenty attempts an hour per
 * IP. With no site key configured the widget renders nothing and the form submits a `null` token, which
 * is the correct request for a deployment whose server holds no secret key either.
 */
export const LoginForm = () => {
	const navigate = useNavigate()
	const turnstile = useTurnstileToken()
	const [loginState, executeLogin] = useMutation(LoginDocument)

	// No `defaultValues`: all three fields are registered, uncontrolled inputs, so react-hook-form reads
	// their initial state off the DOM — `''` for the two text boxes and `false` for an unchecked box,
	// which is what the table would have said. Stating it twice only creates somewhere for the two to
	// disagree.
	const {
		register,
		handleSubmit,
		formState: { errors }
	} = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

	// `turnstile.read()` rather than the state value: a widget that solves itself between the click and
	// this line would otherwise be missed, and an expired token would be sent anyway.
	const onSubmit = handleSubmit(async (values) => {
		const result = await executeLogin({ ...values, turnstileToken: turnstile.read() }, CTX_PUBLIC_AUTHORIZATION)
		const accessToken = result.data?.login.accessToken

		if (accessToken !== undefined && accessToken !== '') {
			setAccessToken(accessToken)
			// The address is handed to `/loading` through the session module rather than the URL. This tier has
			// no "who am I" query — `marketplace-dev-authenticated-resource` exposes `shopOwnerCompanies` and
			// nothing else — so the form is the only place the owner's own address is ever known, and a query
			// string would put it in the browser history and in every referrer the app leaks.
			setPendingEmail(values.email)
			await navigate({ to: '/loading' })
		}
	})

	// An empty token with no error is the one case the backend cannot express: the mutation is typed
	// non-null, so a blank string means the service answered without minting a session. Reported as a
	// failed login: the alternative is a button that does nothing and says nothing.
	//
	// No `!fetching` or "has run at all" guard in front of it: urql resets a mutation's result to
	// `undefined` when it is executed again, so `data` is only ever the answer to a request that has
	// come back. Both guards would be true whenever the comparison is.
	const failed = loginState.data?.login.accessToken === ''

	return (
		<form
			className="flex w-full max-w-sm flex-col gap-4"
			onSubmit={(event) => {
				void onSubmit(event)
			}}
		>
			<div>
				<h2 className="text-xl font-bold">Login</h2>
				<p className="text-sm text-tip">Enter your credentials to sign in.</p>
			</div>

			<TextField
				label="Email"
				type="email"
				autoComplete="username"
				maxLength={50}
				error={errors.email?.message}
				{...register('email')}
			/>

			<PasswordField
				label="Password"
				autoComplete="current-password"
				maxLength={72}
				error={errors.password?.message}
				{...register('password')}
			/>

			<label className="flex items-center gap-2 text-sm">
				<input type="checkbox" {...register('rememberMe')} />
				Remember me on this device
			</label>

			<Turnstile onToken={turnstile.onToken} />

			{loginState.error === undefined ? null : <Toast tone="error">{messageOf(loginState.error)}</Toast>}
			{failed ? <Toast tone="error">Invalid credentials</Toast> : null}

			<Button type="submit" loading={loginState.fetching}>
				Sign in
			</Button>
		</form>
	)
}
