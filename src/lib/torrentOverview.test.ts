import { describe, expect, it } from 'vitest'
import type { Torrent } from '@/types'
import { torrentOverview } from './torrentOverview'

const torrent = (extra: Partial<Torrent>): Torrent => ({
  hash: Math.random().toString(16), name: 'a', state: 'uploading', progress: 1, size: 100, amount_left: 0, uploaded: 0, downloaded: 100,
  category: '', tags: '', tracker: '', completion_on: 1, ...extra,
} as Torrent)

describe('torrentOverview', () => {
  it('counts states and trackers, and sums what is left and transferred', () => {
    const overview = torrentOverview([
      torrent({ name: 'one', state: 'downloading', progress: 0.5, amount_left: 50, downloaded: 50, uploaded: 10, category: 'Linux', tracker: 'https://a.example/announce', completion_on: 0 }),
      torrent({ name: 'two', state: 'uploading', uploaded: 300, category: 'Linux', tracker: 'https://a.example/announce', private: true }),
      torrent({ name: 'three', state: 'stoppedDL', progress: 0.2, amount_left: 80, downloaded: 20, size: 100, completion_on: 0, tracker: 'https://b.example/announce' }),
    ], 10)
    expect(overview).toMatchObject({ total: 3, size: 300, downloading: 1, seeding: 1, stopped: 1, private: 1, remaining: 130, eta: 13, downloaded: 170, uploaded: 310, trackers: 2 })
    expect(overview.ratio).toBeCloseTo(310 / 170)
  })

  it('has no ratio or time left with nothing downloaded or nothing moving', () => {
    expect(torrentOverview([torrent({ downloaded: 0, progress: 0.5, amount_left: 50 })], 0)).toMatchObject({ ratio: null, eta: null })
  })
})
