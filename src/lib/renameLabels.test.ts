import { describe, expect, it, vi } from 'vitest'
import type { Torrent } from '@/types'
import { renameCategory, renameTag, type LabelClient } from './renameLabels'

const client = (): LabelClient & Record<string, ReturnType<typeof vi.fn>> => ({
  createCategory: vi.fn(async () => undefined), setCategory: vi.fn(async () => undefined), removeCategories: vi.fn(async () => undefined),
  createTags: vi.fn(async () => undefined), addTags: vi.fn(async () => undefined), removeTags: vi.fn(async () => undefined), deleteTags: vi.fn(async () => undefined),
})
const torrents = [
  { hash: 'a', category: 'Linux', tags: 'iso, stable' },
  { hash: 'b', category: 'Movies', tags: 'hd' },
  { hash: 'c', category: 'Linux', tags: '' },
] as Torrent[]

describe('renaming', () => {
  it('moves a category\'s torrents to the new name and keeps its save path', async () => {
    const api = client()
    await renameCategory(api, torrents, 'Linux', 'Distros', '/data/linux')
    expect(api.createCategory).toHaveBeenCalledWith('Distros', '/data/linux')
    expect(api.setCategory).toHaveBeenCalledWith(['a', 'c'], 'Distros')
    expect(api.removeCategories).toHaveBeenCalledWith(['Linux'])
  })

  it('moves a tag to the new name on every torrent that has it', async () => {
    const api = client()
    await renameTag(api, torrents, 'iso', 'image')
    expect(api.createTags).toHaveBeenCalledWith(['image'])
    expect(api.addTags).toHaveBeenCalledWith(['a'], ['image'])
    expect(api.removeTags).toHaveBeenCalledWith(['a'], ['iso'])
    expect(api.deleteTags).toHaveBeenCalledWith(['iso'])
  })

  it('renames an unused tag without touching any torrent', async () => {
    const api = client()
    await renameTag(api, torrents, 'unused', 'other')
    expect(api.addTags).not.toHaveBeenCalled()
    expect(api.deleteTags).toHaveBeenCalledWith(['unused'])
  })
})
