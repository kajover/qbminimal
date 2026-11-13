import { readStored, writeStored } from './storage'

// qBittorrent doesn't say what each search was for, so this browser remembers it, with the plugin
// and category, so a search can be run again.
const PATTERNS_KEY = 'qbminimal.searchPatterns'

export interface SavedSearch { pattern: string; plugins: string; category: string }

export function parseSavedSearches(raw: string | null): Record<string, SavedSearch> {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).flatMap(([id, value]): [string, SavedSearch][] => {
      // Older versions kept only the text.
      if (typeof value === 'string') return [[id, { pattern: value, plugins: 'enabled', category: 'all' }]]
      const saved = value as Partial<SavedSearch> | null
      if (typeof saved?.pattern !== 'string') return []
      return [[id, {
        pattern: saved.pattern,
        plugins: typeof saved.plugins === 'string' ? saved.plugins : 'enabled',
        category: typeof saved.category === 'string' ? saved.category : 'all',
      }]]
    }))
  } catch {
    return {}
  }
}

export const readSavedSearches = () => parseSavedSearches(readStored(PATTERNS_KEY))

// Without storage the list just shows search numbers.
export function rememberSearch(id: number, search: SavedSearch) {
  writeStored(PATTERNS_KEY, JSON.stringify({ ...readSavedSearches(), [id]: search }))
}

export function forgetSearches(ids: number[]) {
  const saved = readSavedSearches()
  for (const id of ids) delete saved[id]
  writeStored(PATTERNS_KEY, Object.keys(saved).length ? JSON.stringify(saved) : null)
}

// Whether earlier searches stay in qBittorrent for reopening. Off by default, so each new search
// replaces the ones before it and they don't pile up.
const KEEP_KEY = 'qbminimal.keepSearches'
export const keepSearchesOn = () => readStored(KEEP_KEY) === 'on'
export const setKeepSearches = (on: boolean) => writeStored(KEEP_KEY, on ? 'on' : null)
