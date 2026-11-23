import { readStored, writeStored } from './storage'
import { isShownView, type ShownView } from './listSettings'

// How the search results are shown, sorted, which columns show and how wide they are, kept on this
// device like the torrent list's. Anything unreadable falls back to the defaults.

export type SearchSortKey = 'fileName' | 'fileSize' | 'nbSeeders' | 'nbLeechers' | 'engineName' | 'pubDate'
export const SEARCH_SORT_KEYS: SearchSortKey[] = ['fileName', 'fileSize', 'nbSeeders', 'nbLeechers', 'engineName', 'pubDate']
export interface SearchSort { key: SearchSortKey; desc: boolean }
// Each search starts with the most seeds first, as those download best.
export const DEFAULT_SEARCH_SORT: SearchSort = { key: 'nbSeeders', desc: true }

// The columns that can be hidden: every one but the name.
export type ResizableSearchColumn = Exclude<SearchSortKey, 'fileName'>
// Columns fit their content and the name takes the room left, until one is resized by hand: only
// those widths are kept. These stand in until the content is measured.
export type SearchWidths = Partial<Record<SearchSortKey, number>>
export const FALLBACK_SEARCH_WIDTHS: Record<SearchSortKey, number> = { fileName: 480, fileSize: 110, nbSeeders: 112, nbLeechers: 112, engineName: 130, pubDate: 160 }
export const MIN_SEARCH_WIDTH = 72

// The old key held a width for every column, which would keep them from fitting.
const WIDTHS_KEY = 'qbminimal.searchWidths'
const OLD_WIDTHS_KEY = 'qbminimal.searchColumns'
const HIDDEN_KEY = 'qbminimal.searchHiddenColumns'
const ORDER_KEY = 'qbminimal.searchColumnOrder'

// The columns' order, as dragged. Anything unreadable, or missing a column, goes back to the default.
export function parseSearchOrder(raw: string | null): SearchSortKey[] {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (Array.isArray(parsed) && parsed.length === SEARCH_SORT_KEYS.length && SEARCH_SORT_KEYS.every(key => parsed.includes(key))) return parsed as SearchSortKey[]
  } catch {
    // The default below.
  }
  return [...SEARCH_SORT_KEYS]
}
export const loadSearchOrder = () => parseSearchOrder(readStored(ORDER_KEY))
export const saveSearchOrder = (order: SearchSortKey[]) =>
  writeStored(ORDER_KEY, order.every((key, i) => key === SEARCH_SORT_KEYS[i]) ? null : JSON.stringify(order))
const VIEW_KEY = 'qbminimal.searchView'

const readJson = (raw: string | null): Record<string, unknown> => {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

export function parseSearchWidths(raw: string | null): SearchWidths {
  const saved = readJson(raw)
  return Object.fromEntries(SEARCH_SORT_KEYS.flatMap(key => {
    const value = saved[key]
    return typeof value === 'number' && Number.isFinite(value) && value >= MIN_SEARCH_WIDTH ? [[key, Math.round(value)]] : []
  }))
}

export const loadSearchWidths = () => parseSearchWidths(readStored(WIDTHS_KEY))
export const saveSearchWidths = (widths: SearchWidths) => {
  writeStored(OLD_WIDTHS_KEY, null)
  writeStored(WIDTHS_KEY, Object.keys(widths).length ? JSON.stringify(widths) : null)
}

// Every column but the name can be hidden. The date starts hidden, as few plugins send it.
export const DEFAULT_SEARCH_HIDDEN: ResizableSearchColumn[] = ['pubDate']

export function parseSearchHidden(raw: string | null): ResizableSearchColumn[] {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? SEARCH_SORT_KEYS.filter((key): key is ResizableSearchColumn => key !== 'fileName' && parsed.includes(key)) : DEFAULT_SEARCH_HIDDEN
  } catch {
    return DEFAULT_SEARCH_HIDDEN
  }
}

export const loadSearchHidden = () => parseSearchHidden(readStored(HIDDEN_KEY))
export const saveSearchHidden = (hidden: ResizableSearchColumn[]) =>
  writeStored(HIDDEN_KEY, hidden.length === DEFAULT_SEARCH_HIDDEN.length && hidden.every(key => DEFAULT_SEARCH_HIDDEN.includes(key)) ? null : JSON.stringify(hidden))

// The table, the compact table or cards; without a choice, the table on wide screens and cards
// on phones.
export type SearchView = ShownView
export const loadSearchView = (): SearchView | null => {
  const saved = readStored(VIEW_KEY)
  return isShownView(saved) ? saved : null
}
export const saveSearchView = (view: SearchView | null) => writeStored(VIEW_KEY, view)
