import type { Torrent } from '@/types'
import type { ColumnFilters } from './columnFilters'
import { t } from '@/i18n'

export type StatusFilter = 'all' | 'downloading' | 'seeding' | 'completed' | 'stopped' | 'active' | 'errored'

export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: t('All statuses') },
  { value: 'downloading', label: t('Downloading') },
  { value: 'seeding', label: t('Seeding') },
  { value: 'completed', label: t('Completed') },
  { value: 'stopped', label: t('Stopped') },
  { value: 'active', label: t('Active') },
  { value: 'errored', label: t('Errored') },
]

export interface TorrentFilters {
  name: string
  status: StatusFilter
  // Empty means any category, tag, or tracker.
  category: string
  tag: string
  // A tracker host, or TRACKERLESS.
  tracker?: string
  // Set from the table's column titles, by column id.
  columns?: ColumnFilters
}

export const TRACKERLESS = '\u0000trackerless'

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

const isStopped = (state: string) => state.startsWith('paused') || state.startsWith('stopped')

function matchesStatus(torrent: Torrent, status: StatusFilter): boolean {
  const state: string = torrent.state
  switch (status) {
    case 'all':
      return true
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

export function filterTorrents(torrents: Torrent[], filters: TorrentFilters, trackerHosts: Map<string, Set<string>> = new Map()): Torrent[] {
  const name = filters.name.trim().toLowerCase()
  return torrents.filter(torrent =>
    (!name || torrent.name.toLowerCase().includes(name)) &&
    matchesStatus(torrent, filters.status) &&
    (!filters.category || torrent.category === filters.category) &&
    (!filters.tag || parseTags(torrent.tags).includes(filters.tag)) &&
    matchesTracker(torrent.hash, filters.tracker, trackerHosts)
  )
}

export interface FilterCounts {
  status: Record<StatusFilter, number>
  category: Record<string, number>
  tag: Record<string, number>
  tracker: Record<string, number>
  trackerless: number
}

// How many torrents each filter choice would show on its own, like qBittorrent's sidebar.
export function countFilterOptions(torrents: Torrent[], hosts: Map<string, Set<string>>): FilterCounts {
  const counts: FilterCounts = {
    status: Object.fromEntries(STATUS_FILTERS.map(({ value }) => [value, 0])) as Record<StatusFilter, number>,
    category: {},
    tag: {},
    tracker: Object.fromEntries([...hosts].map(([host, hashes]) => [host, hashes.size])),
    trackerless: 0,
  }
  const tracked = new Set([...hosts.values()].flatMap(hashes => [...hashes]))
  for (const torrent of torrents) {
    for (const { value } of STATUS_FILTERS) if (matchesStatus(torrent, value)) counts.status[value]++
    if (torrent.category) counts.category[torrent.category] = (counts.category[torrent.category] ?? 0) + 1
    for (const tag of parseTags(torrent.tags)) counts.tag[tag] = (counts.tag[tag] ?? 0) + 1
    if (!tracked.has(torrent.hash)) counts.trackerless++
  }
  return counts
}
