import { useEffect, useMemo, useState } from 'react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { ROOM_FOR_TABLE } from '@/lib/pageScroll'
import { DEFAULT_LIST_SETTINGS, loadListSettings, saveListSettings, type ListView, type SortDirection, type SortField } from '@/lib/listSettings'
import { compareTorrents, TORRENT_FILTER_COLUMNS } from '@/lib/torrentColumns'
import { activeCount, applyColumnFilters, loadColumnFilters, saveColumnFilters, withFilter, type ColumnFilter } from '@/lib/columnFilters'
import { countFilterOptions, cycleChoice, excludeChoice, filterTorrents, searchTorrents, withoutSidebarColumns, groupTrackersByHost, hasSidebarFilters, NO_FILTERS, type FilterList, type TorrentFilters } from '@/lib/torrentFilters'
import type { Torrent } from '@/types'

const COLUMN_FILTERS_TABLE = 'torrents'

// Everything about how the torrent list is narrowed, ordered, and shown.
// The sort, view, and column filters, which show as chips, are remembered on this device;
// the other filters start cleared on each visit.
export function useTorrentList(torrents: Torrent[], trackerMap: Record<string, string[]> | undefined) {
  const [saved] = useState(loadListSettings)
  // The quick search narrows the list for a moment, apart from the filters: views don't keep it.
  // What's typed (the draft) applies after a 500ms pause, or at once on Enter.
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<TorrentFilters>(() => ({ ...NO_FILTERS, columns: withoutSidebarColumns(loadColumnFilters(COLUMN_FILTERS_TABLE)) }))
  const [sort, setSort] = useState<{ field: SortField; direction: SortDirection }>({ field: saved.sortField, direction: saved.sortDirection })
  // Whether the sort shows in the column titles: once one is picked, even the default queue order,
  // but not on first load in the default order or after a reset.
  const [sortShown, setSortShown] = useState(saved.sortField !== DEFAULT_LIST_SETTINGS.sortField || saved.sortDirection !== DEFAULT_LIST_SETTINGS.sortDirection)
  const [view, setView] = useState<ListView>(saved.view)
  // Counts each new filter, search or sort, so a long list of cards starts again from its top.
  const [restarts, setRestarts] = useState(0)
  const restart = () => setRestarts(n => n + 1)
  const roomy = useMediaQuery(ROOM_FOR_TABLE)

  // The draft becomes the search after a pause in typing.
  useEffect(() => {
    if (draft === query) return
    const timer = setTimeout(() => {
      setQuery(draft)
      setRestarts(n => n + 1)
    }, 500)
    return () => clearTimeout(timer)
  }, [draft, query])

  useEffect(() => {
    saveListSettings({ sortField: sort.field, sortDirection: sort.direction, view })
  }, [sort, view])
  useEffect(() => { saveColumnFilters(COLUMN_FILTERS_TABLE, filters.columns ?? {}) }, [filters.columns])

  const hosts = useMemo(() => groupTrackersByHost(trackerMap ?? {}), [trackerMap])
  const counts = useMemo(() => countFilterOptions(torrents, hosts), [torrents, hosts])

  const matching = useMemo(() => {
    const sign = sort.direction === 'asc' ? 1 : -1
    // Equal values fall back to the name, so rows don't trade places on every refresh.
    return applyColumnFilters(searchTorrents(filterTorrents(torrents, filters, hosts), query, hosts), TORRENT_FILTER_COLUMNS, filters.columns ?? {}).sort((a, b) =>
      sign * (compareTorrents(a, b, sort.field) || compareTorrents(a, b, 'name')))
  }, [torrents, filters, query, hosts, sort])

  return {
    filters,
    query,
    draft,
    setDraft,
    // Searches for what's typed now, without waiting for the pause.
    searchNow: () => {
      setQuery(draft)
      restart()
    },
    // Sets both at once, for emptying the search.
    setQuery: (text: string) => {
      setDraft(text)
      setQuery(text)
      restart()
    },
    setFilter: <K extends keyof TorrentFilters>(key: K, value: TorrentFilters[K]) => {
      setFilters(current => ({ ...current, [key]: value }))
      restart()
    },
    // Picks a choice in the sidebar, or lets it go again.
    toggleFilter: (key: FilterList, value: string) => {
      setFilters(current => cycleChoice(current, key, value))
      restart()
    },
    // Hides the torrents a choice matches, or stops hiding them.
    excludeFilter: (key: FilterList, value: string) => {
      setFilters(current => excludeChoice(current, key, value))
      restart()
    },
    setColumnFilter: (id: string, filter: ColumnFilter | null) => {
      setFilters(current => ({ ...current, columns: withFilter(current.columns ?? {}, id, filter) }))
      restart()
    },
    // A saved view sets them all at once.
    applyFilters: (next: TorrentFilters) => {
      setFilters({ ...NO_FILTERS, ...next, columns: withoutSidebarColumns(next.columns) })
      restart()
    },
    clearFilters: () => {
      setDraft('')
      setQuery('')
      setFilters(NO_FILTERS)
      restart()
    },
    // The sidebar's choices only, keeping the column filters.
    clearSidebarFilters: () => {
      setFilters(current => ({ ...NO_FILTERS, columns: current.columns }))
      restart()
    },
    clearColumnFilters: () => {
      setFilters(current => ({ ...current, columns: {} }))
      restart()
    },
    sidebarFiltered: hasSidebarFilters(filters),
    columnFiltered: activeCount(filters.columns) > 0,
    filtered: hasSidebarFilters(filters) || activeCount(filters.columns) > 0,
    // The quick search and the filters, each marked on its own button.
    searched: !!query.trim(),
    narrowed: hasSidebarFilters(filters) || activeCount(filters.columns) > 0,
    counts,
    trackerHosts: [...hosts.keys()].sort(),
    sort,
    sortShown,
    // Picking the sorted column again flips the direction. A first pick of the default column,
    // while its order isn't shown yet, shows it as it is.
    sortBy: (field: SortField) => {
      setSort(current => (!sortShown && current.field === field ? current : { field, direction: current.field === field && current.direction === 'asc' ? 'desc' : 'asc' }))
      setSortShown(true)
      restart()
    },
    // Back to qBittorrent's queue order, as on first use.
    resetSort: () => {
      setSort({ field: DEFAULT_LIST_SETTINGS.sortField, direction: DEFAULT_LIST_SETTINGS.sortDirection })
      setSortShown(false)
      restart()
    },
    // 'auto' follows the screen: the table where it fits, cards on phones.
    showTable: view === 'table' || (view === 'auto' && roomy),
    showAsTable: (table: boolean) => setView(table === roomy ? 'auto' : table ? 'table' : 'cards'),
    matching,
    restarts,
  }
}

export type TorrentList = ReturnType<typeof useTorrentList>
