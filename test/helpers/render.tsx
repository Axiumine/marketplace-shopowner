import type { AnyRouter } from '@tanstack/react-router'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import type { RenderResult } from '@testing-library/react'
import { render, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { Provider as UrqlProvider } from 'urql'
import { vi } from 'vitest'

import { createGraphQLClient } from '@/api/client'
import { setAccessToken } from '@/api/tokenStore'
import type { ShopOwnerIdentity } from '@/auth/session'
import { setSession } from '@/auth/session'
import { createAppRouter } from '@/router'

export const OWNER: ShopOwnerIdentity = { email: 'owner@marketplace.it' }

export interface RenderOptions {
	/**
	 * Seeds the in-memory access token. Defaults to a value, because the interesting default is
	 * "signed in": with a null token urql's `willAuthError` fires a `Refresh` before every operation,
	 * which every test would then have to stub. Pass `null` to exercise that path on purpose.
	 */
	token?: string | null
	/** Seeds the signed-in identity. Pass `null` to hit the router's redirect guard. */
	session?: ShopOwnerIdentity | null
}

const DEFAULTS: Required<RenderOptions> = { token: 'tok-1', session: OWNER }

/** A client wired to a spy, so a test can assert the session was dropped rather than infer it. */
export const clientWithSpy = () => {
	const onSessionLost = vi.fn()
	return { client: createGraphQLClient({ onSessionLost }), onSessionLost }
}

/**
 * Renders a component that needs the urql client but no router — the `ui/` primitives and anything
 * built only from them.
 */
export const renderWithClient = (ui: ReactElement, options: RenderOptions = {}): RenderResult => {
	const { token, session } = { ...DEFAULTS, ...options }
	if (token !== null) setAccessToken(token)
	if (session !== null) setSession(session)

	const { client } = clientWithSpy()
	return render(<UrqlProvider value={client}>{ui}</UrqlProvider>)
}

export interface RouterRenderResult extends RenderResult {
	readonly router: AnyRouter
	readonly onSessionLost: ReturnType<typeof vi.fn>
}

/**
 * Renders the real route tree at a real URL.
 *
 * Pages are tested through the router rather than in isolation because the URL *is* their input:
 * `/loading` reads its `redirect` as a validated search param and the app route's guard reads the
 * session before any page mounts, so a page component mounted by hand is tested against props no
 * owner can produce.
 */
export const renderRoute = async (path: string, options: RenderOptions = {}): Promise<RouterRenderResult> => {
	const { token, session } = { ...DEFAULTS, ...options }
	if (token !== null) setAccessToken(token)
	if (session !== null) setSession(session)

	const { client, onSessionLost } = clientWithSpy()
	// The app's own factory, given a memory history — not a router assembled here out of the same parts.
	// A local `createRouter({ routeTree: createAppRouteTree() })` would test everything except the one
	// function `main.tsx` calls. The tree is rebuilt per render, not shared: `createAppRouteTree` is a
	// factory precisely so the route definitions are evaluated inside the test rather than at import time
	// (see the note on it in src/router.tsx), and a `Route` object also carries per-router state that must
	// not outlive one.
	const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))

	const result = render(
		<UrqlProvider value={client}>
			<RouterProvider router={router as never} />
		</UrqlProvider>
	)

	await waitFor(() => {
		expect(router.state.status).toBe('idle')
	})

	return { ...result, router, onSessionLost }
}
