import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// The same title row on every page: the page name on the left, its main buttons on the right, and
// on wide screens anything given as `middle` between them.
export function PageHeader({ title, description, middle, actions, className }: { title: string; description?: ReactNode; middle?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-2', className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold leading-tight">{title}</h2>
        {description && <div className="text-sm text-muted-foreground">{description}</div>}
      </div>
      {/* On phones its content places itself (for example fixed above the tab bar), so the wrapper
          takes no room in the row. */}
      {middle && <div className="flex min-w-0 max-md:contents md:flex-1 md:justify-center">{middle}</div>}
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
