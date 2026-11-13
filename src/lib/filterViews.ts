import { readStored, writeStored } from './storage'
import { STATUS_FILTERS, type StatusFilter, type TorrentFilters } from './torrentFilters'
import { parseColumnFilters, sameColumnFilters } from './columnFilters'

// Named sets of filters, like "Downloading in Movies", one tap away above the torrent list.
export interface FilterView {
  name: string
  filters: TorrentFilters
}

const STORAGE_KEY = 'qbminimal.filterViews'
const text = (value: unknown) => (typeof value === 'string' ? value : '')

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
    const status = STATUS_FILTERS.some(option => option.value === filters.status) ? filters.status as StatusFilter : 'all'
    return [{ name: name.trim(), filters: { name: text(filters.name), status, category: text(filters.category), tag: text(filters.tag), tracker: text(filters.tracker), columns: parseColumnFilters(filters.columns) } }]
  })
}

export const loadFilterViews = () => parseFilterViews(readStored(STORAGE_KEY))
export const saveFilterViews = (views: FilterView[]) => writeStored(STORAGE_KEY, JSON.stringify(views))

export function sameFilters(a: TorrentFilters, b: TorrentFilters) {
  return a.name.trim() === b.name.trim() && a.status === b.status && a.category === b.category && a.tag === b.tag && (a.tracker ?? '') === (b.tracker ?? '') && sameColumnFilters(a.columns, b.columns)
}

// A view with the same name is replaced, so saving again updates it.
export function upsertView(views: FilterView[], view: FilterView): FilterView[] {
  const index = views.findIndex(existing => existing.name.toLowerCase() === view.name.toLowerCase())
  if (index < 0) return [...views, view]
  return views.map((existing, i) => (i === index ? view : existing))
}
