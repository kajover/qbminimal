import { COLUMN_IDS, type ColumnId } from './torrentColumns'

// The torrent list's sort, view, and page size, kept per device so the list opens the way it was left.
// Its filters aren't kept: each visit starts with every torrent showing, so none can hide unnoticed.
export type SortField = ColumnId
export type SortDirection = 'asc' | 'desc'
// 'auto' shows the table on wide screens and cards on phones.
export type ListView = 'auto' | 'table' | 'cards'
export const PAGE_SIZES = [20, 50, 100, 250] as const

export interface ListSettings {
  sortField: SortField
  sortDirection: SortDirection
  view: ListView
  pageSize: number
}

// Sorted by queue position (#), as qBittorrent sorts its list until you choose otherwise.
export const DEFAULT_LIST_SETTINGS: ListSettings = { sortField: 'priority', sortDirection: 'asc', view: 'auto', pageSize: 20 }

const STORAGE_KEY = 'qbminimal.torrentList'
// Settings saved before version 2 kept the old default sort by name, so that one is left behind.
const SETTINGS_VERSION = 2

// Anything unreadable or out of date falls back to the defaults, one value at a time.
export function parseListSettings(raw: string | null): ListSettings {
  let saved: Record<string, unknown> = {}
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    if (parsed && typeof parsed === 'object') saved = parsed as Record<string, unknown>
  } catch {
    return DEFAULT_LIST_SETTINGS
  }
  const current = saved.version === SETTINGS_VERSION
  return {
    sortField: current && COLUMN_IDS.includes(saved.sortField as SortField) ? saved.sortField as SortField : DEFAULT_LIST_SETTINGS.sortField,
    sortDirection: current && saved.sortDirection === 'desc' ? 'desc' : 'asc',
    view: saved.view === 'table' || saved.view === 'cards' ? saved.view : 'auto',
    pageSize: PAGE_SIZES.includes(saved.pageSize as typeof PAGE_SIZES[number]) ? saved.pageSize as number : DEFAULT_LIST_SETTINGS.pageSize,
  }
}

export function loadListSettings(): ListSettings {
  try {
    return parseListSettings(localStorage.getItem(STORAGE_KEY))
  } catch {
    return DEFAULT_LIST_SETTINGS
  }
}

export function saveListSettings(settings: ListSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, version: SETTINGS_VERSION }))
  } catch {
    // Private browsing can block storage. The list still works, it just won't be remembered.
  }
}
