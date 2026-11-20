import { useSyncExternalStore } from 'react'
import { readStored, writeStored } from './storage'
import type { Torrent } from '@/types'

// Incognito mode, as in qui: the torrent list shows harmless Linux ISO and open movie names in
// place of the real ones, for screenshots or a screen others can see. Only this browser's view
// changes; qBittorrent and the torrents stay as they are. Each torrent keeps its stand-in name.
const KEY = 'qbminimal.incognito'

// Stand-in names, each with a typical size in MB, so a torrent gets a name that fits its size.
// None may match the demo's own torrent names, which the release check looks for in the zip.
type StandIn = [name: string, mb: number]

const ISOS: StandIn[] = [
  ['alpine-virt-3.20.3-x86_64.iso', 64], ['alpine-standard-3.20.3-x86_64.iso', 210], ['TinyCore-CorePlus-15.0.iso', 250],
  ['debian-12.9.0-amd64-netinst.iso', 630], ['debian-11.11.0-amd64-netinst.iso', 390], ['Fedora-Everything-netinst-x86_64-41.iso', 800],
  ['archlinux-2024.12.01-x86_64.iso', 1200], ['proxmox-ve_8.2-2.iso', 1300], ['tails-amd64-6.8.1.iso', 1400],
  ['MX-23.3_x64.iso', 2000], ['Fedora-Cinnamon-Live-x86_64-40.iso', 2300], ['nixos-24.05-plasma6-x86_64.iso', 2400],
  ['Fedora-Server-dvd-x86_64-42.iso', 2500], ['Fedora-KDE-Live-x86_64-41.iso', 2600], ['ubuntu-24.04.1-live-server-amd64.iso', 2700],
  ['elementary-os-7.1-stable.iso', 2700], ['linuxmint-22-cinnamon-64bit.iso', 2900], ['lubuntu-24.04-desktop-amd64.iso', 3100],
  ['debian-live-12.9.0-amd64-gnome.iso', 3200], ['zorin-os-17.1-core-64bit.iso', 3300], ['debian-live-12.9.0-amd64-kde.iso', 3400],
  ['slackware64-15.0-install-dvd.iso', 3600], ['xubuntu-24.04-desktop-amd64.iso', 3600], ['debian-12.9.0-amd64-DVD-1.iso', 3900],
  ['manjaro-kde-24.0-linux66.iso', 3900], ['kubuntu-24.04.1-desktop-amd64.iso', 4200], ['openSUSE-Leap-15.6-DVD-x86_64.iso', 4400],
  ['openSUSE-Tumbleweed-DVD-x86_64-Current.iso', 4500], ['ubuntu-22.04.5-desktop-amd64.iso', 4700], ['ubuntu-24.10-desktop-amd64.iso', 5700],
  ['ubuntu-24.04.1-desktop-amd64.iso', 6000], ['debian-12.9.0-amd64-BD-1.iso', 7900], ['rocky-9.4-x86_64-dvd.iso', 10200],
  ['almalinux-9.4-x86_64-dvd.iso', 10500], ['centos-stream-9-latest-x86_64-dvd1.iso', 11000], ['kali-linux-2024.3-installer-everything-amd64.iso', 12500],
  ['ubuntu-24.04-all-flavours-amd64', 38000], ['debian-12.9.0-amd64-DVD-set', 85000],
]

// The Blender open movies, for torrents that look like videos.
const MOVIES: StandIn[] = [
  ['Caminandes.Llamigos.2016.1080p.mkv', 300], ['Elephants.Dream.2006.1080p.mkv', 800], ['Tears.of.Steel.2012.1080p.mkv', 1200],
  ['Glass.Half.2015.1080p.mkv', 1500], ['Spring.2019.4K.mkv', 2800], ['Agent.327.Operation.Barbershop.2017.4K.mkv', 3500],
  ['Charge.2022.4K.HDR.mkv', 5000], ['Cosmos.Laundromat.2015.4K.mkv', 6500], ['Sprite.Fright.2021.2160p.mkv', 9000],
  ['Tears.of.Steel.2012.2160p.Remux.mkv', 22000], ['Cosmos.Laundromat.2015.2160p.Remux.mkv', 35000],
  ['Blender.Open.Movies.2006-2022.1080p', 45000], ['Blender.Open.Movies.2006-2022.2160p', 120000],
]

