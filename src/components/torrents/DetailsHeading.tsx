import type { ReactNode } from 'react'

// The small capitals heading of each part of the details, with room for a button at its end,
// as in qui.
export function DetailsHeading({ children, end }: { children: ReactNode; end?: ReactNode }) {
  return (
    <div className="mb-1.5 flex min-h-6 items-center justify-between gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</h3>
      {end}
    </div>
  )
}
