import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/NativeSelect'
import { ColumnFilterButton, ColumnFilterChips, type FilterTarget } from '@/components/ColumnFilters'
import { applyColumnFilters, choiceOptions, withFilter, type ColumnFilter, type ColumnFilters, type FilterColumn } from '@/lib/columnFilters'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { SearchResult } from '@/types'
import { t } from '@/i18n'

type SortKey = 'fileName' | 'fileSize' | 'nbSeeders' | 'nbLeechers' | 'siteUrl'

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'fileName', label: t('Name') },
  { key: 'fileSize', label: t('Size'), numeric: true },
  { key: 'nbSeeders', label: t('Seeds'), numeric: true },
  { key: 'nbLeechers', label: t('Leeches'), numeric: true },
  { key: 'siteUrl', label: t('Source') },
]

const PER_PAGE = 20
const host = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/.*$/, '')

// Each column can be filtered like the torrent table's: a text match, a range, or a choice of sites.
const FILTER_COLUMNS: FilterColumn<SearchResult>[] = [
  { id: 'fileName', label: t('Name'), kind: 'text', value: r => r.fileName },
  { id: 'fileSize', label: t('Size'), kind: 'size', value: r => (r.fileSize >= 0 ? r.fileSize : NaN) },
  { id: 'nbSeeders', label: t('Seeds'), kind: 'number', value: r => r.nbSeeders },
  { id: 'nbLeechers', label: t('Leeches'), kind: 'number', value: r => r.nbLeechers },
  { id: 'siteUrl', label: t('Source'), kind: 'set', value: r => host(r.siteUrl) },
]

// Found torrents, sortable, 20 a page: a table on wide screens and a list on phones.
export function SearchResults({ results, onAdd }: { results: SearchResult[]; onAdd: (result: SearchResult) => void }) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'nbSeeders', desc: true })
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<ColumnFilters>({})
  const setFilter = (id: string, filter: ColumnFilter | null) => {
    setFilters(current => withFilter(current, id, filter))
    setPage(1)
  }
  const targets = useMemo(() => new Map(FILTER_COLUMNS.map((column): [string, FilterTarget] => [column.id, {
    ...column,
    options: column.kind === 'set' ? () => choiceOptions(results, column) : undefined,
  }])), [results])

  const sorted = useMemo(() => {
    const value = (r: SearchResult) => (sort.key === 'siteUrl' ? host(r.siteUrl) : r[sort.key])
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
    setSort(previous => ({ key, desc: previous.key === key ? !previous.desc : COLUMNS.find(c => c.key === key)?.numeric ?? false }))
    setPage(1)
  }

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
      <div className="flex items-center justify-between gap-2 md:hidden">
        <span className="text-sm text-muted-foreground">{sorted.length === results.length ? t('{count} results', { count: results.length }) : t('{length} of {total} results', { length: sorted.length, total: results.length })}</span>
        <NativeSelect aria-label={t('Sort results')} className="h-8" value={`${sort.key}:${sort.desc ? 'desc' : 'asc'}`} onChange={(e) => {
          const [key, direction] = e.target.value.split(':')
          setSort({ key: key as SortKey, desc: direction === 'desc' })
          setPage(1)
        }}>
          {COLUMNS.flatMap(c => [
            <option key={`${c.key}:desc`} value={`${c.key}:desc`}>{c.label} {c.numeric ? t('(most first)') : t('(Z to A)')}</option>,
            <option key={`${c.key}:asc`} value={`${c.key}:asc`}>{c.label} {c.numeric ? t('(fewest first)') : t('(A to Z)')}</option>,
          ])}
        </NativeSelect>
      </div>

      {/* Wide screens filter from the column titles, so only phones need the add button. */}
      <ColumnFilterChips targets={[...targets.values()]} filters={filters} onChange={setFilter} showAdd="md:hidden" />

      {sorted.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t('No results match these filters')}</p>}

      {/* Clipped rather than scrolled sideways, so the column titles can stay in view below the header. */}
      <div className={cn('hidden overflow-x-clip rounded-xl border bg-card', sorted.length > 0 && 'md:block')}>
        <table className="w-full text-sm tabular-nums">
          <thead className="sticky top-(--header-height,3.5rem) z-10 bg-card shadow-[inset_0_-1px_0_var(--border)]">
            <tr>
              {COLUMNS.map(c => (
                <th key={c.key} className="group/th h-10 px-3 font-medium text-muted-foreground" aria-sort={sort.key === c.key ? (sort.desc ? 'descending' : 'ascending') : undefined}>
                  <div className="flex items-center gap-0.5">
                    <button type="button" onClick={() => sortBy(c.key)} className={cn('flex min-w-0 flex-1 items-center gap-1 hover:text-foreground', sort.key === c.key && 'text-foreground')}>
                      {c.label}
                      {sort.key === c.key && (sort.desc ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />)}
                    </button>
                    <ColumnFilterButton target={targets.get(c.key)!} filter={filters[c.key]} onChange={(filter) => setFilter(c.key, filter)} />
                  </div>
                </th>
              ))}
              <th className="w-24"><span className="sr-only">{t('Actions')}</span></th>
            </tr>
          </thead>
          <tbody>
            {shown.map(result => (
              <tr key={`${result.fileUrl}|${result.descrLink}`} className="cursor-pointer border-b last:border-0 hover:bg-muted/50" onClick={() => result.fileUrl && onAdd(result)}>
                <td className="max-w-[28rem] truncate px-3 py-1.5" title={result.fileName}>{result.fileName}</td>
                <td className="px-3 py-1.5">{formatBytes(result.fileSize)}</td>
                <td className="px-3 py-1.5 text-green-600 dark:text-green-400">{result.nbSeeders}</td>
                <td className="px-3 py-1.5 text-red-500">{result.nbLeechers}</td>
                <td className="max-w-[12rem] truncate px-3 py-1.5 text-muted-foreground">{host(result.siteUrl)}</td>
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
              <span className="block truncate text-xs text-muted-foreground">{formatBytes(result.fileSize)} · {host(result.siteUrl)}</span>
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
