import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Pause, Play, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/tooltip'
import type { MenuEntry } from './bulkActions'
import { t } from '@/i18n'

// The bar of actions for the selected torrents. Phones: where a thumb reaches, just above the tab
// bar, or where the tab bar would be when it's off; on tablets as wide as the tab bar. The buttons
// sit at the end, Delete last. No margin from the page's spacing, which would lift it off the tab
// bar. In the header where it fits, as always on wide screens, in the middle of the window, so the
// list below doesn't move when a torrent is selected.
// A pinned action's button; the bar's gap comes on top.
const PINNED_BUTTON = 32

export function SelectionBar({ count, total, pinned, inHeader, centered = true, onWidth, onPlace, onStart, onStop, onDelete, more }: {
  count: number
  // How many torrents match, of which `count` are selected.
  total: number
  // Actions pinned from the More menu, shown as icons.
  pinned: MenuEntry[]
  // In the header bar, or else above the bottom edge.
  inHeader: boolean
  // In the header, centred on it; else, where that would cover the title or the buttons, centred
  // in the room between them. It never scrolls sideways: pinned actions that don't fit stay in More.
  centered?: boolean
  // How wide its buttons need it, so the header can tell whether it fits.
  onWidth: (width: number) => void
  // Told where it went, for the room the page keeps below it.
  onPlace: (inHeader: boolean) => void
  onStart: () => void
  onStop: () => void
  onDelete: () => void
  more: ReactNode
}) {
  useLayoutEffect(() => { onPlace(inHeader) }, [inHeader, onPlace])
  // Its buttons' own widths, which are the same wherever it sits, so the header's choice is stable.
  const bar = useRef<HTMLDivElement>(null)
  // Pinned actions that don't fit where it sits are left off (they're in More), so More and Delete
  // always stay in the bar rather than scrolling out of it. Each needs its button and some room.
  const withIcons = pinned.filter(entry => entry.icon)
  const [shown, setShown] = useState(withIcons.length)
  const visible = withIcons.slice(0, shown)
  useLayoutEffect(() => {
    const box = bar.current
    if (!box || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const style = getComputedStyle(box)
      const items = [...box.children] as HTMLElement[]
      const gaps = (parseFloat(style.columnGap) || 0) * Math.max(items.length - 1, 0)
      const drawn = Math.ceil(items.reduce((sum, item) => sum + item.offsetWidth, 0) + gaps + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight))
      // What it needs with every pinned action, whether shown or not, so where it goes doesn't
      // depend on how many fit there.
      const perAction = PINNED_BUTTON + (parseFloat(style.columnGap) || 0)
      const base = drawn - visible.length * perAction
      const needed = base + withIcons.length * perAction
      onWidth(needed)
      // In the header it may take the room between the title and the buttons; at the bottom, its own width.
      const room = inHeader ? box.parentElement?.clientWidth ?? 0 : box.clientWidth
      const fit = Math.max(0, Math.min(withIcons.length, Math.floor((room - base) / perAction)))
      if (fit !== shown) setShown(fit)
    }
    const observer = new ResizeObserver(measure)
    for (const item of box.children) observer.observe(item)
    observer.observe(box)
    if (box.parentElement) observer.observe(box.parentElement)
    measure()
    return () => observer.disconnect()
  })
  return (
    <div
      ref={bar}
      role="toolbar"
      aria-label={t('Selected torrents')}
      className={cn(
        'glass z-30 flex items-center',
        inHeader
          ? cn('gap-2 rounded-xl px-1.5 py-0.5', centered ? 'wide:absolute wide:top-1/2 wide:left-1/2 wide:max-w-[calc(100vw-38rem)] wide:-translate-1/2' : 'max-w-full')
          // The count at the start and the buttons together at the end, spaced as on wide screens.
          : 'gap-2 fixed inset-x-3 bottom-[calc(var(--bottom-nav-height,4rem)+var(--selection-bar-gap,0.25rem))] mx-auto my-0 max-w-lg rounded-full p-1.5',
      )}
    >
      {/* Just the number, the same in every language and styled like the progress percentage; the
          words are its hover text and for screen readers. Its end padding matches the room inside
          an icon button, so it sits as far from Start as the buttons from each other. */}
      <span className="ps-2 pe-2 text-xs whitespace-nowrap text-muted-foreground tabular-nums" title={t('{selected}/{total} selected', { selected: count, total })}>
        <span aria-hidden>{count}</span>
        <span className="sr-only">{t('{selected}/{total} selected', { selected: count, total })}</span>
      </span>
      {/* Icons only, like the other buttons, so the bar is as wide in every language. */}
      <Tooltip label={t('Start')}>
        <Button variant="ghost" size="icon" className={cn('size-8 shrink-0', !inHeader && 'ms-auto')} aria-label={t('Start')} onClick={onStart}><Play className="size-4" /></Button>
      </Tooltip>
      <Tooltip label={t('Stop')}>
        <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={t('Stop')} onClick={onStop}><Pause className="size-4" /></Button>
      </Tooltip>
      {visible.map(entry => {
        const Icon = entry.icon
        return Icon && (
          <Tooltip key={entry.id} label={entry.label}>
            <Button variant={entry.pressed || entry.checked ? 'secondary' : 'ghost'} size="icon" className="size-8 shrink-0" aria-label={entry.label} aria-pressed={entry.pressed ?? entry.checked} onClick={entry.onSelect}>
              <Icon className="size-4" />
            </Button>
          </Tooltip>
        )
      })}
      {more}
      <Tooltip label={t('Delete (Del)')}>
        <Button variant="ghost" size="icon" className="size-8 shrink-0 text-destructive hover:text-destructive" aria-label={t('Delete')} onClick={onDelete}><Trash2 className="size-4" /></Button>
      </Tooltip>
    </div>
  )
}
