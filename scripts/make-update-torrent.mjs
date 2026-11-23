// Packs a folder into a torrent that only has web seeds (BEP 19), so qBittorrent can download an
// update from GitHub without any peers. Several addresses for the same files let it download from
// as many connections at once: on a cold cache GitHub answers each file slowly, and three
// connections fetched the app about three times as fast as one (13.5 s to 4.6 s).
//   node scripts/make-update-torrent.mjs <folder> <name, like qbminimal-1.2.3> <output> <web seed address, ending in />...
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { buildTorrent } from '../src/lib/torrentFile.ts'

const [folder, name, output, ...webSeeds] = process.argv.slice(2)
if (!folder || !name || !output || !webSeeds.length) {
  console.error('Usage: make-update-torrent.mjs <folder> <name> <output> <web seed address>...')
  process.exit(1)
}

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)])
}

const files = listFiles(folder).map(file => ({ path: relative(folder, file).split(sep).join('/'), data: readFileSync(file) }))
const torrent = buildTorrent({ name, files, webSeeds, sha1: data => createHash('sha1').update(data).digest() })
writeFileSync(output, torrent)
console.log(`${output}: ${files.length} files, ${webSeeds.length} web seeds, ${torrent.length} bytes`)
