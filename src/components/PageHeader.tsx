import { use, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { HeaderSlot } from '@/components/HeaderSlot'
import { cn } from '@/lib/utils'

// The same title row on every page: the page name on the left, its main buttons on the right, and
// on wide screens anything given as `middle` between them.
export function PageHeader({ title, middle, middleWidth, actions, className, ref }: {
  title: ReactNode
  // Placed by the header: a function gets whether it went into the header bar.
  middle?: ReactNode | ((inHeader: boolean, centered: boolean) => ReactNode)
  // How wide `middle` needs to be. Below wide screens it goes into the header bar when that much
  // room is left between the title and the buttons.
  middleWidth?: number
  actions?: ReactNode
  className?: string
  ref?: Ref<HTMLDivElement>
}) {
  // Compact mode on a wide screen: the same row, a little tighter, inside the header bar.
  const slot = use(HeaderSlot)
  const row = useRef<HTMLDivElement | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const buttons = useRef<HTMLDivElement>(null)
  // When this page's buttons leave the title no room (on phones with the speeds shown, say), only
  // screen readers get it. Each page measures its own row, so a page with room keeps its title.
  const [crowded, setCrowded] = useState(false)
  // The room between the title and the buttons, for `middle`.
  const [free, setFree] = useState(0)
  // Whether `middle`, centred on the header bar, keeps clear of the title and the buttons. When it
  // wouldn't, it's centred in the room between them instead.
  const [centered, setCentered] = useState(true)
  useLayoutEffect(() => {
    const box = row.current
    const title = heading.current
    if (!box || !title || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const gap = parseFloat(getComputedStyle(box).columnGap) || 0
      // scrollWidth is the title's full width, even while it's hidden or cut short.
      const room = box.clientWidth - (buttons.current?.offsetWidth ?? 0) - 2 * gap
      setCrowded(title.scrollWidth > room)
      setFree(room - title.scrollWidth)
      const header = box.closest('header')?.getBoundingClientRect()
      // The room left between the title and the buttons, from the title's end.
      const start = title.getBoundingClientRect()
      const end = buttons.current?.getBoundingClientRect()
      if (header && middleWidth !== undefined) {
        const rtl = getComputedStyle(box).direction === 'rtl'
        const left = (rtl ? end?.right : start.right) ?? header.left
        const right = (rtl ? start.left : end?.left) ?? header.right
        const center = header.left + header.width / 2
        setCentered(center - middleWidth / 2 >= left + gap && center + middleWidth / 2 <= right - gap)
      }
    }
    // Again on the next frame, once the buttons have settled after a jump in the window's width.
    let frame = 0
    const remeasure = () => { measure(); cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    const observer = new ResizeObserver(remeasure)
    observer.observe(box)
    observer.observe(title)
    if (buttons.current) observer.observe(buttons.current)
    window.addEventListener('resize', remeasure)
    measure()
    return () => { observer.disconnect(); window.removeEventListener('resize', remeasure); cancelAnimationFrame(frame) }
  }, [slot, title, middleWidth])
  const setRow = (node: HTMLDivElement | null) => {
    row.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) (ref as { current: HTMLDivElement | null }).current = node
  }
  const inHeader = !!slot && (slot.whole || (middleWidth !== undefined && middleWidth <= free))
  const place = (inBar: boolean) => (typeof middle === 'function' ? middle(inBar, centered) : middle)
  if (slot) {
    // Compact mode: the row goes up into the header bar, a little tighter. Where `middle` doesn't fit
    // there it stays in the page, since it places itself (the selection bar above the screen's
    // bottom edge).
    return (
      <>
        {createPortal(
          // Tighter on phones, so the title keeps room beside the buttons.
          <div ref={setRow} className="flex min-w-0 flex-1 items-center gap-2 wide:gap-3">
            {/* Just the title: the header has no room for a line below it. */}
            <h2 ref={heading} className={cn('min-w-0 shrink truncate text-lg font-semibold leading-tight', crowded && 'sr-only')}>{title}</h2>
            <div className="flex min-w-0 flex-1 justify-center">{inHeader && place(true)}</div>
            {/* As close together as the buttons above the search results. */}
            {actions && <div ref={buttons} className="flex shrink-0 items-center gap-1">{actions}</div>}
          </div>,
          slot.element,
        )}
        {!inHeader && place(false)}
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
      {middle && <div className="flex min-w-0 narrow:contents wide:flex-1 wide:justify-center">{place(false)}</div>}
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  )
}
