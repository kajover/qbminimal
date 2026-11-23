import { describe, expect, it } from 'vitest'
import { bencode, buildTorrent } from './torrentFile'

const decode = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes)
const encoded = (value: Parameters<typeof bencode>[0]) => decode(bencode(value))

describe('bencode', () => {
  it('writes numbers, text, lists and dictionaries', () => {
    expect(encoded(42)).toBe('i42e')
    expect(encoded(-3)).toBe('i-3e')
    expect(encoded('spam')).toBe('4:spam')
    expect(encoded(['a', 1])).toBe('l1:ai1ee')
    expect(encoded({ b: 1, a: 'x' })).toBe('d1:a1:x1:bi1ee')
  })

  it('counts bytes, not characters, and keeps raw bytes as they are', () => {
    expect(encoded('é')).toBe('2:Ã©')
    expect(bencode(new Uint8Array([0, 255]))).toEqual(new Uint8Array([0x32, 0x3a, 0, 255]))
  })

  it('refuses fractions', () => {
    expect(() => bencode(1.5)).toThrow()
  })
})

describe('update torrent', () => {
  // A stand-in for SHA-1: 20 bytes that depend on the piece's length and first byte.
  const sha1 = (data: Uint8Array) => new Uint8Array(20).fill(data.length % 256).map((v, i) => (i === 0 ? data[0] : v))
  const bytes = (n: number, fill: number) => new Uint8Array(n).fill(fill)

  it('lists files in order and cuts the joined data into pieces', () => {
    const torrent = decode(buildTorrent({
      name: 'qbminimal-1.2.3', webSeeds: ['https://example.org/1.2.3/'], pieceLength: 4, sha1,
      files: [{ path: 'public/b.js', data: bytes(3, 2) }, { path: 'LICENSE', data: bytes(3, 1) }],
    }))
    expect(torrent).toContain('d10:created by9:qbminimal4:infod5:filesld6:lengthi3e4:pathl7:LICENSEeed6:lengthi3e4:pathl6:public4:b.jseee')
    expect(torrent).toContain('4:name15:qbminimal-1.2.3')
    expect(torrent).toContain('12:piece lengthi4e6:pieces40:')
    expect(torrent).not.toContain('private')
    expect(torrent).toContain('8:url-listl26:https://example.org/1.2.3/e')
  })

  it('needs the web seed address to end with a slash', () => {
    expect(() => buildTorrent({ name: 'x', files: [], webSeeds: ['https://example.org'], sha1 })).toThrow()
  })
})
