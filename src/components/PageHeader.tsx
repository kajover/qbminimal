import { use, type ReactNode, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { HeaderSlot } from '@/components/HeaderSlot'
import { cn } from '@/lib/utils'

// The same title row on every page: the page name on the left, its main buttons on the right, and
// on wide screens anything given as `middle` between them.
export function PageHeader({ title, middle, actions, className, ref }: { title: ReactNode; middle?: ReactNode; actions?: ReactNode; className?: string; ref?: Ref<HTMLDivElement> }) {
  // Compact mode on a wide screen: the same row, a little tighter, inside the header bar.
  const slot = use(HeaderSlot)
  if (slot) {
    // Compact mode: the row goes up into the header bar, a little tighter. On phones `middle` stays
    // in the page, since it places itself (the selection bar sits above the screen's bottom edge).
    return (
      <>
        {createPortal(
          // Tighter on phones, so the title keeps room beside the buttons.
          <div ref={ref} className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
            {/* Just the title: the header has no room for a line below it. On phones showing the speeds
                there's no room for it at all, so only screen readers get it. */}
            <h2 className="min-w-0 shrink truncate text-lg font-semibold leading-tight max-sm:[:root[data-header-speeds=on]_&]:sr-only">{title}</h2>
            <div className="flex min-w-0 flex-1 justify-center">{slot.whole && middle}</div>
            {/* As close together as the buttons above the search results. */}
            {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
          </div>,
          slot.element,
        )}
        {!slot.whole && middle}
      </>
    )
  }
  return (
    <div ref={ref} className={cn('flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-2', className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold leading-tight">{title}</h2>
      </div>
      {/* On phones its content places itself (for example fixed above the tab bar), so the wrapper
          takes no room in the row. */}
      {middle && <div className="flex min-w-0 max-md:contents md:flex-1 md:justify-center">{middle}</div>}
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  )
}
