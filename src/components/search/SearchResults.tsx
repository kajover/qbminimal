import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, RotateCcw, ChevronLeft, ChevronRight, Download, ExternalLink, LayoutList, Table2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AddFilterButton, ColumnFilterButton, ColumnFilterChips, type FilterTarget } from '@/components/ColumnFilters'
import { DEFAULT_SEARCH_HIDDEN, DEFAULT_SEARCH_SORT, FALLBACK_SEARCH_WIDTHS, loadSearchHidden, loadSearchView, saveSearchView, loadSearchSort, loadSearchWidths, MIN_SEARCH_WIDTH, saveSearchHidden, saveSearchSort, saveSearchWidths, type ResizableSearchColumn as ResizableKey, type SearchSort, type SearchSortKey as SortKey, type SearchWidths } from '@/lib/searchSettings'
import { applyColumnFilters, choiceOptions, withFilter, type ColumnFilter, type ColumnFilters, type FilterColumn } from '@/lib/columnFilters'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { formatBytes, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { SearchResult } from '@/types'
import { t } from '@/i18n'

// Older qBittorrent leaves out the plugin and date, and plugins send -1 for a date they don't know.
const published = (r: SearchResult) => (r.pubDate && r.pubDate > 0 ? r.pubDate : 0)

// qBittorrent's search plugins only report these, so columns like a tracker's freeleech or group can't be shown.
const COLUMNS: { key: SortKey; label: string; numeric?: boolean; className?: string; cell: (r: SearchResult) => ReactNode }[] = [
  { key: 'fileName', label: t('Name'), className: 'truncate', cell: r => r.fileName },
  { key: 'fileSize', label: t('Size'), numeric: true, cell: r => formatBytes(r.fileSize) },
  { key: 'nbSeeders', label: t('Seeds'), numeric: true, className: 'text-green-600 dark:text-green-400', cell: r => r.nbSeeders },
  { key: 'nbLeechers', label: t('Leeches'), numeric: true, className: 'text-red-500', cell: r => r.nbLeechers },
  { key: 'engineName', label: t('Plugin'), className: 'truncate text-muted-foreground', cell: r => r.engineName || '-' },
  { key: 'pubDate', label: t('Published'), numeric: true, className: 'truncate text-muted-foreground', cell: r => formatDateTime(published(r)) },
]

const PER_PAGE = 20
const ACTIONS_WIDTH = 96
// The name never fits into less than this, so narrow screens scroll the table instead.
const MIN_NAME_WIDTH = 240
// Cell padding, and in the titles also the sort arrow and filter button beside the label.
const CELL_PADDING = 20
const TITLE_EXTRAS = 64

// How wide a text is in the given font, measured on a canvas, or null where that isn't possible.
let canvas: CanvasRenderingContext2D | null | undefined
function textWidth(text: string, font: string): number | null {
  if (canvas === undefined) {
    try {
      canvas = document.createElement('canvas').getContext('2d')
    } catch {
      canvas = null
    }
  }
  if (!canvas) return null
  canvas.font = font
  return canvas.measureText(text).width
}

// Each column but the name as wide as its widest value among all the results, or its title, so
// widths don't change from page to page.
function fittedWidths(results: SearchResult[]): SearchWidths {
  const family = typeof document === 'undefined' ? 'sans-serif' : getComputedStyle(document.body).fontFamily || 'sans-serif'
  const widths: SearchWidths = {}
  for (const column of COLUMNS) {
    if (column.key === 'fileName') continue
    const title = textWidth(column.label, `500 14px ${family}`)
    if (title === null) return {}
    let widest = title + TITLE_EXTRAS
    for (const result of results) {
      widest = Math.max(widest, (textWidth(String(column.cell(result)), `400 14px ${family}`) ?? 0) + CELL_PADDING)
    }
    widths[column.key] = Math.max(MIN_SEARCH_WIDTH, Math.ceil(widest))
  }
  return widths
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

// Each column can be filtered like the torrent table's: a text match, a range, or a choice of sites.
const FILTER_COLUMNS: FilterColumn<SearchResult>[] = [
  { id: 'fileName', label: t('Name'), kind: 'text', value: r => r.fileName },
  { id: 'fileSize', label: t('Size'), kind: 'size', value: r => (r.fileSize >= 0 ? r.fileSize : NaN) },
  { id: 'nbSeeders', label: t('Seeds'), kind: 'number', value: r => r.nbSeeders },
  { id: 'nbLeechers', label: t('Leeches'), kind: 'number', value: r => r.nbLeechers },
  { id: 'engineName', label: t('Plugin'), kind: 'set', value: r => r.engineName ?? '' },
  { id: 'pubDate', label: t('Published'), kind: 'date', value: r => published(r) || NaN },
]

// Found torrents, sortable, 20 a page: a table on wide screens and a list on phones.
export function SearchResults({ results, onAdd, toolbarSlot }: {
  results: SearchResult[]
  onAdd: (result: SearchResult) => void
  // Where the filter, columns or sort, and view buttons go: the page header's button row.
  toolbarSlot?: HTMLElement | null
}) {
  const [sort, setSortState] = useState<SearchSort>(loadSearchSort)
  const setSort = (next: SearchSort) => { setSortState(next); saveSearchSort(next) }
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<ColumnFilters>({})
  const [widths, setWidths] = useState(loadSearchWidths)
  const [hidden, setHiddenState] = useState(loadSearchHidden)
  const setHidden = (next: ResizableKey[]) => { setHiddenState(next); saveSearchHidden(next) }
  const toggleColumn = (key: ResizableKey) => setHidden(hidden.includes(key) ? hidden.filter(k => k !== key) : [...hidden, key])
  const visible = COLUMNS.filter(c => c.key === 'fileName' || !hidden.includes(c.key))
  const shows = (key: ResizableKey) => !hidden.includes(key)

  // Like the torrent list: the table on wide screens and cards on phones, unless one is picked.
  const wide = useMediaQuery('(min-width: 1200px)')
  const [view, setViewState] = useState(loadSearchView)
  const showTable = view ? view === 'table' : wide
  const switchView = () => {
    const next = showTable ? 'cards' : 'table'
    // Back to following the screen when the pick matches it.
    const saved = (next === 'table') === wide ? null : next
    setViewState(saved)
    saveSearchView(saved)
  }

  // Like the torrent table: a column is resized from its right edge, and the table scrolls sideways
  // when the columns are wider than the screen. Until then each fits its content and the name takes
  // the rest; once the name is resized, a filler column takes any room left over.
  const fitted = useMemo(() => fittedWidths(results), [results])
  const [tableWidth, setTableWidth] = useState(0)
  const [resizing, setResizing] = useState<{ key: SortKey; width: number } | null>(null)
  // sign is -1 right to left, where a column's resizing edge is on its left.
  const resizeStart = useRef<{ x: number; width: number; sign: number } | null>(null)
  const frame = useRef<HTMLDivElement>(null)
  const head = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  // The table is only there once results arrive, so it's watched from then on.
  const hasResults = results.length > 0
  useEffect(() => {
    const box = frame.current
    if (!box || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setTableWidth(box.clientWidth))
    observer.observe(box)
    return () => observer.disconnect()
  }, [hasResults])
  const columnWidth = (key: SortKey) => (resizing?.key === key ? resizing.width : widths[key] ?? fitted[key] ?? FALLBACK_SEARCH_WIDTHS[key])
  const others = visible.reduce((sum, c) => sum + (c.key === 'fileName' ? 0 : columnWidth(c.key)), 0)
  const widthOf = (key: SortKey) => (key === 'fileName' && resizing?.key !== key && widths.fileName === undefined && tableWidth > 0
    ? Math.max(MIN_NAME_WIDTH, tableWidth - others - ACTIONS_WIDTH)
    : columnWidth(key))
  const total = ACTIONS_WIDTH + visible.reduce((sum, c) => sum + widthOf(c.key), 0)
  const startResize = (e: PointerEvent<HTMLSpanElement>, key: SortKey) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    resizeStart.current = { x: e.clientX, width: widthOf(key), sign: getComputedStyle(e.currentTarget).direction === 'rtl' ? -1 : 1 }
    setResizing({ key, width: widthOf(key) })
  }
  const moveResize = (e: PointerEvent<HTMLSpanElement>, key: SortKey) => {
    if (!resizeStart.current || resizing?.key !== key) return
    setResizing({ key, width: Math.max(MIN_SEARCH_WIDTH, Math.round(resizeStart.current.width + (e.clientX - resizeStart.current.x) * resizeStart.current.sign)) })
  }
  const saveWidth = (key: SortKey, width: number) => setWidths(current => {
    const next = { ...current, [key]: Math.max(MIN_SEARCH_WIDTH, Math.round(width)) }
    saveSearchWidths(next)
    return next
  })
  const endResize = () => {
    if (resizing) saveWidth(resizing.key, resizing.width)
    resizeStart.current = null
    setResizing(null)
  }
  // Double-clicking the edge fits the column to its widest value on this page, and to its header.
  const fitWidth = (key: SortKey) => {
    const host = frame.current
    const index = visible.findIndex(c => c.key === key)
    if (!host || index === -1) return
    const cells = [...host.querySelectorAll('tbody tr')].map(row => row.children[index]).filter(Boolean)
    const header = host.querySelectorAll('thead th')[index]
    // Room for the sort arrow and the filter button, so the header isn't cut later.
    const headerWidth = header ? naturalWidth([header], host) + 18 : 0
    saveWidth(key, Math.max(naturalWidth(cells, host), headerWidth) + 1)
  }
  // The titles sit in a table of their own, so they stay in view below the header while the rows
  // scroll sideways along with them.
  const syncScroll = () => { if (head.current && scroller.current) head.current.scrollLeft = scroller.current.scrollLeft }
  const colgroup = (
    <colgroup>
      {visible.map(c => <col key={c.key} style={{ width: widthOf(c.key) }} />)}
      <col style={{ width: ACTIONS_WIDTH }} />
      {/* Takes any room left over, so the columns keep their widths. */}
      <col />
    </colgroup>
  )
  const setFilter = (id: string, filter: ColumnFilter | null) => {
    setFilters(current => withFilter(current, id, filter))
    setPage(1)
  }
  const targets = useMemo(() => new Map(FILTER_COLUMNS.map((column): [string, FilterTarget] => [column.id, {
    ...column,
    options: column.kind === 'set' ? () => choiceOptions(results, column) : undefined,
  }])), [results])

  const sorted = useMemo(() => {
    const value = (r: SearchResult) => (sort.key === 'pubDate' ? published(r) : r[sort.key] ?? '')
    return applyColumnFilters(results, FILTER_COLUMNS, filters).sort((a, b) => {
      const x = value(a)
      const y = value(b)
      const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { sensitivity: 'base', numeric: true })
      return sort.desc ? -order : order
    })
  }, [results, sort, filters])

  const pages = Math.max(1, Math.ceil(sorted.length / PER_PAGE))
  const current = Math.min(page, pages)
  const shown = sorted.slice((current - 1) * PER_PAGE, current * PER_PAGE)
  // Numbers start with the largest first, text from A.
  const sortBy = (key: SortKey) => {
    setSort({ key, desc: sort.key === key ? !sort.desc : COLUMNS.find(c => c.key === key)?.numeric ?? false })
    setPage(1)
  }

  const sortLabel = COLUMNS.find(c => c.key === sort.key)?.label ?? ''
  const arrow = sort.desc ? '↓' : '↑'

  // Smaller in the table, so its rows are as low as the torrent table's.
  const links = (result: SearchResult, inTable = false) => (
    <span className={cn('flex items-center', inTable ? 'gap-0.5' : 'gap-1')}>
      {result.fileUrl && (
        <Button variant="ghost" size="icon" className={inTable ? 'size-7' : 'size-8'} aria-label={t('Add {fileName}', { fileName: result.fileName })} title={t('Add')} onClick={(e) => { e.stopPropagation(); onAdd(result) }}>
          <Download className="size-4" />
        </Button>
      )}
      {result.descrLink && (
        <Button variant="ghost" size="icon" className={inTable ? 'size-7' : 'size-8'} asChild>
          <a href={result.descrLink} target="_blank" rel="noopener noreferrer" aria-label={t('Open its page')} title={t('Open its page')} onClick={(e) => e.stopPropagation()}><ExternalLink className="size-4" /></a>
        </Button>
      )}
    </span>
  )

  // In the page's header, like the torrent list's buttons.
  const toolbar = (
    <>
        {/* As on the torrent list: columns or sort, then the view, then the filter funnel last. */}
        {showTable && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="size-8" aria-label={t('Columns')} title={t('Choose columns')}>
              <Columns3 className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {COLUMNS.map(c => (
              <DropdownMenuCheckboxItem key={c.key} checked={c.key === 'fileName' || shows(c.key)} disabled={c.key === 'fileName'} onSelect={(e) => e.preventDefault()} onCheckedChange={() => c.key !== 'fileName' && toggleColumn(c.key)}>
                {c.label}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { setHidden(DEFAULT_SEARCH_HIDDEN); setWidths({}); saveSearchWidths({}) }}><RotateCcw className="size-4" />{t('Reset columns')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        )}
        {/* The table sorts from its titles; the cards from here. */}
        <div className={cn('contents', showTable && 'hidden')}>
        {/* Like the torrent cards' sort: pick a column, and pick it again to reverse the order. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="size-8" aria-label={t('Sort: {column}', { column: sortLabel })} title={`${t('Sort: {column}', { column: sortLabel })} ${arrow}`}>
              <ArrowUpDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t('Sort by')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {COLUMNS.map(c => (
              <DropdownMenuItem key={c.key} onClick={() => sortBy(c.key)}>
                {c.label} {sort.key === c.key && arrow}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={sort.key === DEFAULT_SEARCH_SORT.key && sort.desc === DEFAULT_SEARCH_SORT.desc} onClick={() => { setSort(DEFAULT_SEARCH_SORT); setPage(1) }}>
              <RotateCcw />{t('Reset sorting')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
        <Button variant="outline" size="icon" className="size-8" aria-label={showTable ? t('Card view') : t('Table view')} title={showTable ? t('Card view') : t('Table view')} onClick={switchView}>
          {showTable ? <LayoutList className="size-4" /> : <Table2 className="size-4" />}
        </Button>
        <AddFilterButton targets={[...targets.values()]} onChange={setFilter} />
    </>
  )

  const placedToolbar = toolbarSlot ? createPortal(toolbar, toolbarSlot) : <div className="flex justify-end gap-1">{toolbar}</div>
  // Before a search, only the buttons.
  if (results.length === 0) return placedToolbar

  return (
    <div className="space-y-2">
      {placedToolbar}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{sorted.length === results.length ? t('{count} results', { count: results.length }) : t('{length} of {total} results', { length: sorted.length, total: results.length })}</span>
      </div>

      {/* The funnel in the header adds a filter in either view; the table also filters from its titles. */}
      <ColumnFilterChips targets={[...targets.values()]} filters={filters} onChange={setFilter} />

      {sorted.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t('No results match these filters')}</p>}

      <div ref={frame} className={cn('rounded-xl border bg-card max-sm:-mx-2', (!showTable || sorted.length === 0) && 'hidden')}>
        <div
          ref={head}
          onWheel={(e) => { const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX; if (dx && scroller.current) scroller.current.scrollLeft += dx }}
          className="sticky top-(--header-height,3.5rem) z-20 overflow-hidden rounded-t-xl border-b bg-card"
        >
          <table className="table-fixed text-sm tabular-nums" style={{ width: `max(100%, ${total}px)` }}>
            {colgroup}
            <thead>
              <tr>
                {visible.map(c => (
                  <th key={c.key} className="group/th relative h-10 select-none px-2 text-start align-middle font-medium text-muted-foreground" aria-sort={sort.key === c.key ? (sort.desc ? 'descending' : 'ascending') : undefined}>
                    <div className="flex min-w-0 items-center gap-0.5">
                      <button type="button" onClick={() => sortBy(c.key)} className={cn('flex min-w-0 flex-1 items-center gap-1 hover:text-foreground', sort.key === c.key && 'text-foreground')}>
                        <span className="truncate">{c.label}</span>
                        {sort.key === c.key && (sort.desc ? <ArrowDown className="size-3.5 shrink-0" /> : <ArrowUp className="size-3.5 shrink-0" />)}
                      </button>
                      <ColumnFilterButton target={targets.get(c.key)!} filter={filters[c.key]} onChange={(filter) => setFilter(c.key, filter)} />
                    </div>
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={t('Resize {label}', { label: c.label })}
                      title={t('Drag to resize. Double-click to fit the content.')}
                      onPointerDown={(e) => startResize(e, c.key)}
                      onPointerMove={(e) => moveResize(e, c.key)}
                      onPointerUp={endResize}
                      onPointerCancel={endResize}
                      onDoubleClick={() => fitWidth(c.key)}
                      className="group absolute end-0 top-0 flex h-full w-2 cursor-col-resize touch-none justify-end"
                    >
                      <span className={cn('h-full w-px', resizing?.key === c.key ? 'bg-primary' : 'bg-border group-hover:bg-primary/60')} />
                    </span>
                  </th>
                ))}
                <th><span className="sr-only">{t('Actions')}</span></th>
                <th aria-hidden />
              </tr>
            </thead>
          </table>
        </div>
        <div ref={scroller} onScroll={syncScroll} className="overflow-x-auto overscroll-x-none rounded-b-xl">
          <table className="table-fixed text-sm tabular-nums" style={{ width: `max(100%, ${total}px)` }}>
            {colgroup}
            <tbody>
              {shown.map(result => (
                <tr key={`${result.fileUrl}|${result.descrLink}`} className="cursor-pointer border-b last:border-0 hover:bg-muted/50" onClick={() => result.fileUrl && onAdd(result)}>
                  {visible.map(c => (
                    <td key={c.key} className={cn('truncate px-2 py-1.5 whitespace-nowrap', c.className)} title={c.key === 'fileName' ? result.fileName : undefined}>
                      {/* Numbers, sizes and dates read left to right, also in a right-to-left language. */}
                      {c.numeric ? <span dir="ltr">{c.cell(result)}</span> : c.cell(result)}
                    </td>
                  ))}
                  <td className="px-1 py-0.5">{links(result, true)}</td>
                  <td aria-hidden />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Laid out like the torrent cards: a grid on wide screens. */}
      <ul className={cn('grid grid-cols-1 items-start gap-2 max-sm:-mx-2 lg:grid-cols-2 2xl:grid-cols-3', showTable && 'hidden')}>
        {shown.map(result => (
          <li key={`${result.fileUrl}|${result.descrLink}`} className="flex items-start gap-2 rounded-xl border bg-card px-3 py-2.5">
            <button type="button" className="min-w-0 flex-1 text-start" onClick={() => result.fileUrl && onAdd(result)}>
              <span className="block text-xs text-muted-foreground">{t('{seeds} seeds · {leeches} leeches', { seeds: result.nbSeeders, leeches: result.nbLeechers })}</span>
              <span className="block text-sm wrap-anywhere">{result.fileName}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {[shows('fileSize') && formatBytes(result.fileSize), shows('engineName') && result.engineName, shows('pubDate') && published(result) > 0 && formatDateTime(published(result))].filter(Boolean).join(' · ')}
              </span>
            </button>
            {links(result)}
          </li>
        ))}
      </ul>

      {pages > 1 && (
        <div className="flex items-center justify-between px-2 text-sm">
          <span className="text-muted-foreground">{t('{from}-{to} of {total}', { from: (current - 1) * PER_PAGE + 1, to: Math.min(current * PER_PAGE, sorted.length), total: sorted.length })}</span>
          <span className="flex items-center gap-2">
            <Button variant="outline" size="sm" aria-label={t('Previous page')} disabled={current === 1} onClick={() => setPage(current - 1)}><ChevronLeft className="size-4" /></Button>
            <span className="tabular-nums">{current} / {pages}</span>
            <Button variant="outline" size="sm" aria-label={t('Next page')} disabled={current === pages} onClick={() => setPage(current + 1)}><ChevronRight className="size-4" /></Button>
          </span>
        </div>
      )}
    </div>
  )
}
