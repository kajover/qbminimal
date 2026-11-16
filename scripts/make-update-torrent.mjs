// Packs a folder into qbminimal-update.torrent, a torrent that only has a web seed (BEP 19), so
// qBittorrent can download an update from GitHub without any peers.
//   node scripts/make-update-torrent.mjs <folder> <name, like qbminimal-1.2.3> <web seed address, ending in /> [output]
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { buildTorrent } from '../src/lib/torrentFile.ts'

const [folder, name, webSeed, output = 'qbminimal-update.torrent'] = process.argv.slice(2)
if (!folder || !name || !webSeed) {
  console.error('Usage: make-update-torrent.mjs <folder> <name> <web seed address> [output]')
  process.exit(1)
}

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)])
}

const files = listFiles(folder).map(file => ({ path: relative(folder, file).split(sep).join('/'), data: readFileSync(file) }))
const torrent = buildTorrent({ name, files, webSeed, sha1: data => createHash('sha1').update(data).digest() })
writeFileSync(output, torrent)
console.log(`${output}: ${files.length} files, ${torrent.length} bytes`)
