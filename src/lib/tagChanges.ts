import { qbitClient } from './api'

// Puts the added tags on the torrents and takes the removed ones off, leaving every other tag as it is.
export async function changeTags(hashes: string[], added: string[], removed: string[]) {
  if (added.length) await qbitClient.addTags(hashes, added)
  if (removed.length) await qbitClient.removeTags(hashes, removed)
}
