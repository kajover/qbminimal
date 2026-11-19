import type { Torrent } from '@/types'
import { trackerHost } from './torrentColumns'
import { countFilterOptions } from './torrentFilters'

// Figures across every torrent for Statistics, worked out from the torrent list already loaded.
export interface TorrentOverview {
  total: number
  // Bytes, summed here as qBittorrent doesn't report it.
  size: number
  downloading: number
  seeding: number
  stopped: number
  stalled: number
  errored: number
  private: number
  // Bytes still to download, of the unfinished torrents.
  remaining: number
  // Seconds until that's done at the given speed, or null when nothing is downloading.
  eta: number | null
  downloaded: number
  uploaded: number
  // Uploaded over downloaded, or null before anything was downloaded.
  ratio: number | null
  trackers: number
}


export function torrentOverview(torrents: Torrent[], downloadSpeed: number): TorrentOverview {
  const status = countFilterOptions(torrents, new Map()).status
  const remaining = torrents.reduce((sum, torrent) => sum + (torrent.progress < 1 ? Math.max(torrent.amount_left ?? 0, 0) : 0), 0)
  const downloaded = torrents.reduce((sum, torrent) => sum + Math.max(torrent.downloaded ?? torrent.total_downloaded ?? 0, 0), 0)
  const uploaded = torrents.reduce((sum, torrent) => sum + Math.max(torrent.uploaded ?? 0, 0), 0)
  const trackers = new Set(torrents.map(torrent => trackerHost(torrent.tracker)).filter(Boolean))
  return {
    total: torrents.length,
    size: torrents.reduce((sum, torrent) => sum + Math.max(torrent.size ?? 0, 0), 0),
    downloading: status.downloading,
    seeding: status.seeding,
    stopped: status.stopped,
    stalled: status.stalled,
    errored: status.errored,
    private: torrents.filter(torrent => torrent.private).length,
    remaining,
    eta: remaining > 0 && downloadSpeed > 0 ? Math.round(remaining / downloadSpeed) : null,
    downloaded,
    uploaded,
    ratio: downloaded > 0 ? uploaded / downloaded : null,
    trackers: trackers.size,
  }
}
