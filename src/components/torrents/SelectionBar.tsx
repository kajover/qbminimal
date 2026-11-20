import { useLayoutEffect, useRef, type ReactNode } from 'react'
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
export function SelectionBar({ count, total, pinned, inHeader, onWidth, onPlace, onStart, onStop, onDelete, more }: {
  count: number
  // How many torrents match, of which `count` are selected.
  total: number
  // Actions pinned from the More menu, shown as icons.
  pinned: MenuEntry[]
  // In the header bar, or else above the bottom edge.
  inHeader: boolean
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
  useLayoutEffect(() => {
    const box = bar.current
    if (!box || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const style = getComputedStyle(box)
      const items = [...box.children] as HTMLElement[]
      const gaps = (parseFloat(style.columnGap) || 0) * Math.max(items.length - 1, 0)
      onWidth(Math.ceil(items.reduce((sum, item) => sum + item.offsetWidth, 0) + gaps + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)))
    }
    const observer = new ResizeObserver(measure)
    for (const item of box.children) observer.observe(item)
    measure()
    return () => observer.disconnect()
  })
  return (
    <div
      ref={bar}
      role="toolbar"
      aria-label={t('Selected torrents')}
      className={cn(
        'glass z-30 flex items-center overflow-x-auto',
        inHeader
          ? 'gap-2 rounded-xl p-0.5 md:absolute md:top-1/2 md:left-1/2 md:max-w-[calc(100vw-38rem)] md:-translate-1/2'
          // Spread over the bar, so all the buttons fit even a small phone.
          : 'glass-flat-phone justify-between fixed inset-x-3 bottom-[calc(var(--bottom-nav-height,4rem)+var(--selection-bar-gap,0.25rem))] mx-auto my-0 max-w-lg rounded-full p-1.5',
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
        <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={t('Start')} onClick={onStart}><Play className="size-4" /></Button>
      </Tooltip>
      <Tooltip label={t('Stop')}>
        <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={t('Stop')} onClick={onStop}><Pause className="size-4" /></Button>
      </Tooltip>
      {pinned.map(entry => {
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
