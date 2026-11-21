import { COLUMN_IDS, type ColumnId } from './torrentColumns'
import { readStored, writeStored } from './storage'

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
// 50 at a time, with the pages bar below; the search results show as many.
export const DEFAULT_PAGE_SIZE = 50
export const DEFAULT_LIST_SETTINGS: ListSettings = { sortField: 'priority', sortDirection: 'asc', view: 'auto', pageSize: DEFAULT_PAGE_SIZE }

const STORAGE_KEY = 'qbminimal.torrentList'
// Settings saved before version 2 kept the old default sort by name, so that one is left behind.
// Before version 3 every list saved the old default of 20 a page, so that one is too.
const SETTINGS_VERSION = 3

// Anything unreadable or out of date falls back to the defaults, one value at a time.
export function parseListSettings(raw: string | null): ListSettings {
  let saved: Record<string, unknown> = {}
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    if (parsed && typeof parsed === 'object') saved = parsed as Record<string, unknown>
  } catch {
    return DEFAULT_LIST_SETTINGS
  }
  const current = saved.version === SETTINGS_VERSION || saved.version === 2
  const pageSize = saved.version === 2 && saved.pageSize === 20 ? DEFAULT_PAGE_SIZE : saved.pageSize
  return {
    sortField: current && COLUMN_IDS.includes(saved.sortField as SortField) ? saved.sortField as SortField : DEFAULT_LIST_SETTINGS.sortField,
    sortDirection: current && saved.sortDirection === 'desc' ? 'desc' : 'asc',
    view: saved.view === 'table' || saved.view === 'cards' ? saved.view : 'auto',
    pageSize: PAGE_SIZES.includes(pageSize as typeof PAGE_SIZES[number]) ? pageSize as number : DEFAULT_PAGE_SIZE,
  }
}

// The search results' page size, kept on this device.
const SEARCH_PAGE_SIZE_KEY = 'qbminimal.searchPageSize'
export function loadSearchPageSize(): number {
  const saved = Number(readStored(SEARCH_PAGE_SIZE_KEY))
  return PAGE_SIZES.includes(saved as typeof PAGE_SIZES[number]) ? saved : DEFAULT_PAGE_SIZE
}
export const saveSearchPageSize = (size: number) => writeStored(SEARCH_PAGE_SIZE_KEY, size === DEFAULT_PAGE_SIZE ? null : String(size))

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

// The pages bar's room at its sides, so its text starts at the inside of the checkboxes' border
// (9px in from the table's edge), and its arrows end as far from the other side: inside the table,
// or below it, past its 1px border.
export const PAGE_BAR_IN_TABLE = 'px-[calc(0.5rem+1px)] py-1.5'
export const PAGE_BAR_BELOW_TABLE = 'px-[calc(0.5rem+2px)]'
