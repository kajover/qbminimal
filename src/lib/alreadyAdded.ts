import type { SearchResult, Torrent } from '@/types'
import { magnetHash } from './addTorrent'

const nameKey = (name: string) => name.trim().toLowerCase()

// Whether a search result is a torrent already in the list: by the hash in its magnet link, or
// else, for a link to a .torrent file, by the same name.
export function addedMatcher(torrents: Torrent[]): (result: SearchResult) => boolean {
  const hashes = new Set(torrents.flatMap(torrent => [torrent.hash, torrent.infohash_v1].filter((hash): hash is string => !!hash)))
  const names = new Set(torrents.map(torrent => nameKey(torrent.name)))
  return result => {
    const hash = magnetHash(result.fileUrl)
    return hash ? hashes.has(hash) : names.has(nameKey(result.fileName))
  }
}
