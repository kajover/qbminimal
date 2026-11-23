// Writes a .torrent file for a folder. Used by scripts/make-update-torrent.mjs, which hands in
// the SHA-1 function from node:crypto.

export type Bencodable = number | string | Uint8Array | Bencodable[] | { [key: string]: Bencodable }

const text = new TextEncoder()

function compare(a: Uint8Array, b: Uint8Array) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]
  return a.length - b.length
}

function join(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

export function bencode(value: Bencodable): Uint8Array {
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) throw new Error(`Only whole numbers can be encoded, not ${value}`)
    return text.encode(`i${value}e`)
  }
  if (typeof value === 'string' || value instanceof Uint8Array) {
    const bytes = typeof value === 'string' ? text.encode(value) : value
    return join([text.encode(`${bytes.length}:`), bytes])
  }
  if (Array.isArray(value)) return join([text.encode('l'), ...value.map(bencode), text.encode('e')])
  // Keys go in byte order, as the format asks.
  const entries = Object.entries(value).map(([key, item]) => [text.encode(key), item] as const).sort(([a], [b]) => compare(a, b))
  return join([text.encode('d'), ...entries.flatMap(([key, item]) => [bencode(key), bencode(item)]), text.encode('e')])
}

export interface TorrentFileInput {
  // Slash separated, relative to the torrent's folder.
  path: string
  data: Uint8Array
}

export interface TorrentOptions {
  name: string
  files: TorrentFileInput[]
  // BEP 19 web seed addresses, each ending in a slash. A client asks for <address><name>/<path>,
  // and downloads from several at once.
  webSeeds: string[]
  pieceLength?: number
  sha1: (data: Uint8Array) => Uint8Array
}

// A multi-file torrent with no trackers: clients get the data from the web seeds alone.
export function buildTorrent({ name, files, webSeeds, pieceLength = 64 * 1024, sha1 }: TorrentOptions): Uint8Array {
  if (!webSeeds.length || webSeeds.some(seed => !seed.endsWith('/'))) throw new Error('Each web seed address has to end with a slash')
  const sorted = [...files].sort((a, b) => compare(text.encode(a.path), text.encode(b.path)))
  const all = join(sorted.map(file => file.data))
  const pieces: Uint8Array[] = []
  for (let at = 0; at < all.length; at += pieceLength) pieces.push(sha1(all.subarray(at, at + pieceLength)))
  return bencode({
    'created by': 'qbminimal',
    info: {
      name,
      'piece length': pieceLength,
      pieces: join(pieces),
      files: sorted.map(file => ({ length: file.data.length, path: file.path.split('/') })),
    },
    'url-list': webSeeds,
  })
}
