import { readStored, writeStored } from './storage'
import { FILTER_LISTS, STATUS_FILTERS, type FilterList, type StatusFilter, type TorrentFilters } from './torrentFilters'
import { parseColumnFilters, sameColumnFilters } from './columnFilters'

// Named sets of filters, like "Downloading in Movies", one tap away above the torrent list.
export interface FilterView {
  name: string
  filters: TorrentFilters
}

const STORAGE_KEY = 'qbminimal.filterViews'
const text = (value: unknown) => (typeof value === 'string' ? value : '')
const isStatus = (value: unknown): value is StatusFilter => STATUS_FILTERS.some(option => option.value === value)
// A list of texts, or, from views saved before the sidebar allowed several, a single one ('' or
// 'all' meaning none).
const texts = (list: unknown, single: unknown): string[] =>
  Array.isArray(list) ? [...new Set(list.filter((item): item is string => typeof item === 'string'))]
    : typeof single === 'string' && single && single !== 'all' ? [single] : []

function parseExcluded(raw: unknown): Partial<Record<FilterList, string[]>> {
  if (!raw || typeof raw !== 'object') return {}
  const lists = raw as Record<string, unknown>
  return Object.fromEntries(FILTER_LISTS.map(list => {
    const values = texts(lists[list], undefined)
    return [list, list === 'statuses' ? values.filter(isStatus) : values]
  }).filter(([, values]) => values.length > 0))
}

// Anything unreadable is left out rather than breaking the list.
export function parseFilterViews(raw: string | null): FilterView[] {
  let parsed: unknown
  try {
    parsed = raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return parsed.flatMap((item): FilterView[] => {
    if (!item || typeof item !== 'object') return []
    const { name, filters } = item as { name?: unknown; filters?: Record<string, unknown> }
    if (typeof name !== 'string' || !name.trim() || !filters || typeof filters !== 'object') return []
    return [{
      name: name.trim(),
      filters: {
        name: text(filters.name),
        statuses: texts(filters.statuses, filters.status).filter(isStatus),
        categories: texts(filters.categories, filters.category),
        tags: texts(filters.tags, filters.tag),
        trackers: texts(filters.trackers, filters.tracker),
        excluded: parseExcluded(filters.excluded),
        columns: parseColumnFilters(filters.columns),
      },
    }]
  })
}

export const loadFilterViews = () => parseFilterViews(readStored(STORAGE_KEY))
export const saveFilterViews = (views: FilterView[]) => writeStored(STORAGE_KEY, JSON.stringify(views))

// The same choices in any order.
const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every(item => b.includes(item))

export function sameFilters(a: TorrentFilters, b: TorrentFilters) {
  return a.name.trim() === b.name.trim() && sameSet(a.statuses, b.statuses) && sameSet(a.categories, b.categories) &&
    sameSet(a.tags, b.tags) && sameSet(a.trackers, b.trackers) && sameColumnFilters(a.columns, b.columns) &&
    FILTER_LISTS.every(list => sameSet(a.excluded?.[list] ?? [], b.excluded?.[list] ?? []))
}

// A view with the same name is replaced, so saving again updates it.
export function upsertView(views: FilterView[], view: FilterView): FilterView[] {
  const index = views.findIndex(existing => existing.name.toLowerCase() === view.name.toLowerCase())
  if (index < 0) return [...views, view]
  return views.map((existing, i) => (i === index ? view : existing))
}
