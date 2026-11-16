import { describe, expect, it } from 'vitest'
import { countFilterOptions, filterTorrents, parseTags, searchMatcher, type TorrentFilters, getTrackerHost, groupTrackersByHost, matchesTracker, NO_FILTERS, toggleChoice, TRACKERLESS, UNCATEGORIZED, UNTAGGED } from './torrentFilters'
import type { Torrent } from '@/types'

const torrent = (over: Partial<Torrent>) => ({ name: 'Ubuntu', state: 'downloading', progress: 0.5, dlspeed: 0, upspeed: 0, category: '', tags: '', ...over }) as Torrent
const names = (list: Torrent[], filters: Partial<TorrentFilters>, hosts?: Map<string, Set<string>>) => filterTorrents(list, { ...NO_FILTERS, ...filters }, hosts).map(t => t.name)

describe('filterTorrents', () => {
  const list = [
    torrent({ hash: 'u', name: 'Ubuntu ISO', state: 'stalledUP', progress: 1, category: 'linux', tags: 'iso, stable' }),
    torrent({ hash: 'f', name: 'Fedora', state: 'downloading', dlspeed: 10, category: 'linux' }),
    torrent({ name: 'Old', state: 'stoppedUP', progress: 1 }),
    torrent({ name: 'Broken', state: 'missingFiles' }),
  ]

  it('keeps everything without filters', () => expect(names(list, {})).toHaveLength(4))
  it('matches names regardless of case', () => expect(names(list, { name: ' ubuntu ' })).toEqual(['Ubuntu ISO']))
  it('searches categories, tags and tracker hosts too', () => {
    expect(names(list, { name: 'LINUX' })).toEqual(['Ubuntu ISO', 'Fedora'])
    expect(names(list, { name: 'stab' })).toEqual(['Ubuntu ISO'])
    expect(names(list, { name: 'example' }, new Map([['tracker.example.org', new Set(['f'])]]))).toEqual(['Fedora'])
  })
  it('groups seeding states', () => expect(names(list, { statuses: ['seeding'] })).toEqual(['Ubuntu ISO']))
  it('finds stopped torrents', () => expect(names(list, { statuses: ['stopped'] })).toEqual(['Old']))
  it('treats any finished torrent as completed', () => expect(names(list, { statuses: ['completed'] })).toEqual(['Ubuntu ISO', 'Old']))
  it('finds active torrents by speed', () => expect(names(list, { statuses: ['active'] })).toEqual(['Fedora']))
  it('finds errored torrents', () => expect(names(list, { statuses: ['errored'] })).toEqual(['Broken']))
  it('shows torrents matching any of several statuses', () => expect(names(list, { statuses: ['errored', 'active'] })).toEqual(['Fedora', 'Broken']))
  it('filters by category, and finds those without one', () => {
    expect(names(list, { categories: ['linux'] })).toEqual(['Ubuntu ISO', 'Fedora'])
    expect(names(list, { categories: [UNCATEGORIZED] })).toEqual(['Old', 'Broken'])
  })
  it('matches whole tags only, and finds untagged torrents', () => {
    expect(names(list, { tags: ['stable'] })).toEqual(['Ubuntu ISO'])
    expect(names(list, { tags: ['sta'] })).toEqual([])
    expect(names(list, { tags: [UNTAGGED, 'iso'] })).toHaveLength(4)
  })
  it('needs every list with choices to match', () => {
    expect(names(list, { categories: ['linux'], statuses: ['seeding'] })).toEqual(['Ubuntu ISO'])
    expect(names(list, { trackers: [TRACKERLESS] }, new Map([['t.test', new Set(['u'])]]))).toEqual(['Fedora', 'Old', 'Broken'])
  })
  it('toggles a choice in and out', () => {
    expect(toggleChoice(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleChoice(['a', 'b'], 'a')).toEqual(['b'])
  })
})

describe('parseTags', () => {
  it('splits and trims', () => expect(parseTags('a, b ,,c')).toEqual(['a', 'b', 'c']))
  it('handles missing tags', () => expect(parseTags(undefined)).toEqual([]))
})

describe('tracker filter', () => {
  const hosts = groupTrackersByHost({
    'udp://tracker.a.test:80/announce': ['h1'],
    'https://tracker.a.test/announce': ['h2'],
    'udp://b.test:6969': ['h2'],
  })

  it('groups tracker URLs by host', () => {
    expect([...hosts.keys()].sort()).toEqual(['b.test', 'tracker.a.test'])
    expect([...hosts.get('tracker.a.test')!].sort()).toEqual(['h1', 'h2'])
  })

  it('matches torrents by host, and finds trackerless ones', () => {
    expect(matchesTracker('h1', 'tracker.a.test', hosts)).toBe(true)
    expect(matchesTracker('h1', 'b.test', hosts)).toBe(false)
    expect(matchesTracker('h3', TRACKERLESS, hosts)).toBe(true)
    expect(matchesTracker('h1', TRACKERLESS, hosts)).toBe(false)
    expect(matchesTracker('h1', '', hosts)).toBe(true)
  })

  it('keeps an unparsable tracker as it is', () => {
    expect(getTrackerHost('not a url')).toBe('not a url')
  })
})

describe('countFilterOptions', () => {
  it('counts each status, category, tag, and tracker on its own', () => {
    const list = [
      { hash: 'a', name: 'a', state: 'uploading', progress: 1, dlspeed: 0, upspeed: 5, category: 'Linux', tags: 'iso, stable' },
      { hash: 'b', name: 'b', state: 'stoppedDL', progress: 0.5, dlspeed: 0, upspeed: 0, category: '', tags: 'iso' },
    ] as Torrent[]
    const counts = countFilterOptions(list, new Map([['tracker.example', new Set(['a'])]]))
    expect(counts.all).toBe(2)
    expect(counts.status.seeding).toBe(1)
    expect(counts.status.stopped).toBe(1)
    expect(counts.category).toEqual({ Linux: 1, [UNCATEGORIZED]: 1 })
    expect(counts.tag).toEqual({ iso: 2, stable: 1 })
    expect(counts.tracker).toEqual({ 'tracker.example': 1 })
    expect(counts.trackerless).toBe(1)
  })
})

describe('searchMatcher', () => {
  const matches = (search: string, value: string) => searchMatcher(search)!(value)
  it('finds words across dots, underscores, dashes and brackets, in any order', () => {
    expect(matches('breaking bad', 'Breaking.Bad.S01E01.720p')).toBe(true)
    expect(matches('bad breaking', 'Breaking_Bad')).toBe(true)
    expect(matches('horriblesubs', '[HorribleSubs] Show - 01')).toBe(true)
    expect(matches('breaking good', 'Breaking.Bad')).toBe(false)
  })
  it('matches wildcard patterns against the whole value', () => {
    expect(matches('*.mkv', 'Sintel.2010.1080p.MKV')).toBe(true)
    expect(matches('*.mkv', 'Sintel.mkv.nfo')).toBe(false)
    expect(matches('*1080p*', 'Sintel.2010.1080p.mkv')).toBe(true)
    expect(matches('*S[0-9][0-9]E[0-9][0-9]*', 'Show.S01E02.mkv')).toBe(true)
    expect(matches('*S[0-9][0-9]E[0-9][0-9]*', 'Show.Season.1.mkv')).toBe(false)
    expect(matches('ubuntu-??.04*', 'ubuntu-24.04-desktop.iso')).toBe(true)
    expect(matches('*[!0-9].iso', 'archlinux.iso')).toBe(true)
  })
  it('treats regular expression characters in a pattern as plain text', () => {
    expect(matches('*(2008)*', 'Big Buck Bunny (2008) [4K]')).toBe(true)
    expect(matches('a+b*', 'aab')).toBe(false)
  })
  it('matches nothing for an empty search', () => expect(searchMatcher('  ')).toBeNull())
})
