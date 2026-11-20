import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, RotateCcw, ChevronLeft, ChevronRight, Download, ExternalLink, LayoutList, Table2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ColumnFilterButton, type FilterTarget } from '@/components/ColumnFilters'
import { ColumnMenuItems } from '@/components/ColumnMenuItems'
import { canMeasureText, fittedWidth, moveInOrder, textWidth, useColumnDrag, useColumnResize } from '@/components/TableColumns'
import { ContextMenu, ContextMenuCheckboxItem, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import { searchFilterTargets } from '@/lib/searchFilters'
import { DEFAULT_SEARCH_HIDDEN, DEFAULT_SEARCH_SORT, FALLBACK_SEARCH_WIDTHS, loadSearchHidden, loadSearchOrder, loadSearchView, saveSearchOrder, SEARCH_SORT_KEYS, saveSearchView, loadSearchWidths, MIN_SEARCH_WIDTH, saveSearchHidden, saveSearchWidths, type ResizableSearchColumn as ResizableKey, type SearchSort, type SearchSortKey as SortKey, type SearchWidths } from '@/lib/searchSettings'
import { applyColumnFilters, type ColumnFilter, type ColumnFilters } from '@/lib/columnFilters'
import { published, SEARCH_FILTER_COLUMNS } from '@/lib/searchFilters'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { formatBytes, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { SearchResult } from '@/types'
import { t } from '@/i18n'


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

// Each column but the name as wide as its widest value among all the results, or its title, so
// widths don't change from page to page.
function fittedWidths(results: SearchResult[]): SearchWidths {
  // Without a canvas the columns keep their default widths.
  if (typeof document === 'undefined' || !canMeasureText()) return {}
  const family = getComputedStyle(document.body).fontFamily || 'sans-serif'
  const widths: SearchWidths = {}
  for (const column of COLUMNS) {
    if (column.key === 'fileName') continue
    let widest = textWidth(column.label, 14, 500, family) + TITLE_EXTRAS
    for (const result of results) {
      widest = Math.max(widest, textWidth(String(column.cell(result)), 14, 400, family) + CELL_PADDING)
    }
    widths[column.key] = Math.max(MIN_SEARCH_WIDTH, Math.ceil(widest))
  }
  return widths
}


// Found torrents, sortable, 20 a page: a table on wide screens and a list on phones.

export function SearchResults({ searchId, results, onAdd, toolbarSlot, filters, onFilterChange }: {
  // The search shown: another one starts again at the first page, sorted by seeds.
  searchId: number | null
  results: SearchResult[]
  onAdd: (result: SearchResult) => void
  // The column filters, kept by the page so the sidebar can show and change them.
  filters: ColumnFilters
  onFilterChange: (id: string, filter: ColumnFilter | null) => void
  // Where the filter, columns or sort, and view buttons go: the page header's button row.
  toolbarSlot?: HTMLElement | null
}) {
  // Each search starts with the most seeds first; a sort picked here lasts for this search.
  const [sort, setSort] = useState<SearchSort>(DEFAULT_SEARCH_SORT)
  const [page, setPage] = useState(1)
  // Reset here rather than by drawing the table anew, which made it flash between searches.
  const [shownSearch, setShownSearch] = useState(searchId)
  if (searchId !== shownSearch) {
    setShownSearch(searchId)
    setSort(DEFAULT_SEARCH_SORT)
    setPage(1)
  }
  const [widths, setWidths] = useState(loadSearchWidths)
  const [hidden, setHiddenState] = useState(loadSearchHidden)
  const setHidden = (next: ResizableKey[]) => { setHiddenState(next); saveSearchHidden(next) }
  const toggleColumn = (key: ResizableKey) => setHidden(hidden.includes(key) ? hidden.filter(k => k !== key) : [...hidden, key])
  // Columns in the order they were dragged to.
  const [order, setOrderState] = useState(loadSearchOrder)
  const setOrder = (next: SortKey[]) => { setOrderState(next); saveSearchOrder(next) }
  const visible = order.map(key => COLUMNS.find(c => c.key === key)!).filter(c => c.key === 'fileName' || !hidden.includes(c.key))
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
  const saveWidth = (key: SortKey, width: number) => setWidths(current => {
    const next = { ...current, [key]: Math.max(MIN_SEARCH_WIDTH, Math.round(width)) }
    saveSearchWidths(next)
    return next
  })
  const resize = useColumnResize<SortKey>({
    widthOf: (key): number => (key === 'fileName' && widths.fileName === undefined && tableWidth > 0
      ? Math.max(MIN_NAME_WIDTH, tableWidth - others() - ACTIONS_WIDTH)
      : widths[key] ?? fitted[key] ?? FALLBACK_SEARCH_WIDTHS[key]),
    minWidthOf: () => MIN_SEARCH_WIDTH,
    onResize: saveWidth,
    // Double-clicking the edge fits the column to its widest value on this page, and to its title.
    onFit: key => {
      const width = fittedWidth(frame.current, visible.findIndex(c => c.key === key))
      if (width) saveWidth(key, width)
    },
  })
  const widthOf: (key: SortKey) => number = resize.width
  // The other columns' widths, which the name's share of the table leaves room for.
  const others = (): number => visible.reduce((sum, c) => sum + (c.key === 'fileName' ? 0 : widthOf(c.key)), 0)
  const total = ACTIONS_WIDTH + visible.reduce((sum, c) => sum + widthOf(c.key), 0)
  const drag = useColumnDrag<SortKey>({ keys: visible.map(c => c.key), onMove: (key, target) => setOrder(moveInOrder(order, key, target)), busy: resize.busy })
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
    onFilterChange(id, filter)
    setPage(1)
  }
  const targets = useMemo(() => new Map(searchFilterTargets(results).map((target): [string, FilterTarget] => [target.id, target])), [results])

  const sorted = useMemo(() => {
    const value = (r: SearchResult) => (sort.key === 'pubDate' ? published(r) : r[sort.key] ?? '')
    return applyColumnFilters(results, SEARCH_FILTER_COLUMNS, filters).sort((a, b) => {
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

  // The Columns menu, also opened by right-clicking a column title, as on the torrent list.
  const columnsHint = t('Drag headers to reorder, or drag their edges to resize')
  const columnItems = {
    order,
    shown: (key: SortKey) => key === 'fileName' || shows(key as ResizableKey),
    locked: 'fileName' as SortKey,
    label: (key: SortKey) => COLUMNS.find(c => c.key === key)!.label,
    onToggle: (key: SortKey) => { if (key !== 'fileName') toggleColumn(key as ResizableKey) },
    onMove: (key: SortKey, target: SortKey) => setOrder(moveInOrder(order, key, target)),
  }
  const resetColumns = () => { setHidden(DEFAULT_SEARCH_HIDDEN); setWidths({}); saveSearchWidths({}); setOrder([...SEARCH_SORT_KEYS]) }
  // Nothing to reset: Reset columns is greyed out.
  const columnsDefault = Object.keys(widths).length === 0 && order.join() === SEARCH_SORT_KEYS.join()
    && hidden.length === DEFAULT_SEARCH_HIDDEN.length && hidden.every(key => DEFAULT_SEARCH_HIDDEN.includes(key))

  // In the page's header, like the torrent list's buttons.
  const toolbar = (
    <>
        {/* As on the torrent list: columns or sort, then the view. The sidebar button follows. */}
        {showTable && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="size-8" aria-label={t('Columns')} title={t('Choose columns')}>
              <Columns3 className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{columnsHint}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ColumnMenuItems {...columnItems} Item={DropdownMenuCheckboxItem} />
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={columnsDefault} onClick={resetColumns}><RotateCcw className="size-4" />{t('Reset columns')}</DropdownMenuItem>
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

      {/* Filters are added and listed in the sidebar; the table also filters from its titles. */}

      {sorted.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t('No results match these filters')}</p>}

      <div ref={frame} className={cn('rounded-xl border bg-card max-sm:-mx-2', (!showTable || sorted.length === 0) && 'hidden')}>
        <div
          ref={head}
          // Only the titles' own wheel: the right-click menu's bubbles here through React too.
          onWheel={(e) => { const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX; if (dx && scroller.current && e.currentTarget.contains(e.target as Node)) scroller.current.scrollLeft += dx }}
          className="sticky top-(--sticky-top) z-20 overflow-hidden rounded-t-xl border-b bg-card"
        >
          <table className="table-fixed text-sm tabular-nums" style={{ width: `max(100%, ${total}px)` }}>
            {colgroup}
            <ContextMenu>
            <ContextMenuTrigger asChild>
            <thead>
              <tr>
                {visible.map(c => {
                  const { className: dragClass, ...dragProps } = drag.titleProps(c.key)
                  return (
                    <th key={c.key} {...dragProps} className={cn('group/th relative h-10 select-none px-2 text-start align-middle font-medium text-muted-foreground', dragClass)} aria-sort={sort.key === c.key ? (sort.desc ? 'descending' : 'ascending') : undefined}>
                      <div className="flex min-w-0 items-center gap-0.5">
                        <button
                          type="button" onClick={() => sortBy(c.key)} onKeyDown={(e) => drag.onTitleKey(e, c.key)}
                          title={t('Sort by {label}. Drag to move, or press Alt and an arrow key.', { label: c.label })}
                          className={cn('flex min-w-0 flex-1 cursor-grab items-center gap-1 hover:text-foreground active:cursor-grabbing', sort.key === c.key && 'text-foreground')}
                        >
                          <span className="truncate">{c.label}</span>
                          {sort.key === c.key && (sort.desc ? <ArrowDown className="size-3.5 shrink-0" /> : <ArrowUp className="size-3.5 shrink-0" />)}
                        </button>
                        <ColumnFilterButton target={targets.get(c.key)!} filter={filters[c.key]} onChange={(filter) => setFilter(c.key, filter)} />
                      </div>
                      {resize.handle(c.key, c.label)}
                    </th>
                  )
                })}
                <th><span className="sr-only">{t('Actions')}</span></th>
                <th aria-hidden />
              </tr>
            </thead>
            </ContextMenuTrigger>
            <ContextMenuContent className="max-h-[70vh] w-60">
              <ContextMenuLabel className="whitespace-normal text-xs font-normal text-muted-foreground">{columnsHint}</ContextMenuLabel>
              <ContextMenuSeparator />
              <ColumnMenuItems {...columnItems} Item={ContextMenuCheckboxItem} />
              <ContextMenuSeparator />
              <ContextMenuItem disabled={columnsDefault} onClick={resetColumns}><RotateCcw />{t('Reset columns')}</ContextMenuItem>
            </ContextMenuContent>
            </ContextMenu>
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
