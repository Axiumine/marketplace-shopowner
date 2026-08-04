import { Outlet, useRouterState } from '@tanstack/react-router'

import { SideMenu } from '@/components/layout/SideMenu'

/**
 * The frame every authenticated page renders inside. Rendered by the pathless `app` route, so the
 * login and loading pages — which are outside it — get no sidebar.
 */
export const AppShell = () => {
	const pathname = useRouterState({ select: (state) => state.location.pathname })

	return (
		<div className="flex h-full">
			<SideMenu pathname={pathname} />
			<div className="flex min-w-0 flex-1 flex-col">
				<main className="flex-1 overflow-auto p-6">
					<Outlet />
				</main>
				<footer className="border-t border-tip px-6 py-3 text-xs text-tip">Marketplace — shop owner area</footer>
			</div>
		</div>
	)
}
