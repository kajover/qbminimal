import { formatVersion, isNewer, latestQbittorrent, latestQbminimal, parseVersion } from './updates'
import { readStored, writeStored } from './storage'

// What the last update check found, kept on this device. It keeps the newest versions rather than
// "newer or not", so updating clears the notice at once.
export interface UpdateState {
  // Milliseconds since 1970; 0 before the first check.
  lastChecked: number
  // The newest release of each, or 'failed'. Null before the first check.
  latest: { qbminimal: string | 'failed'; qbittorrent: string | 'failed' } | null
}

const KEY = 'qbminimal.updates'

export function parseUpdateState(raw: string | null): UpdateState {
  const empty: UpdateState = { lastChecked: 0, latest: null }
  try {
    const saved = JSON.parse(raw ?? '{}') as Partial<UpdateState>
    const text = (value: unknown) => (typeof value === 'string' ? value : 'failed')
    return {
      lastChecked: typeof saved.lastChecked === 'number' ? saved.lastChecked : 0,
      latest: saved.latest && typeof saved.latest === 'object' ? { qbminimal: text(saved.latest.qbminimal), qbittorrent: text(saved.latest.qbittorrent) } : null,
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
    const ask = async (latest: () => ReturnType<typeof latestQbminimal>) => {
      try {
        const found = await latest()
        return found ? formatVersion(found) : 'failed'
      } catch {
        return 'failed'
      }
    }
    const [qbminimal, qbittorrent] = await Promise.all([ask(latestQbminimal), ask(latestQbittorrent)])
    setState({ ...state, lastChecked: Date.now(), latest: { qbminimal, qbittorrent } })
  })().finally(() => { running = null })
  return running
}

// How often the app checks by itself, in the background after signing in.
export const CHECK_EVERY = 12 * 60 * 60 * 1000

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
