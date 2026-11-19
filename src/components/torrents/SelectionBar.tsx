import type { ReactNode } from 'react'
import { Pause, Play, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import type { MenuEntry } from './bulkActions'
import { t } from '@/i18n'

// The bar of actions for the selected torrents. Phones: where a thumb reaches, just above the tab
// bar, or where the tab bar would be when it's off; on tablets as wide as the tab bar. The buttons
// sit at the end, Delete last. No margin from the page's spacing, which would lift it off the tab
// bar. Wide screens: in the header, in the middle of the window, so the list below doesn't move
// when a torrent is selected.
export function SelectionBar({ count, total, pinned, onClear, onStart, onStop, onDelete, more }: {
  count: number
  // How many torrents match, of which `count` are selected.
  total: number
  // Actions pinned from the More menu, shown as icons.
  pinned: MenuEntry[]
  onClear: () => void
  onStart: () => void
  onStop: () => void
  onDelete: () => void
  more: ReactNode
}) {
  return (
    <div
      role="toolbar"
      aria-label={t('Selected torrents')}
      className="glass glass-flat-phone z-30 flex items-center gap-1 overflow-x-auto max-md:fixed max-md:inset-x-3 max-md:mx-auto max-md:my-0 max-md:max-w-lg max-md:bottom-[calc(var(--bottom-nav-height,4rem)+var(--selection-bar-gap,0.25rem))] max-md:rounded-full max-md:p-1.5 max-md:px-2 md:absolute md:top-1/2 md:left-1/2 md:max-w-[calc(100vw-38rem)] md:-translate-1/2 md:rounded-xl md:p-0.5"
    >
      <Button variant="ghost" size="icon" className="size-8 shrink-0 rounded-full" aria-label={t('Clear selection')} title={t('Clear selection (Esc)')} onClick={onClear}>
        <X className="size-4" />
      </Button>
      <span className="pe-1 text-sm whitespace-nowrap tabular-nums">{t('{selected}/{total} selected', { selected: count, total })}</span>
      <Button variant="ghost" size="sm" className="gap-1 max-md:ms-auto" title={t('Start')} onClick={onStart}><Play className="size-4" /><span className="max-sm:sr-only">{t('Start')}</span></Button>
      <Button variant="ghost" size="sm" className="gap-1" title={t('Stop')} onClick={onStop}><Pause className="size-4" /><span className="max-sm:sr-only">{t('Stop')}</span></Button>
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
      <Button variant="ghost" size="sm" className="gap-1 text-destructive hover:text-destructive" title={t('Delete (Del)')} onClick={onDelete}><Trash2 className="size-4" /><span className="max-sm:sr-only">{t('Delete')}</span></Button>
    </div>
  )
}
