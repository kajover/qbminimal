import { describe, expect, it } from 'vitest'
import type { SearchResult, Torrent } from '@/types'
import { addedMatcher } from './alreadyAdded'

const hex = 'c12fe1c06bba254a9dc9f519b335aa7c1367a88a'
const result = (fileUrl: string, fileName = 'Other'): SearchResult => ({ fileName, fileUrl, fileSize: 1, nbSeeders: 1, nbLeechers: 1, siteUrl: '', descrLink: '' })

describe('already added', () => {
  it('matches by hash for magnet links and by name for files', () => {
    const added = addedMatcher([{ hash: hex, name: 'Ubuntu 24.04' } as Torrent])
    expect(added(result(`magnet:?xt=urn:btih:${hex}`))).toBe(true)
    expect(added(result('magnet:?xt=urn:btih:0000000000000000000000000000000000000000', 'Ubuntu 24.04'))).toBe(false)
    expect(added(result('https://example.org/1.torrent', ' ubuntu 24.04 '))).toBe(true)
    expect(added(result('https://example.org/2.torrent', 'Debian'))).toBe(false)
  })
})
