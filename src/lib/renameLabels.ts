import type { Torrent } from '@/types'
import { parseTags } from './torrentFilters'

// qBittorrent can't rename a category or a tag, so a new one takes the torrents of the old one,
// which is then deleted. The category keeps its save path.
export interface LabelClient {
  createCategory: (category: string, savePath: string) => Promise<unknown>
  setCategory: (hashes: string[], category: string) => Promise<unknown>
  removeCategories: (categories: string[]) => Promise<unknown>
  createTags: (tags: string[]) => Promise<unknown>
  addTags: (hashes: string[], tags: string[]) => Promise<unknown>
  removeTags: (hashes: string[], tags: string[]) => Promise<unknown>
  deleteTags: (tags: string[]) => Promise<unknown>
}

export async function renameCategory(client: LabelClient, torrents: readonly Torrent[], from: string, to: string, savePath: string) {
  await client.createCategory(to, savePath)
  const hashes = torrents.filter(torrent => torrent.category === from).map(torrent => torrent.hash)
  if (hashes.length) await client.setCategory(hashes, to)
  await client.removeCategories([from])
}

export async function renameTag(client: LabelClient, torrents: readonly Torrent[], from: string, to: string) {
  await client.createTags([to])
  const hashes = torrents.filter(torrent => parseTags(torrent.tags).includes(from)).map(torrent => torrent.hash)
  if (hashes.length) {
    await client.addTags(hashes, [to])
    await client.removeTags(hashes, [from])
  }
  await client.deleteTags([from])
}
