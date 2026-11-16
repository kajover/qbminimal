import { formatVersion, isNewer, latestQbittorrent, latestQbminimalRelease, parseVersion } from './updates'
import { readStored, writeStored } from './storage'

// What the last update check found, kept on this device. It keeps the newest versions rather than
// "newer or not", so updating clears the notice at once.
export interface UpdateState {
  // Milliseconds since 1970; 0 before the first check.
  lastChecked: number
  // The newest release of each, or 'failed'. Null before the first check.
  // `qbminimalTorrent` is where qbminimal's update torrent is, when the newest release has one.
  latest: { qbminimal: string | 'failed'; qbittorrent: string | 'failed'; qbminimalTorrent?: string } | null
}

const KEY = 'qbminimal.updates'

export function parseUpdateState(raw: string | null): UpdateState {
  const empty: UpdateState = { lastChecked: 0, latest: null }
  try {
    const saved = JSON.parse(raw ?? '{}') as Partial<UpdateState>
    const text = (value: unknown) => (typeof value === 'string' ? value : 'failed')
    return {
      lastChecked: typeof saved.lastChecked === 'number' ? saved.lastChecked : 0,
      latest: saved.latest && typeof saved.latest === 'object'
        ? {
            qbminimal: text(saved.latest.qbminimal),
            qbittorrent: text(saved.latest.qbittorrent),
            ...(typeof saved.latest.qbminimalTorrent === 'string' ? { qbminimalTorrent: saved.latest.qbminimalTorrent } : {}),
          }
        : null,
    }
  } catch {
    return empty
  }
}

let state = parseUpdateState(readStored(KEY))
const listeners = new Set<() => void>()

export const getUpdateState = () => state
export function subscribeUpdates(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
function setState(next: UpdateState) {
  state = next
  writeStored(KEY, JSON.stringify(next))
  listeners.forEach(listener => listener())
}

let running: Promise<void> | null = null
// Asks GitHub for both newest releases. A second call while one runs waits for the first.
export function checkForUpdates(): Promise<void> {
  running ??= (async () => {
    const ask = async (latest: () => Promise<string | null>) => {
      try {
        return (await latest()) ?? 'failed'
      } catch {
        return 'failed'
      }
    }
    let qbminimalTorrent: string | undefined
    const [qbminimal, qbittorrent] = await Promise.all([
      ask(async () => {
        const release = await latestQbminimalRelease()
        qbminimalTorrent = release.torrentUrl
        return release.version && formatVersion(release.version)
      }),
      ask(async () => {
        const found = await latestQbittorrent()
        return found && formatVersion(found)
      }),
    ])
    setState({ ...state, lastChecked: Date.now(), latest: { qbminimal, qbittorrent, ...(qbminimalTorrent ? { qbminimalTorrent } : {}) } })
  })().finally(() => { running = null })
  return running
}

// How often the app checks by itself, in the background after signing in.
const CHECK_EVERY = 12 * 60 * 60 * 1000

// Checks unless the last check is recent enough. Returns whether it started one.
export function checkForUpdatesIfDue(now = Date.now()): boolean {
  if (now - state.lastChecked < CHECK_EVERY) return false
  void checkForUpdates()
  return true
}

// Whether `latest` is newer than the version running now.
export function newerThan(latest: string | 'failed' | undefined, current: string | undefined): boolean {
  const found = parseVersion(latest)
  const installed = parseVersion(current)
  return !!found && !!installed && isNewer(found, installed)
}
