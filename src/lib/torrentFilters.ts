import type { Torrent } from '@/types'
import type { ColumnFilters } from './columnFilters'
import { t } from '@/i18n'

export type StatusFilter = 'downloading' | 'seeding' | 'completed' | 'stopped' | 'active' | 'errored'

export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'downloading', label: t('Downloading') },
  { value: 'seeding', label: t('Seeding') },
  { value: 'completed', label: t('Completed') },
  { value: 'stopped', label: t('Stopped') },
  { value: 'active', label: t('Active') },
  { value: 'errored', label: t('Errored') },
]

// Each list holds the choices picked in the filter sidebar. A torrent shows when it matches any
// choice in a list, in every list that has some; an empty list doesn't narrow anything.
export interface TorrentFilters {
  name: string
  statuses: StatusFilter[]
  // Category names, with UNCATEGORIZED for torrents without one.
  categories: string[]
  // Tag names, with UNTAGGED for torrents without any.
  tags: string[]
  // Tracker hosts, with TRACKERLESS for torrents without a tracker.
  trackers: string[]
  // Set from the table's column titles, by column id.
  columns?: ColumnFilters
}

export const NO_FILTERS: TorrentFilters = { name: '', statuses: [], categories: [], tags: [], trackers: [], columns: {} }

// Stand-ins for "none", which no real category, tag or tracker host can be named.
export const UNCATEGORIZED = '\u0000uncategorized'
export const UNTAGGED = '\u0000untagged'
export const TRACKERLESS = '\u0000trackerless'

// The lists the sidebar can toggle choices in.
export type FilterList = 'statuses' | 'categories' | 'tags' | 'trackers'

// Adds a choice to a list, or takes it out again.
export const toggleChoice = <T,>(list: readonly T[], value: T): T[] => (list.includes(value) ? list.filter(item => item !== value) : [...list, value])

// Whether any filter besides the column filters narrows the list.
export const hasSidebarFilters = (filters: TorrentFilters) =>
  !!filters.name.trim() || filters.statuses.length > 0 || filters.categories.length > 0 || filters.tags.length > 0 || filters.trackers.length > 0

export function getTrackerHost(url: string): string {
  try {
    return new URL(url).hostname || url
  } catch {
    return url
  }
}

// Tracker hosts and the torrents that use them, from sync/maindata's tracker map.
export function groupTrackersByHost(trackers: Record<string, string[]>): Map<string, Set<string>> {
  const hosts = new Map<string, Set<string>>()
  for (const [url, hashes] of Object.entries(trackers)) {
    const host = getTrackerHost(url)
    const set = hosts.get(host) ?? new Set<string>()
    hashes.forEach(hash => set.add(hash))
    hosts.set(host, set)
  }
  return hosts
}

export function matchesTracker(hash: string, tracker: string | undefined, hosts: Map<string, Set<string>>): boolean {
  if (!tracker) return true
  if (tracker === TRACKERLESS) return ![...hosts.values()].some(set => set.has(hash))
  return hosts.get(tracker)?.has(hash) ?? false
}

const matchesCategory = (torrent: Torrent, category: string) => (category === UNCATEGORIZED ? !torrent.category : torrent.category === category)
const matchesTag = (tags: string[], tag: string) => (tag === UNTAGGED ? tags.length === 0 : tags.includes(tag))

const isStopped = (state: string) => state.startsWith('paused') || state.startsWith('stopped')

function matchesStatus(torrent: Torrent, status: StatusFilter): boolean {
  const state: string = torrent.state
  switch (status) {
    case 'downloading':
      return ['downloading', 'forcedDL', 'metaDL', 'forcedMetaDL', 'stalledDL', 'queuedDL', 'allocating'].includes(state)
    case 'seeding':
      return ['uploading', 'forcedUP', 'stalledUP', 'queuedUP'].includes(state)
    case 'completed':
      return torrent.progress >= 1
    case 'stopped':
      return isStopped(state)
    case 'active':
      return torrent.dlspeed > 0 || torrent.upspeed > 0
    case 'errored':
      return state === 'error' || state === 'missingFiles'
  }
}

export function parseTags(tags: string | undefined): string[] {
  return (tags ?? '').split(',').map(tag => tag.trim()).filter(Boolean)
}

// Any choice in a list matches; an empty list matches everything.
const any = <T,>(choices: readonly T[], matches: (choice: T) => boolean) => choices.length === 0 || choices.some(matches)

// The tracker hosts of each torrent, by hash.
function hostsByHash(trackerHosts: Map<string, Set<string>>) {
  const byHash = new Map<string, string[]>()
  for (const [host, hashes] of trackerHosts) for (const hash of hashes) byHash.set(hash, [...(byHash.get(hash) ?? []), host])
  return byHash
}

// The torrents whose name, category, tags or trackers' hosts contain the text, for the quick search
// and for a name filter kept in a saved view.
export function searchTorrents(torrents: Torrent[], search: string, trackerHosts: Map<string, Set<string>> = new Map()): Torrent[] {
  const text = search.trim().toLowerCase()
  if (!text) return torrents
  const hosts = hostsByHash(trackerHosts)
  return torrents.filter(torrent =>
    [torrent.name, torrent.category ?? '', ...parseTags(torrent.tags), ...(hosts.get(torrent.hash) ?? [])].some(value => value.toLowerCase().includes(text)))
}

export function filterTorrents(torrents: Torrent[], filters: TorrentFilters, trackerHosts: Map<string, Set<string>> = new Map()): Torrent[] {
  return searchTorrents(torrents, filters.name, trackerHosts).filter(torrent => {
    const tags = parseTags(torrent.tags)
    return any(filters.statuses, status => matchesStatus(torrent, status)) &&
      any(filters.categories, category => matchesCategory(torrent, category)) &&
      any(filters.tags, tag => matchesTag(tags, tag)) &&
      any(filters.trackers, tracker => matchesTracker(torrent.hash, tracker, trackerHosts))
  })
}

export interface FilterCounts {
  all: number
  status: Record<StatusFilter, number>
  // Keyed by name, with UNCATEGORIZED and UNTAGGED for the torrents without one.
  category: Record<string, number>
  tag: Record<string, number>
  tracker: Record<string, number>
  trackerless: number
}

// How many torrents each filter choice would show on its own, like qBittorrent's sidebar.
export function countFilterOptions(torrents: Torrent[], hosts: Map<string, Set<string>>): FilterCounts {
  const counts: FilterCounts = {
    all: torrents.length,
    status: Object.fromEntries(STATUS_FILTERS.map(({ value }) => [value, 0])) as Record<StatusFilter, number>,
    category: {},
    tag: {},
    tracker: Object.fromEntries([...hosts].map(([host, hashes]) => [host, hashes.size])),
    trackerless: 0,
  }
  const tracked = new Set([...hosts.values()].flatMap(hashes => [...hashes]))
  for (const torrent of torrents) {
    for (const { value } of STATUS_FILTERS) if (matchesStatus(torrent, value)) counts.status[value]++
    const category = torrent.category || UNCATEGORIZED
    counts.category[category] = (counts.category[category] ?? 0) + 1
    const tags = parseTags(torrent.tags)
    for (const tag of tags.length ? tags : [UNTAGGED]) counts.tag[tag] = (counts.tag[tag] ?? 0) + 1
    if (!tracked.has(torrent.hash)) counts.trackerless++
  }
  return counts
}
