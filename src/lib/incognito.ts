import { useSyncExternalStore } from 'react'
import { readStored, writeStored } from './storage'
import type { Torrent } from '@/types'

// Incognito mode, as in qui: the torrent list shows harmless Linux ISO names in place of the real
// ones, for screenshots or a screen others can see. Only this browser's view changes; qBittorrent
// and the torrents stay as they are. Each torrent keeps the same stand-in name while it's on.
const KEY = 'qbminimal.incognito'

const NAMES = [
  'ubuntu-24.04.1-desktop-amd64.iso', 'ubuntu-24.10-desktop-amd64.iso', 'ubuntu-22.04.4-server-amd64.iso',
  'debian-12.7.0-amd64-DVD-1.iso', 'debian-13.1.0-amd64-netinst.iso', 'Fedora-Workstation-Live-x86_64-41.iso',
  'Fedora-Server-dvd-x86_64-42.iso', 'archlinux-2024.12.01-x86_64.iso', 'linuxmint-22-cinnamon-64bit.iso',
  'openSUSE-Tumbleweed-DVD-x86_64-Current.iso', 'openSUSE-Leap-15.6-DVD-x86_64.iso', 'manjaro-kde-24.0-linux66.iso',
  'elementary-os-7.1-stable.iso', 'zorin-os-17.1-core-64bit.iso', 'MX-23.3_x64.iso', 'rocky-9.4-x86_64-dvd.iso',
  'almalinux-9.4-x86_64-dvd.iso', 'centos-stream-9-latest-x86_64-dvd1.iso', 'alpine-standard-3.19.1-x86_64.iso',
  'slackware64-15.0-install-dvd.iso', 'nixos-24.05-plasma6-x86_64.iso', 'kubuntu-24.04.1-desktop-amd64.iso',
  'xubuntu-24.04-desktop-amd64.iso', 'lubuntu-24.04-desktop-amd64.iso', 'tails-amd64-6.8.1.iso', 'proxmox-ve_8.2-2.iso',
]

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

// A stand-in picked from the torrent's hash, so it doesn't change between refreshes.
export function incognitoName(hash: string): string {
  let sum = 0
  for (const char of hash) sum = (sum * 31 + char.charCodeAt(0)) >>> 0
  return NAMES[sum % NAMES.length]
}

export const disguiseTorrents = (torrents: Torrent[]): Torrent[] => torrents.map(torrent => ({ ...torrent, name: incognitoName(torrent.hash) }))

// A torrent's files under made-up names, each part of a path replaced the same way wherever it
// appears, keeping file extensions, so the Content tab shows nothing real either.
export function disguiseFiles<F extends { name: string }>(files: F[], hash: string): F[] {
  const base = incognitoName(hash).replace(/\.iso$/, '')
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
