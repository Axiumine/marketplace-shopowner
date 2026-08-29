import type { LinkProps } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'

export interface Crumb {
	readonly name: string
	/**
	 * Absent for the current page — a breadcrumb that links to where you already are is noise. Typed as
	 * the router's own `to`, so a crumb pointing at a path no route serves fails to compile.
	 */
	readonly to?: NonNullable<LinkProps['to']>
}

/**
 * Title and breadcrumbs — the strip every page opens with.
 *
 * ⚠️ No `actions` slot, unlike the admin app's, where four pages hang a section menu off it. The two
 * pages here have nothing to put in one: the companies page's only control is "New company", and it
 * belongs beside the list it adds to rather than beside the page title. A slot no page fills is a branch
 * no test can reach except by rendering the component nothing renders — add it back the day a page needs
 * it, with that page's test.
 */
export const PageHeader = ({ title, crumbs = [] }: { title: string; crumbs?: readonly Crumb[] }) => (
	<header className="mb-6 flex flex-col gap-3 border-b border-tip pb-4">
		{crumbs.length === 0 ? null : (
			<nav aria-label="Path">
				<ol className="flex flex-wrap gap-2 text-xs text-tip">
					{crumbs.map((crumb) => (
						<li key={crumb.name} className="after:ml-2 after:content-['/'] last:after:content-['']">
							{crumb.to === undefined ? crumb.name : <Link to={crumb.to}>{crumb.name}</Link>}
						</li>
					))}
				</ol>
			</nav>
		)}

		<div className="flex flex-wrap items-center justify-between gap-4">
			<h1 className="text-2xl font-bold">{title}</h1>
		</div>
	</header>
)
