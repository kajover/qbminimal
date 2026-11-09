import type { ReactNode } from 'react'

// The same title row on every page: the page name on the left, its main buttons on the right.
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold leading-tight">{title}</h2>
        {description && <div className="text-sm text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