// Every stand-in with its size, which the demo also uses for its extra sample torrents.
export const STAND_INS: readonly StandIn[] = [...ISOS, ...MOVIES]

const VIDEO = /\.(mkv|mp4|m4v|avi|mov|webm|ts)$|\b(720p|1080p|2160p|4k|x264|x265|hevc|bluray|web-?dl|remux)\b/i

const listeners = new Set<() => void>()
const read = () => readStored(KEY) === 'on'

export function setIncognito(on: boolean) {
  writeStored(KEY, on ? 'on' : null)
  listeners.forEach(listener => listener())
}

export function useIncognito(): boolean {
  return useSyncExternalStore(
    (onChange) => { listeners.add(onChange); return () => listeners.delete(onChange) },
    read,
  )
}

const hashNumber = (hash: string) => {
  let sum = 0
  for (const char of hash) sum = (sum * 31 + char.charCodeAt(0)) >>> 0
  return sum
}

// The names given out while the page is open, so each torrent keeps its own and no two share one.
const given = new Map<string, string>()

// The unused stand-in whose size is nearest the torrent's, from the movies for what looks like a
// video.
function pick(hash: string, size: number, video: boolean, taken: Set<string>): string {
  const mb = Math.max(size / 1024 ** 2, 1)
  const pools = video ? [MOVIES, ISOS] : [ISOS, MOVIES]
  for (const pool of pools) {
    const free = pool.filter(([name]) => !taken.has(name))
      .sort((a, b) => Math.abs(Math.log(a[1] / mb)) - Math.abs(Math.log(b[1] / mb)))
    if (free.length) return free[0][0]
  }
  // More torrents than names: numbered copies, still each its own.
  const [base] = ISOS[hashNumber(hash) % ISOS.length]
  for (let n = 2; ; n++) if (!taken.has(`${base} (${n})`)) return `${base} (${n})`
}

// A torrent's stand-in name: the one it already has, or a new one that no other torrent uses.
export function incognitoName(hash: string, size = 0, realName = ''): string {
  const known = given.get(hash)
  if (known) return known
  const name = pick(hash, size, VIDEO.test(realName), new Set(given.values()))
  given.set(hash, name)
  return name
}

// Torrents in hash order, so a page that loads the same torrents gives them the same names.
export function disguiseTorrents(torrents: Torrent[]): Torrent[] {
  for (const torrent of [...torrents].sort((a, b) => (a.hash < b.hash ? -1 : 1))) incognitoName(torrent.hash, torrent.size, torrent.name)
  return torrents.map(torrent => ({ ...torrent, name: given.get(torrent.hash)! }))
}

// A torrent's files under made-up names, each part of a path replaced the same way wherever it
// appears, keeping file extensions, so the Content tab shows nothing real either. A torrent of one
// file shows it under the torrent's own stand-in name.
export function disguiseFiles<F extends { name: string }>(files: F[], hash: string): F[] {
  const torrentName = incognitoName(hash)
  if (files.length === 1 && !files[0].name.includes('/')) return [{ ...files[0], name: torrentName }]
  const base = torrentName.replace(/\.(iso|mkv)$/, '')
  const names = new Map<string, string>()
  const stand = (part: string, isFile: boolean) => {
    const key = `${isFile ? 'f' : 'd'}:${part}`
    if (!names.has(key)) {
      const n = [...names.keys()].filter(other => other[0] === key[0]).length + 1
      const extension = isFile && /\.[a-z0-9]{1,5}$/i.test(part) ? part.slice(part.lastIndexOf('.')) : ''
      names.set(key, isFile ? `${base}-${n}${extension}` : n === 1 ? base : `${base}-extras-${n - 1}`)
    }
    return names.get(key)!
  }
  return files.map(file => {
    const parts = file.name.split('/')
    return { ...file, name: parts.map((part, i) => stand(part, i === parts.length - 1)).join('/') }
  })
}
