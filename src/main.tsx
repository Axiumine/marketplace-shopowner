import './instrument'
import './styles.css'

import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider as UrqlProvider } from 'urql'

import { createGraphQLClient } from '@/api/client'
import { clearSession } from '@/auth/session'
import { createAppRouter } from '@/router'

/**
 * The composition root, and the only file that wires the three independent pieces together: the urql
 * client, the router, and React.
 *
 * `./instrument` is imported first and for its side effect — Sentry has to install its handlers before
 * any application module runs, or the errors it exists to catch happen before it is listening.
 *
 * `onSessionLost` lives here because it is the one place that legitimately knows about both layers: the
 * API client raises it when a refresh cannot mint a token, and the answer is a trip back to the login
 * page. The client itself stays free of any router import.
 *
 * ⚠️ **That trip is a full page load, exactly as the logout button's is** (see `src/auth/useLogout.ts`).
 * A router navigation would leave the urql document cache behind, and the next owner to sign in inside
 * the same page load would be served the previous one's results — the reads that matter take no
 * variables, so their cache keys are identical across the two sessions. `clearSession` still runs first:
 * `assign` is asynchronous, and anything rendering between the call and the unload has to see a
 * signed-out app rather than an identity with no session behind it.
 */
const router = createAppRouter()

const client = createGraphQLClient({
	onSessionLost: () => {
		clearSession()
		window.location.assign('/')
	}
})

const container = document.getElementById('root')

if (container === null) throw new Error('#root element not found: index.html is not the expected one.')

createRoot(container).render(
	<StrictMode>
		<UrqlProvider value={client}>
			<RouterProvider router={router} />
		</UrqlProvider>
	</StrictMode>
)
