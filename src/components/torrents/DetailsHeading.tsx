import type { ReactNode } from 'react'

// The small capitals heading of each part of the details, with room for a button right after it
// (`after`) and at its end, as in qui.
// Without a title (where the tab's own name says it), only the buttons show, at the end.
export function DetailsHeading({ children, after, end }: { children?: ReactNode; after?: ReactNode; end?: ReactNode }) {
  return (
    // As tall as the small buttons that some headings carry, so every tab's headings line up.
    <div className="mb-1.5 flex min-h-7 items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        {children && <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</h3>}
        {after}
      </div>
      {end}
    </div>
  )
}
