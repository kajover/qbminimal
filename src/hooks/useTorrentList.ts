import { useEffect, useMemo, useState } from 'react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { DEFAULT_LIST_SETTINGS, loadListSettings, saveListSettings, type ListView, type SortDirection, type SortField } from '@/lib/listSettings'
import { compareTorrents, TORRENT_FILTER_COLUMNS } from '@/lib/torrentColumns'
import { activeCount, applyColumnFilters, loadColumnFilters, saveColumnFilters, withFilter, type ColumnFilter } from '@/lib/columnFilters'
import { countFilterOptions, filterTorrents, groupTrackersByHost, type TorrentFilters } from '@/lib/torrentFilters'
import type { Torrent } from '@/types'

// Matches --breakpoint-md in index.css.
const WIDE_SCREEN = '(min-width: 1200px)'

const NO_FILTERS: TorrentFilters = { name: '', status: 'all', category: '', tag: '', tracker: '', columns: {} }
const COLUMN_FILTERS_TABLE = 'torrents'

// Everything about how the torrent list is narrowed, ordered, split into pages, and shown.
// All of it except the name search is remembered on this device, the column filters included.
export function useTorrentList(torrents: Torrent[], trackerMap: Record<string, string[]> | undefined) {
  const [saved] = useState(loadListSettings)
  const [filters, setFilters] = useState<TorrentFilters>(() => ({ ...NO_FILTERS, status: saved.status, category: saved.category, tag: saved.tag, tracker: saved.tracker, columns: loadColumnFilters(COLUMN_FILTERS_TABLE) }))
  const [sort, setSort] = useState<{ field: SortField; direction: SortDirection }>({ field: saved.sortField, direction: saved.sortDirection })
  const [view, setView] = useState<ListView>(saved.view)
  const [pageSize, setPageSize] = useState(saved.pageSize)
  const [requestedPage, setRequestedPage] = useState(1)
  const wide = useMediaQuery(WIDE_SCREEN)

  useEffect(() => {
    saveListSettings({ sortField: sort.field, sortDirection: sort.direction, status: filters.status, category: filters.category, tag: filters.tag, tracker: filters.tracker ?? '', view, pageSize })
  }, [sort, filters.status, filters.category, filters.tag, filters.tracker, view, pageSize])
  useEffect(() => { saveColumnFilters(COLUMN_FILTERS_TABLE, filters.columns ?? {}) }, [filters.columns])

  const hosts = useMemo(() => groupTrackersByHost(trackerMap ?? {}), [trackerMap])
  const counts = useMemo(() => countFilterOptions(torrents, hosts), [torrents, hosts])

  const matching = useMemo(() => {
    const sign = sort.direction === 'asc' ? 1 : -1
    // Equal values fall back to the name, so rows don't trade places on every refresh.
    return applyColumnFilters(filterTorrents(torrents, filters, hosts), TORRENT_FILTER_COLUMNS, filters.columns ?? {}).sort((a, b) =>
      sign * (compareTorrents(a, b, sort.field) || compareTorrents(a, b, 'name')))
  }, [torrents, filters, hosts, sort])

  const pageCount = Math.max(1, Math.ceil(matching.length / pageSize))
  // The list can shrink under a later page, for example after deleting.
  const page = Math.min(requestedPage, pageCount)

  return {
    filters,
    setFilter: <K extends keyof TorrentFilters>(key: K, value: TorrentFilters[K]) => {
      setFilters(current => ({ ...current, [key]: value }))
      setRequestedPage(1)
    },
    setColumnFilter: (id: string, filter: ColumnFilter | null) => {
      setFilters(current => ({ ...current, columns: withFilter(current.columns ?? {}, id, filter) }))
      setRequestedPage(1)
    },
    // A saved view sets them all at once.
    applyFilters: (next: TorrentFilters) => {
      setFilters({ ...NO_FILTERS, ...next })
      setRequestedPage(1)
    },
    clearFilters: () => {
      setFilters(NO_FILTERS)
      setRequestedPage(1)
    },
    filtered: !!filters.name.trim() || filters.status !== 'all' || !!filters.category || !!filters.tag || !!filters.tracker || activeCount(filters.columns) > 0,
    counts,
    trackerHosts: [...hosts.keys()].sort(),
    sort,
    // Picking the sorted column again flips the direction.
    sortBy: (field: SortField) => {
      setSort(current => ({ field, direction: current.field === field && current.direction === 'asc' ? 'desc' : 'asc' }))
      setRequestedPage(1)
    },
    // Back to qBittorrent's queue order, as on first use.
    resetSort: () => {
      setSort({ field: DEFAULT_LIST_SETTINGS.sortField, direction: DEFAULT_LIST_SETTINGS.sortDirection })
      setRequestedPage(1)
    },
    // 'auto' follows the screen: the table when wide, cards on phones.
    showTable: view === 'table' || (view === 'auto' && wide),
    showAsTable: (table: boolean) => setView(table === wide ? 'auto' : table ? 'table' : 'cards'),
    matching,
    rows: matching.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageCount,
    setPage: setRequestedPage,
    pageSize,
    setPageSize: (size: number) => {
      setPageSize(size)
      setRequestedPage(1)
    },
  }
}

export type TorrentList = ReturnType<typeof useTorrentList>
