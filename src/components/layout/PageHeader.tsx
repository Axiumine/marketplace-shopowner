import type { LinkProps } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

export interface Crumb {
	readonly name: string
	/**
	 * Absent for the current page — a breadcrumb that links to where you already are is noise. Typed as
	 * the router's own `to`, so a crumb pointing at a path no route serves fails to compile.
	 */
	readonly to?: NonNullable<LinkProps['to']>
}

/**
 * Title, breadcrumbs and a slot for the section buttons — the strip every page opens with.
 */
export const PageHeader = ({
	title,
	crumbs = [],
	actions
}: {
	title: string
	crumbs?: readonly Crumb[]
	actions?: ReactNode
}) => (
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
			{actions === undefined ? null : <div className="flex gap-2">{actions}</div>}
		</div>
	</header>
)
