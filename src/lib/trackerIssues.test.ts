import { describe, expect, it } from 'vitest'
import { torrentsToCheck, trackerIssue } from './trackerIssues'
import type { Torrent, TorrentTracker } from '@/types'

const tracker = (msg: string, url = 'https://tracker.example/announce'): TorrentTracker => ({ url, status: 4, tier: 0, num_peers: 0, num_seeds: 0, num_downloaded: 0, msg })

describe('trackerIssue', () => {
  it('finds torrents the tracker no longer knows', () => {
    expect(trackerIssue([tracker('Unregistered torrent')])).toBe('unregistered')
    expect(trackerIssue([tracker('Torrent not registered with this tracker')])).toBe('unregistered')
    expect(trackerIssue([tracker('infohash not found')])).toBe('unregistered')
  })
  it('finds trackers that can\'t be reached', () => {
    expect(trackerIssue([tracker('Connection timed out')])).toBe('down')
    expect(trackerIssue([tracker('503 Service Unavailable')])).toBe('down')
  })
  it('ignores other messages, and DHT, PeX and LSD', () => {
    expect(trackerIssue([tracker('Slow down, too many requests')])).toBeNull()
    expect(trackerIssue([tracker('Unregistered torrent', '** [DHT] **')])).toBeNull()
    expect(trackerIssue([])).toBeNull()
  })
})

describe('torrentsToCheck', () => {
  it('asks only about torrents qBittorrent marks with a tracker problem', () => {
    const torrents = [
      { hash: 'b', has_tracker_error: true },
      { hash: 'a', has_other_announce_error: true },
      { hash: 'c', has_tracker_warning: true },
      { hash: 'd' },
    ] as Torrent[]
    expect(torrentsToCheck(torrents)).toEqual(['a', 'b'])
  })
})
