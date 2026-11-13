import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type PointerEvent, type ReactElement, type ReactNode } from 'react'
import { textScale } from '@/lib/textSize'
import { ArrowDown, ArrowUp, RotateCcw } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { ContextMenu, ContextMenuCheckboxItem, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import { formatBytes, formatDateTime, formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'
import { columnWidth, DEFAULT_COLUMN_LAYOUT, getColumn, toggleColumn, moveColumn, resizeColumn, shiftColumn, trackerHost, visibleColumns, type ColumnId, type ColumnLayout } from '@/lib/torrentColumns'
import { DOWN_SPEED_COLOR, formatEta, getStateBadge, getStateLabel, ratioColor, UP_SPEED_COLOR, peerPair as pair } from '@/lib/torrentState'
import type { SortDirection } from '@/lib/listSettings'
import type { RowProps } from '@/hooks/useRowPress'
import type { Torrent } from '@/types'
import { useTransferInfo } from '@/hooks/useApi'
import { BottomScrollbar } from './BottomScrollbar'
import { ColumnFilterButton, type FilterTarget } from '@/components/ColumnFilters'
import type { ColumnFilter, ColumnFilters } from '@/lib/columnFilters'
import { t } from '@/i18n'

const SELECT_WIDTH = 40
// Where the browser can, the column titles follow the rows sideways through a scroll timeline,
// which moves them in the same frame as the rows. Otherwise they're scrolled to match on each
// scroll event, which can trail a frame behind.
const LINKED_SCROLL = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('animation-timeline: --a') && CSS.supports('timeline-scope: --a')

// The checkbox stays in view while the other columns scroll sideways. Its background has to be
// solid, so it mixes the row's hover tint into the card color.
// Columns of words, which follow the language's direction; all others are numbers or paths.
const WORD_COLUMNS: ReadonlySet<ColumnId> = new Set(['name', 'state', 'category', 'tags'])

const PINNED_LEFT = 'sticky start-0 z-10 bg-card transition-colors group-hover:bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))]'
const PINNED_SELECTED = 'bg-muted group-hover:bg-muted'

// A dash in place of a speed of zero, so the moving torrents stand out.
const speed = (bytes: number, color: string) => (bytes > 0 ? <span className={color}>{formatBytes(bytes)}/s</span> : <span className="text-muted-foreground/60">-</span>)
const limit = (bytes: number) => (bytes > 0 ? `${formatBytes(bytes)}/s` : '∞')

function Cell({ torrent, id }: { torrent: Torrent; id: ColumnId }): ReactNode {
  switch (id) {
    case 'name': return <span title={torrent.name}>{torrent.name}</span>
    case 'size': return formatBytes(torrent.size)
    case 'progress': {
      // Whole percents, rounded down so only a finished torrent reads 100%.
      const percent = Math.floor(torrent.progress * 100)
      return (
        <div className="flex items-center gap-2">
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-primary" style={{ width: `${torrent.progress * 100}%` }} />
          </div>
          <span className="w-9 shrink-0 text-xs text-muted-foreground">{percent}%</span>
        </div>
      )
    }
    case 'state':
      return (
        // Inline, so its text sits on the same line as the text in the other columns; the cell cuts
        // off a label too long for it.
        <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', getStateBadge(torrent.state, torrent.completion_on))} title={torrent.error || undefined}>
          {getStateLabel(torrent.state, torrent.completion_on)}
        </span>
      )
    case 'num_seeds': return pair(torrent.num_seeds, torrent.num_complete)
    case 'num_leechs': return pair(torrent.num_leechs, torrent.num_incomplete)
    case 'dlspeed': return speed(torrent.dlspeed, DOWN_SPEED_COLOR)
    case 'upspeed': return speed(torrent.upspeed, UP_SPEED_COLOR)
    case 'eta': return formatEta(torrent.eta)
    case 'ratio': return <span className={ratioColor(torrent.ratio)}>{torrent.ratio.toFixed(2)}</span>
    case 'category': return <span title={torrent.category}>{torrent.category}</span>
    case 'tags': return <span title={torrent.tags}>{torrent.tags}</span>
    case 'added_on': return formatDateTime(torrent.added_on)
    case 'completion_on': return formatDateTime(torrent.completion_on)
    case 'tracker': return <span title={torrent.tracker}>{trackerHost(torrent.tracker)}</span>
    case 'downloaded': return formatBytes(torrent.downloaded ?? torrent.total_downloaded ?? 0)
    case 'uploaded': return formatBytes(torrent.uploaded ?? 0)
    case 'amount_left': return formatBytes(torrent.amount_left ?? 0)
    case 'time_active': return formatDuration(torrent.time_active)
    case 'seeding_time': return formatDuration(torrent.seeding_time)
    case 'last_activity': return formatDateTime(torrent.last_activity)
    case 'availability': return torrent.availability !== undefined && torrent.availability >= 0 ? torrent.availability.toFixed(2) : '-'
    // qBittorrent's * for a torrent outside the queue.
    case 'priority': return torrent.priority > 0 ? torrent.priority : <span className="text-muted-foreground/60">*</span>
    case 'popularity': return torrent.popularity === undefined ? '-' : torrent.popularity < 0 ? '∞' : torrent.popularity.toFixed(2)
    case 'dl_limit': return limit(torrent.dl_limit)
    case 'up_limit': return limit(torrent.up_limit)
    case 'save_path': return <span title={torrent.save_path}>{torrent.save_path}</span>
  }
}

interface TorrentTableProps {
  torrents: Torrent[]
  layout: ColumnLayout
  onLayoutChange: (layout: ColumnLayout) => void
  // Reset columns also puts the sort order back.
  onResetSort: () => void
  selected: ReadonlySet<string>
  // Whether every, some, or none of the matching torrents are selected, for the header checkbox.
  selectAllState: boolean | 'indeterminate'
  // A checkbox click. With Shift it selects the range from the last row clicked.
  onToggle: (hash: string, range: boolean) => void
  onSelectAll: (checked: boolean) => void
  // The torrent shown in the details panel, marked in the list.
  openHash: string | null
  sortField: ColumnId
  sortDirection: SortDirection
  onSort: (field: ColumnId) => void
  // Click, long-press, and right-click handlers for a row.
  rowProps: (torrent: Torrent) => RowProps
  // Wraps the table body, for the right-click menu.
  wrapBody: (body: ReactElement) => ReactNode
  // The filters set from the column titles, and what each column's filter needs.
  columnFilters: ColumnFilters
  filterTargets: ReadonlyMap<string, FilterTarget>
  onColumnFilter: (id: ColumnId, filter: ColumnFilter | null) => void
}

// The width that shows every given cell's content whole: each is copied, unclipped, into a hidden
// box beside the table, which keeps the table's fonts.
function naturalWidth(cells: Element[], host: HTMLElement): number {
  const probe = document.createElement('div')
  probe.style.cssText = 'position:absolute;top:0;left:0;visibility:hidden;pointer-events:none;width:max-content;white-space:nowrap'
  host.appendChild(probe)
  let widest = 0
  for (const cell of cells) {
    probe.className = cell.className
    probe.innerHTML = cell.innerHTML
    widest = Math.max(widest, probe.getBoundingClientRect().width)
  }
  probe.remove()
  return Math.ceil(widest)
}

// A table whose columns can be dragged to a new place, resized from their right edge, sorted by
// clicking, and shown or hidden from the Columns menu. Alt + arrow keys on a header move it too.
// Clicking a row selects it and opens its details; Ctrl or Cmd adds to the selection, Shift a range.
export function TorrentTable({ torrents, layout, onLayoutChange, onResetSort, selected, selectAllState, onToggle, onSelectAll, openHash, sortField, sortDirection, onSort, rowProps, wrapBody, columnFilters, filterTargets, onColumnFilter }: TorrentTableProps) {
  const { data: serverState } = useTransferInfo()
  // qBittorrent hides its # column while queueing is off, when every torrent would show *.
  const columns = visibleColumns(layout).filter(def => def.id !== 'priority' || serverState?.queueing !== false)
  const [resizing, setResizing] = useState<{ id: ColumnId; width: number } | null>(null)
  // sign is -1 right to left, where a column's resizing edge is on its left.
  const resizeStart = useRef<{ x: number; width: number; sign: number } | null>(null)
  const [dragging, setDragging] = useState<ColumnId | null>(null)
  const [dropTarget, setDropTarget] = useState<ColumnId | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const head = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLDivElement>(null)

  // Widths are saved as they were for 12px text, so the table's 14px text and a larger text size
  // widen them to keep their text fitting.
  const scale = textScale() * (14 / 12)
  const widthOf = (id: ColumnId) => (resizing?.id === id ? resizing.width : columnWidth(layout, id) * scale)
  const total = SELECT_WIDTH * scale + columns.reduce((sum, def) => sum + widthOf(def.id), 0)

  const startResize = (e: PointerEvent<HTMLSpanElement>, id: ColumnId) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    resizeStart.current = { x: e.clientX, width: widthOf(id), sign: getComputedStyle(e.currentTarget).direction === 'rtl' ? -1 : 1 }
    setResizing({ id, width: widthOf(id) })
  }
  const moveResize = (e: PointerEvent<HTMLSpanElement>, id: ColumnId) => {
    if (!resizeStart.current || resizing?.id !== id) return
    const def = getColumn(id)
    setResizing({ id, width: Math.max(def.minWidth * scale, resizeStart.current.width + (e.clientX - resizeStart.current.x) * resizeStart.current.sign) })
  }
  const endResize = () => {
    if (resizing) onLayoutChange(resizeColumn(layout, resizing.id, resizing.width / scale))
    resizeStart.current = null
    setResizing(null)
  }
  // Double-clicking the edge fits the column to its widest value on this page, and to its header.
  const fitWidth = (id: ColumnId) => {
    const host = frame.current
    const index = columns.findIndex(def => def.id === id)
    if (!host || index === -1) return
    // The first cell of each row is the checkbox.
    const cells = [...host.querySelectorAll('tbody tr')].map(row => row.children[index + 1]).filter(Boolean)
    const header = host.querySelectorAll('thead th')[index + 1]
    // Room for the sort arrow, so sorting by the column later doesn't cut its header.
    const headerWidth = header ? naturalWidth([header], host) + 18 : 0
    onLayoutChange(resizeColumn(layout, id, (Math.max(naturalWidth(cells, host), headerWidth) + 1) / scale))
  }

  const onDragStart = (e: DragEvent<HTMLTableCellElement>, id: ColumnId) => {
    if (resizeStart.current) {
      e.preventDefault()
      return
    }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
    setDragging(id)
  }
  const onDragOver = (e: DragEvent<HTMLTableCellElement>, id: ColumnId) => {
    if (!dragging) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dropTarget !== id) setDropTarget(id)
  }
  const onDrop = (e: DragEvent<HTMLTableCellElement>, id: ColumnId) => {
    e.preventDefault()
    if (dragging) onLayoutChange(moveColumn(layout, dragging, id))
    setDragging(null)
    setDropTarget(null)
  }
  const onHeaderKey = (e: KeyboardEvent<HTMLButtonElement>, id: ColumnId) => {
    if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
    e.preventDefault()
    // The arrow points where the column goes on screen, which is backwards right to left.
    const towardsStart = (e.key === 'ArrowLeft') !== (getComputedStyle(e.currentTarget).direction === 'rtl')
    onLayoutChange(shiftColumn(layout, id, towardsStart ? -1 : 1))
  }

  const dragIndex = dragging ? columns.findIndex(def => def.id === dragging) : -1

  // The titles are a table of their own, kept in view below the header while the rows scroll
  // under them (a sticky row can't be inside the rows' sideways scroller), and scrolled sideways
  // along with the rows.
  const syncScroll = (from: HTMLDivElement | null, to: HTMLDivElement | null) => {
    if (!LINKED_SCROLL && from && to && to.scrollLeft !== from.scrollLeft) to.scrollLeft = from.scrollLeft
  }
  // How far the rows can scroll sideways, which is how far the titles move along the timeline.
  const [scrollRange, setScrollRange] = useState(0)
  useEffect(() => {
    const body = scroller.current
    if (!LINKED_SCROLL || !body || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setScrollRange(body.scrollWidth - body.clientWidth))
    observer.observe(body)
    if (body.firstElementChild) observer.observe(body.firstElementChild)
    return () => observer.disconnect()
  }, [])
  // The titles can't be scrolled themselves, so a sideways wheel or trackpad over them moves the rows.
  const wheelOnHead = (deltaX: number) => {
    if (deltaX && scroller.current) scroller.current.scrollLeft += deltaX
  }
  const tableWidth = { width: `max(100%, ${total}px)` }
  const colgroup = (
    <colgroup>
      <col style={{ width: SELECT_WIDTH * scale }} />
      {columns.map(def => <col key={def.id} style={{ width: widthOf(def.id) }} />)}
      {/* Takes any room left over, so the columns keep their widths. */}
      <col />
    </colgroup>
  )

  return (
    <div ref={frame} className="rounded-xl border bg-card max-sm:-mx-2" style={LINKED_SCROLL ? { timelineScope: '--table-x', '--table-scroll': `${scrollRange}px` } as CSSProperties : undefined}>
      <div
        ref={head}
        onWheel={(e) => wheelOnHead(e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX)}
        className="sticky top-(--header-height,3.5rem) z-20 overflow-hidden rounded-t-xl border-b bg-card"
      >
      <table className={cn('table-fixed text-sm tabular-nums', LINKED_SCROLL && 'table-head-linked')} style={tableWidth}>
        {colgroup}
        <ContextMenu>
        <ContextMenuTrigger asChild>
        <thead>
          <tr>
            <th className={cn('sticky start-0 z-10 h-10 bg-card px-2 text-start', LINKED_SCROLL && 'table-head-pinned')}>
              <Checkbox aria-label={t('Select all')} checked={selectAllState} onCheckedChange={(checked) => onSelectAll(checked === true)} />
            </th>
            {columns.map((def, index) => {
              const sorted = sortField === def.id
              // The drop marker shows on the side the column will land.
              const marker = dropTarget === def.id && dragging && dragging !== def.id ? (index < dragIndex ? 'before' : 'after') : null
              const target = filterTargets.get(def.id)
              const filterButton = target && <ColumnFilterButton target={target} filter={columnFilters[def.id]} onChange={(filter) => onColumnFilter(def.id, filter)} />
              return (
                <th
                  key={def.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, def.id)}
                  onDragOver={(e) => onDragOver(e, def.id)}
                  onDragLeave={() => setDropTarget(target => (target === def.id ? null : target))}
                  onDrop={(e) => onDrop(e, def.id)}
                  onDragEnd={() => { setDragging(null); setDropTarget(null) }}
                  aria-sort={sorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={cn(
                    'group/th relative h-10 select-none px-2 text-start align-middle font-medium text-muted-foreground',
                    dragging === def.id && 'opacity-50',
                    marker === 'before' && 'shadow-[inset_2px_0_0_var(--color-primary)]',
                    marker === 'after' && 'shadow-[inset_-2px_0_0_var(--color-primary)]',
                  )}
                >
                  <div className="flex min-w-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => onSort(def.id)}
                      onKeyDown={(e) => onHeaderKey(e, def.id)}
                      title={t('Sort by {label}. Drag to move, or press Alt and an arrow key.', { label: def.label })}
                      aria-label={def.header ? def.label : undefined}
                      className={cn('flex min-w-0 flex-1 cursor-grab items-center gap-1 hover:text-foreground active:cursor-grabbing', sorted && 'text-foreground')}
                    >
                      <span className="truncate">{def.header ?? def.label}</span>
                      {sorted && (sortDirection === 'asc' ? <ArrowUp className="size-3.5 shrink-0" /> : <ArrowDown className="size-3.5 shrink-0" />)}
                    </button>
                    {filterButton}
                  </div>
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={t('Resize {label}', { label: def.label })}
                    title={t('Drag to resize. Double-click to fit the content.')}
                    onPointerDown={(e) => startResize(e, def.id)}
                    onPointerMove={(e) => moveResize(e, def.id)}
                    onPointerUp={endResize}
                    onPointerCancel={endResize}
                    onDoubleClick={() => fitWidth(def.id)}
                    className="group absolute end-0 top-0 flex h-full w-2 cursor-col-resize touch-none justify-end"
                  >
                    <span className={cn('h-full w-px', resizing?.id === def.id ? 'bg-primary' : 'bg-border group-hover:bg-primary/60')} />
                  </span>
                </th>
              )
            })}
            <th aria-hidden />
          </tr>
        </thead>
        </ContextMenuTrigger>
        <ContextMenuContent className="max-h-[70vh] w-56">
          {layout.order.map(id => (
            <ContextMenuCheckboxItem key={id} checked={!layout.hidden.includes(id)} disabled={id === 'name'} onSelect={(e) => e.preventDefault()} onCheckedChange={() => onLayoutChange(toggleColumn(layout, id))}>
              {getColumn(id).label}
            </ContextMenuCheckboxItem>
          ))}
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => { onLayoutChange(DEFAULT_COLUMN_LAYOUT); onResetSort() }}><RotateCcw />{t('Reset columns')}</ContextMenuItem>
        </ContextMenuContent>
        </ContextMenu>
      </table>
      </div>
      {/* Its own scrollbar is hidden: the one at the bottom of the screen stands in for it. */}
      <div ref={scroller} onScroll={() => syncScroll(scroller.current, head.current)} style={LINKED_SCROLL ? { scrollTimeline: '--table-x inline' } as CSSProperties : undefined} className="overflow-x-auto overscroll-x-none rounded-b-xl scrollbar-none">
      <table className="table-fixed caption-bottom text-sm tabular-nums" style={tableWidth}>
        {colgroup}
        {wrapBody(
          <tbody>
            {torrents.map(torrent => {
              const isSelected = selected.has(torrent.hash)
              return (
                <tr
                  key={torrent.hash}
                  {...rowProps(torrent)}
                  aria-selected={isSelected}
                  aria-current={openHash === torrent.hash ? 'true' : undefined}
                  className={cn(
                    'group cursor-default border-b transition-colors outline-hidden select-none last:border-0 hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary [-webkit-touch-callout:none]',
                    isSelected && 'bg-muted',
                    openHash === torrent.hash && 'bg-primary/10 hover:bg-primary/15 shadow-[inset_3px_0_0_var(--color-primary)] rtl:shadow-[inset_-3px_0_0_var(--color-primary)]',
                  )}
                >
                  <td className={cn('px-2 py-1.5', PINNED_LEFT, isSelected && PINNED_SELECTED, openHash === torrent.hash && !isSelected && 'bg-[color-mix(in_oklab,var(--primary)_10%,var(--card))] group-hover:bg-[color-mix(in_oklab,var(--primary)_15%,var(--card))]', openHash === torrent.hash && 'shadow-[inset_3px_0_0_var(--color-primary)] rtl:shadow-[inset_-3px_0_0_var(--color-primary)]')}>
                    <Checkbox
                      aria-label={t('Select {name}', { name: torrent.name })}
                      checked={isSelected}
                      // Handled here rather than on change, to see whether Shift is down.
                      onClick={(e) => { e.preventDefault(); onToggle(torrent.hash, e.shiftKey) }}
                    />
                  </td>
                  {columns.map(def => (
                    <td key={def.id} className="truncate px-2 py-1.5 whitespace-nowrap">
                      {/* Numbers, sizes, dates and paths read left to right, also in a right-to-left language. */}
                      {WORD_COLUMNS.has(def.id) ? <Cell torrent={torrent} id={def.id} /> : <span dir="ltr"><Cell torrent={torrent} id={def.id} /></span>}
                    </td>
                  ))}
                  <td aria-hidden />
                </tr>
              )
            })}
          </tbody>,
        )}
      </table>
      </div>
      <BottomScrollbar target={scroller} />
    </div>
  )
}
