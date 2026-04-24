import { Fragment } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

interface Crumb {
  label: string
  href?: string
}

interface AdminBreadcrumbProps {
  crumbs: Crumb[]
  action?: React.ReactNode
}

export function AdminBreadcrumb({ crumbs, action }: AdminBreadcrumbProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
        {crumbs.map((crumb, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            )}
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="text-foreground font-medium">{crumb.label}</span>
            )}
          </Fragment>
        ))}
      </nav>
      {action && <div>{action}</div>}
    </div>
  )
}
