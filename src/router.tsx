import type { RouterHistory, SearchSchemaInput } from '@tanstack/react-router'
import { createBrowserHistory, createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router'
import { z } from 'zod'

import { getSession } from '@/auth/session'
import { AppShell } from '@/components/layout/AppShell'
import { AccountPage } from '@/pages/AccountPage'
import { CompaniesPage } from '@/pages/CompaniesPage'
import { HomePage } from '@/pages/HomePage'
import { ItemsPage } from '@/pages/ItemsPage'
import { LoadingPage } from '@/pages/LoadingPage'
import { LoginPage } from '@/pages/LoginPage'

/**
 * The route tree, written in code rather than generated from a `routes/` directory.
 *
 * File-based routing would emit a `routeTree.gen.ts` that is checked in, linted and type-checked. A
 * generated file cannot be tested, so it would have to be excluded from any coverage gate, and every
 * exclusion is a hole someone can later hide real code in. Five routes do not need a generator.
 *
 * It is a *factory* rather than a module-level constant, and that is a testing requirement rather than
 * a preference. Built at module scope, every path string, every `component:` reference and every search
 * default is evaluated once — when the module is first imported, before any test runs. Stryker's vitest
 * runner keeps its module registry between mutants, so none of that code re-executes for the mutant
 * under test and a route whose path was blanked keeps answering as though it had not been. Building the
 * tree inside a call puts all of it back under the test that asks for it.
 *
 * Called exactly once per router, from `createAppRouter` — which is the only caller anywhere, in the
 * app and in the tests alike, so the factory stays private to this module.
 */
const createAppRouteTree = () => {
	const loadingSearchSchema = z.object({
		/** Where to go once the session is restored. Validated at use — see `safeRedirect` in LoadingPage. */
		redirect: z.string().optional().catch(undefined)
	})

	/**
	 * `validateSearch` is given as a function taking `Record<string, unknown>`, not as the zod schema
	 * itself, and that is a type decision rather than a style one.
	 *
	 * TanStack Router works out which search params a `<Link>` is *required* to supply from the input
	 * type of `validateSearch`. Handing it the schema makes every key required at every call site — even
	 * though `redirect` is optional and the route is perfectly happy without it.
	 *
	 * The `& SearchSchemaInput` marker is how the router is told to read the parameter type as the
	 * *input* side and the return type as the output side, rather than inferring one from the other. The
	 * input is an index signature — "any query string is acceptable", which is what the `.catch()`
	 * guarantees — while the parsed output type stays fully specific.
	 */
	const validateLoadingSearch = (search: Record<string, unknown> & SearchSchemaInput): z.infer<typeof loadingSearchSchema> =>
		loadingSearchSchema.parse(search)

	// No `component`: a route without one renders an `<Outlet/>`, which is all the root has to do.
	const rootRoute = createRootRoute()

	const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: LoginPage })

	const loadingRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: '/loading',
		validateSearch: validateLoadingSearch,
		component: LoadingRoute
	})

	/**
	 * The authenticated frame. Pathless (`id`, not `path`), so `/home` stays `/home` while still
	 * rendering inside the sidebar layout, and so the guard below covers every page under it without
	 * repetition.
	 *
	 * The guard is a redirect to `/loading`, not to `/`. An empty session means one of two things — never
	 * signed in, or signed in and reloaded — and only `/loading` can tell them apart, because only a
	 * round-trip to the backend can say whether the httpOnly refresh cookie is still good.
	 */
	const appRoute = createRoute({
		getParentRoute: () => rootRoute,
		id: 'app',
		component: AppShell,
		beforeLoad: ({ location }) => {
			if (getSession() === null) throw redirect({ to: '/loading', search: { redirect: location.href } })
		}
	})

	const homeRoute = createRoute({ getParentRoute: () => appRoute, path: '/home', component: HomePage })

	/**
	 * The first domain route. No `$_id` segment and no search params: `shopOwnerCompanies` takes no
	 * arguments and the three writes take no owner id, so there is nothing about this page a URL could
	 * usefully carry. The admin app's equivalent is `/p/shopOwners/id/$_id`, and the missing parameter
	 * is the tenant boundary, not an omission.
	 */
	const companiesRoute = createRoute({ getParentRoute: () => appRoute, path: '/companies', component: CompaniesPage })

	/**
	 * The catalogue. Also parameterless, and this one had a choice: `companyItems` takes an `idCompany`,
	 * so `/items/$idCompany` would work. The shop is page state instead — see the note on `ItemsPage` —
	 * which keeps every id out of this app's URL space rather than most of them.
	 */
	const itemsRoute = createRoute({ getParentRoute: () => appRoute, path: '/items', component: ItemsPage })

	/**
	 * The owner's own account. Parameterless like the other two, and here the reason is not a habit:
	 * `shopOwnerDel` takes no argument at all, so there is no id this route could carry that the mutation
	 * would read. See the note on `CloseAccount`.
	 */
	const accountRoute = createRoute({ getParentRoute: () => appRoute, path: '/account', component: AccountPage })

	/*
	 * A function declaration, not an arrow constant, so it can be named in the route definition above
	 * while reading its own route's hooks below. It is the only place the URL is turned into props; the
	 * pages themselves stay pure and render from props alone.
	 */
	function LoadingRoute() {
		const { redirect: target } = loadingRoute.useSearch()
		return <LoadingPage redirect={target} />
	}

	return rootRoute.addChildren([
		loginRoute,
		loadingRoute,
		appRoute.addChildren([homeRoute, companiesRoute, itemsRoute, accountRoute])
	])
}

/**
 * The application router. Called once by `main.tsx`, and once per render by the test helper.
 *
 * `history` is a parameter so the tests go through this function rather than around it: they need a
 * memory history, and a router they built themselves would leave the one the app actually runs on
 * untested. Left out, the router picks the browser history, which is what production wants.
 */
export const createAppRouter = (history: RouterHistory = createBrowserHistory()) =>
	createRouter({ routeTree: createAppRouteTree(), history })

declare module '@tanstack/react-router' {
	interface Register {
		router: ReturnType<typeof createAppRouter>
	}
}
