import type { Torrent, TorrentTracker } from '@/types'

// What a torrent's trackers say is wrong with it, read from their messages, as qBittorrent itself
// only says there's an error. Private trackers word these differently, so these are the common ones.
export type TrackerIssue = 'unregistered' | 'down'

// The tracker no longer knows the torrent: deleted, replaced, or never uploaded.
const UNREGISTERED = /unregistered|not registered|torrent not found|torrent does not exist|unknown torrent|info ?hash not found|torrent has been deleted|not authorized for use|trumped|nuked|\bdupe\b|retitled|specifically banned/i
// The tracker can't be reached or isn't answering properly.
const DOWN = /tracker is down|tracker down|timed? ?out|unreachable|connection (?:refused|reset)|could not (?:connect|resolve)|host not found|service unavailable|bad gateway|maintenance|\b50[234]\b/i

export function trackerIssue(trackers: TorrentTracker[]): TrackerIssue | null {
  // DHT, PeX and LSD are listed as "** [DHT] **" and the like, and aren't trackers.
  const messages = trackers.filter(tracker => !tracker.url.startsWith('** ') && tracker.msg).map(tracker => tracker.msg)
  if (messages.some(message => UNREGISTERED.test(message))) return 'unregistered'
  if (messages.some(message => DOWN.test(message))) return 'down'
  return null
}

// The torrents worth asking about: those qBittorrent 5.1 or newer marks with a tracker problem.
// Older versions don't say, so nothing is asked.
export const MAX_TRACKER_CHECKS = 100
export function torrentsToCheck(torrents: readonly Torrent[]): string[] {
  return torrents.filter(torrent => torrent.has_tracker_error || torrent.has_other_announce_error).map(torrent => torrent.hash).sort().slice(0, MAX_TRACKER_CHECKS)
}
