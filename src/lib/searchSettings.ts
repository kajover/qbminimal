import { readStored, writeStored } from './storage'

// How the search results are sorted, which columns show and how wide they are, kept on this device like the
// torrent list's. Anything unreadable falls back to the defaults.

export type SearchSortKey = 'fileName' | 'fileSize' | 'nbSeeders' | 'nbLeechers' | 'engineName' | 'siteUrl' | 'pubDate'
export const SEARCH_SORT_KEYS: SearchSortKey[] = ['fileName', 'fileSize', 'nbSeeders', 'nbLeechers', 'engineName', 'siteUrl', 'pubDate']
export interface SearchSort { key: SearchSortKey; desc: boolean }
// Most seeds first, as those download best.
export const DEFAULT_SEARCH_SORT: SearchSort = { key: 'nbSeeders', desc: true }

// The columns after the name, which takes the room left over.
export type ResizableSearchColumn = Exclude<SearchSortKey, 'fileName'>
export const DEFAULT_SEARCH_WIDTHS: Record<ResizableSearchColumn, number> = { fileSize: 110, nbSeeders: 96, nbLeechers: 104, engineName: 130, siteUrl: 170, pubDate: 160 }
export const MIN_SEARCH_WIDTH = 72

const SORT_KEY = 'qbminimal.searchSort'
const WIDTHS_KEY = 'qbminimal.searchColumns'
const HIDDEN_KEY = 'qbminimal.searchHiddenColumns'

const readJson = (raw: string | null): Record<string, unknown> => {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

export function parseSearchSort(raw: string | null): SearchSort {
  const saved = readJson(raw)
  return SEARCH_SORT_KEYS.includes(saved.key as SearchSortKey) && typeof saved.desc === 'boolean'
    ? { key: saved.key as SearchSortKey, desc: saved.desc }
    : DEFAULT_SEARCH_SORT
}

export function parseSearchWidths(raw: string | null): Record<ResizableSearchColumn, number> {
  const saved = readJson(raw)
  return Object.fromEntries(Object.entries(DEFAULT_SEARCH_WIDTHS).map(([key, width]) => {
    const value = saved[key]
    return [key, typeof value === 'number' && Number.isFinite(value) && value >= MIN_SEARCH_WIDTH ? Math.round(value) : width]
  })) as Record<ResizableSearchColumn, number>
}

export const loadSearchSort = () => parseSearchSort(readStored(SORT_KEY))
// The default isn't stored, so a later change of default reaches everyone who kept it.
export const saveSearchSort = (sort: SearchSort) =>
  writeStored(SORT_KEY, sort.key === DEFAULT_SEARCH_SORT.key && sort.desc === DEFAULT_SEARCH_SORT.desc ? null : JSON.stringify(sort))

export const loadSearchWidths = () => parseSearchWidths(readStored(WIDTHS_KEY))
export const saveSearchWidths = (widths: Record<ResizableSearchColumn, number>) => writeStored(WIDTHS_KEY, JSON.stringify(widths))

// Every column but the name can be hidden.
export function parseSearchHidden(raw: string | null): ResizableSearchColumn[] {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? SEARCH_SORT_KEYS.filter((key): key is ResizableSearchColumn => key !== 'fileName' && parsed.includes(key)) : []
  } catch {
    return []
  }
}

export const loadSearchHidden = () => parseSearchHidden(readStored(HIDDEN_KEY))
export const saveSearchHidden = (hidden: ResizableSearchColumn[]) => writeStored(HIDDEN_KEY, hidden.length ? JSON.stringify(hidden) : null)
