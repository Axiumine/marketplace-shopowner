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
 * API client raises it when a refresh cannot mint a token, and the answer is a router navigation. The
 * client itself stays free of any router import.
 */
const router = createAppRouter()

const client = createGraphQLClient({
	onSessionLost: () => {
		clearSession()
		void router.navigate({ to: '/' })
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
