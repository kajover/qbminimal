import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, RotateCcw, ChevronLeft, ChevronRight, Download, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AddFilterButton, ColumnFilterButton, ColumnFilterChips, type FilterTarget } from '@/components/ColumnFilters'
import { DEFAULT_SEARCH_SORT, DEFAULT_SEARCH_WIDTHS, loadSearchHidden, loadSearchSort, loadSearchWidths, MIN_SEARCH_WIDTH, saveSearchHidden, saveSearchSort, saveSearchWidths, type ResizableSearchColumn as ResizableKey, type SearchSort, type SearchSortKey as SortKey } from '@/lib/searchSettings'
import { applyColumnFilters, choiceOptions, withFilter, type ColumnFilter, type ColumnFilters, type FilterColumn } from '@/lib/columnFilters'
import { formatBytes, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { SearchResult } from '@/types'
import { t } from '@/i18n'

const host = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
// Older qBittorrent leaves out the plugin and date, and plugins send -1 for a date they don't know.
const published = (r: SearchResult) => (r.pubDate && r.pubDate > 0 ? r.pubDate : 0)

// qBittorrent's search plugins only report these, so columns like a tracker's freeleech or group can't be shown.
const COLUMNS: { key: SortKey; label: string; numeric?: boolean; className?: string; cell: (r: SearchResult) => ReactNode }[] = [
  { key: 'fileName', label: t('Name'), className: 'truncate', cell: r => r.fileName },
  { key: 'fileSize', label: t('Size'), numeric: true, cell: r => formatBytes(r.fileSize) },
  { key: 'nbSeeders', label: t('Seeds'), numeric: true, className: 'text-green-600 dark:text-green-400', cell: r => r.nbSeeders },
  { key: 'nbLeechers', label: t('Leeches'), numeric: true, className: 'text-red-500', cell: r => r.nbLeechers },
  { key: 'engineName', label: t('Plugin'), className: 'truncate text-muted-foreground', cell: r => r.engineName || '-' },
  { key: 'siteUrl', label: t('Source'), className: 'truncate text-muted-foreground', cell: r => host(r.siteUrl) },
  { key: 'pubDate', label: t('Published'), numeric: true, className: 'truncate text-muted-foreground', cell: r => formatDateTime(published(r)) },
]

const PER_PAGE = 20
const ACTIONS_WIDTH = 96
// The name keeps at least this share of the table, so it stays the widest column.
const NAME_SHARE = 0.4

// Each column can be filtered like the torrent table's: a text match, a range, or a choice of sites.
const FILTER_COLUMNS: FilterColumn<SearchResult>[] = [
  { id: 'fileName', label: t('Name'), kind: 'text', value: r => r.fileName },
  { id: 'fileSize', label: t('Size'), kind: 'size', value: r => (r.fileSize >= 0 ? r.fileSize : NaN) },
  { id: 'nbSeeders', label: t('Seeds'), kind: 'number', value: r => r.nbSeeders },
  { id: 'nbLeechers', label: t('Leeches'), kind: 'number', value: r => r.nbLeechers },
  { id: 'engineName', label: t('Plugin'), kind: 'set', value: r => r.engineName ?? '' },
  { id: 'siteUrl', label: t('Source'), kind: 'set', value: r => host(r.siteUrl) },
  { id: 'pubDate', label: t('Published'), kind: 'date', value: r => published(r) || NaN },
]

// Found torrents, sortable, 20 a page: a table on wide screens and a list on phones.
export function SearchResults({ results, onAdd }: { results: SearchResult[]; onAdd: (result: SearchResult) => void }) {
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

  // Narrow tables shrink the other columns rather than the name.
  const tableBox = useRef<HTMLDivElement>(null)
  const [tableWidth, setTableWidth] = useState(0)
  useEffect(() => {
    const box = tableBox.current
    if (!box || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setTableWidth(box.clientWidth))
    observer.observe(box)
    return () => observer.disconnect()
  }, [])
  const fixed = visible.filter(c => c.key !== 'fileName').reduce((sum, c) => sum + widths[c.key as ResizableKey], 0)
  const scale = tableWidth > 0 && fixed > 0 ? Math.min(1, Math.max(0, tableWidth * (1 - NAME_SHARE) - ACTIONS_WIDTH) / fixed) : 1
  const shownWidth = (key: ResizableKey) => Math.max(48, Math.round(widths[key] * scale))
  const resizing = useRef<{ key: ResizableKey; x: number; width: number; sign: number } | null>(null)
  const startResize = (e: PointerEvent<HTMLSpanElement>, key: ResizableKey) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    resizing.current = { key, x: e.clientX, width: widths[key], sign: getComputedStyle(e.currentTarget).direction === 'rtl' ? -1 : 1 }
  }
  // A column is resized from its left edge, so dragging left widens it and narrows the name.
  const moveResize = (e: PointerEvent<HTMLSpanElement>) => {
    const drag = resizing.current
    if (!drag) return
    setWidths(current => ({ ...current, [drag.key]: Math.max(MIN_SEARCH_WIDTH, Math.round(drag.width - (e.clientX - drag.x) * drag.sign)) }))
  }
  const endResize = () => {
    if (!resizing.current) return
    resizing.current = null
    setWidths(current => { saveSearchWidths(current); return current })
  }
  const resetWidth = (key: ResizableKey) => setWidths(current => { const next = { ...current, [key]: DEFAULT_SEARCH_WIDTHS[key] }; saveSearchWidths(next); return next })
  const setFilter = (id: string, filter: ColumnFilter | null) => {
    setFilters(current => withFilter(current, id, filter))
    setPage(1)
  }
  const targets = useMemo(() => new Map(FILTER_COLUMNS.map((column): [string, FilterTarget] => [column.id, {
    ...column,
    options: column.kind === 'set' ? () => choiceOptions(results, column) : undefined,
  }])), [results])

  const sorted = useMemo(() => {
    const value = (r: SearchResult) => (sort.key === 'siteUrl' ? host(r.siteUrl) : sort.key === 'pubDate' ? published(r) : r[sort.key] ?? '')
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

  const links = (result: SearchResult) => (
    <span className="flex items-center gap-1">
      {result.fileUrl && (
        <Button variant="ghost" size="icon" className="size-8" aria-label={t('Add {fileName}', { fileName: result.fileName })} title={t('Add')} onClick={(e) => { e.stopPropagation(); onAdd(result) }}>
          <Download className="size-4" />
        </Button>
      )}
      {result.descrLink && (
        <Button variant="ghost" size="icon" className="size-8" asChild>
          <a href={result.descrLink} target="_blank" rel="noopener noreferrer" aria-label={t('Open its page')} title={t('Open its page')} onClick={(e) => e.stopPropagation()}><ExternalLink className="size-4" /></a>
        </Button>
      )}
    </span>
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{sorted.length === results.length ? t('{count} results', { count: results.length }) : t('{length} of {total} results', { length: sorted.length, total: results.length })}</span>
        <div className="flex items-center gap-1">
        <AddFilterButton targets={[...targets.values()]} onChange={setFilter} />
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
            <DropdownMenuItem onClick={() => { setHidden([]); setWidths(DEFAULT_SEARCH_WIDTHS); saveSearchWidths(DEFAULT_SEARCH_WIDTHS) }}><RotateCcw className="size-4" />{t('Reset columns')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="contents md:hidden">
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
        </div>
      </div>

      {/* Wide screens filter from the column titles; phones add filters from the row above. */}
      <ColumnFilterChips targets={[...targets.values()]} filters={filters} onChange={setFilter} showAdd={false} />

      {sorted.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t('No results match these filters')}</p>}

      {/* Clipped rather than scrolled sideways, so the column titles can stay in view below the header. */}
      <div ref={tableBox} className={cn('hidden overflow-x-clip rounded-xl border bg-card', sorted.length > 0 && 'md:block')}>
        <table className="w-full table-fixed text-sm tabular-nums">
          <colgroup>
            <col />
            {visible.filter(c => c.key !== 'fileName').map(c => <col key={c.key} style={{ width: shownWidth(c.key as ResizableKey) }} />)}
            <col className="w-24" />
          </colgroup>
          <thead className="sticky top-(--header-height,3.5rem) z-10 bg-card shadow-[inset_0_-1px_0_var(--border)]">
            <tr>
              {visible.map(c => (
                <th key={c.key} className="group/th relative h-10 px-3 font-medium text-muted-foreground" aria-sort={sort.key === c.key ? (sort.desc ? 'descending' : 'ascending') : undefined}>
                  <div className="flex items-center gap-0.5">
                    <button type="button" onClick={() => sortBy(c.key)} className={cn('flex min-w-0 flex-1 items-center gap-1 hover:text-foreground', sort.key === c.key && 'text-foreground')}>
                      {c.label}
                      {sort.key === c.key && (sort.desc ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />)}
                    </button>
                    <ColumnFilterButton target={targets.get(c.key)!} filter={filters[c.key]} onChange={(filter) => setFilter(c.key, filter)} />
                  </div>
                  {/* The edge between two titles resizes the column after it; the name takes what's left. */}
                  {c.key !== 'fileName' && (
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={t('Resize {label}', { label: c.label })}
                      title={t('Drag to resize. Double-click to reset.')}
                      onPointerDown={(e) => startResize(e, c.key as ResizableKey)}
                      onPointerMove={moveResize}
                      onPointerUp={endResize}
                      onPointerCancel={endResize}
                      onDoubleClick={() => resetWidth(c.key as ResizableKey)}
                      className="group absolute start-0 top-0 flex h-full w-2 -translate-x-1/2 cursor-col-resize touch-none justify-center rtl:translate-x-1/2"
                    >
                      <span className="h-full w-px bg-border group-hover:bg-primary/60" />
                    </span>
                  )}
                </th>
              ))}
              <th className="w-24"><span className="sr-only">{t('Actions')}</span></th>
            </tr>
          </thead>
          <tbody>
            {shown.map(result => (
              <tr key={`${result.fileUrl}|${result.descrLink}`} className="cursor-pointer border-b last:border-0 hover:bg-muted/50" onClick={() => result.fileUrl && onAdd(result)}>
                {visible.map(c => (
                  <td key={c.key} className={cn('px-3 py-1.5', c.className)} title={c.key === 'fileName' ? result.fileName : undefined}>{c.cell(result)}</td>
                ))}
                <td className="px-2 py-1">{links(result)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 max-sm:-mx-2 md:hidden">
        {shown.map(result => (
          <li key={`${result.fileUrl}|${result.descrLink}`} className="flex items-start gap-2 rounded-xl border bg-card px-3 py-2.5">
            <button type="button" className="min-w-0 flex-1 text-start" onClick={() => result.fileUrl && onAdd(result)}>
              <span className="block text-xs text-muted-foreground">{t('{seeds} seeds · {leeches} leeches', { seeds: result.nbSeeders, leeches: result.nbLeechers })}</span>
              <span className="block text-sm font-medium wrap-anywhere">{result.fileName}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {[shows('fileSize') && formatBytes(result.fileSize), shows('engineName') && result.engineName, shows('siteUrl') && host(result.siteUrl), shows('pubDate') && published(result) > 0 && formatDateTime(published(result))].filter(Boolean).join(' · ')}
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
