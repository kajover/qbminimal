// Torrents handed to the app from outside the Add page: .torrent files dropped anywhere, and
// magnet links the browser opens with the app. They wait here until the Add page takes them.

export interface Incoming {
  files: File[]
  links: string[]
}

let pending: Incoming = { files: [], links: [] }
const listeners = new Set<() => void>()

export function hasIncoming() {
  return pending.files.length > 0 || pending.links.length > 0
}

export function sendToAdd(incoming: Partial<Incoming>) {
  pending = { files: [...pending.files, ...(incoming.files ?? [])], links: [...pending.links, ...(incoming.links ?? [])] }
  listeners.forEach(listener => listener())
}

// Hands over everything waiting, once.
export function takeIncoming(): Incoming {
  const taken = pending
  pending = { files: [], links: [] }
  return taken
}

export function onIncoming(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const isTorrentFile = (file: File) => file.name.toLowerCase().endsWith('.torrent')

// The address a browser opens for a magnet link once the app is registered for them.
const MAGNET_PARAM = 'magnet'

export function magnetHandlerUrl(location: Pick<Location, 'origin' | 'pathname'>) {
  return `${location.origin}${location.pathname}?${MAGNET_PARAM}=%s`
}

// A magnet link the page was opened with, which is then taken off the address.
export function readMagnetFromAddress(location: Pick<Location, 'search'>): string | null {
  const value = new URLSearchParams(location.search).get(MAGNET_PARAM)
  return value && value.toLowerCase().startsWith('magnet:') ? value : null
}
