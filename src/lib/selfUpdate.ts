// Installs a new qbminimal through qBittorrent itself. qBittorrent can't write a file it is given,
// but it can download a torrent. Each release has a torrent of the unpacked app that only has a
// web seed on GitHub, so it is added next to the current Web UI folder, and the Web UI path is then
// pointed at the new folder.
import type { Torrent } from '@/types'

export const UPDATE_TAG = 'qbminimal-update'
// How long the download may stay at the same progress.
export const STALL_MS = 60_000

// The folder that holds the current Web UI's `public` folder, and where its new version goes.
// Works for `/` and `\` paths, with or without a trailing slash, and for Windows drives.
export function updateTarget(currentPath: string, version: string): { savePath: string; name: string; webUiPath: string } | null {
  const trimmed = currentPath.trim().replace(/[\\/]+$/, '')
  const at = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  if (!trimmed || at < 0) return null
  const separator = trimmed[at]
  let savePath = trimmed.slice(0, at)
  // "/qbminimal" has the root as its parent, and "C:\qbminimal" the drive.
  if (!savePath || /^[A-Za-z]:$/.test(savePath)) savePath += separator
  const name = `qbminimal-${version}`
  const webUiPath = savePath.endsWith(separator) ? savePath + name : `${savePath}${separator}${name}`
  // Never the folder in use: cancelling deletes the download's files, which would then be the app's own.
  if (webUiPath === trimmed) return null
  return { savePath, name, webUiPath }
}

// Whether the update can be installed from here: qBittorrent has to use an alternative Web UI at
// a folder we can find the parent of.
export function canInstall(prefs: Record<string, unknown> | undefined, torrentUrl: string | undefined): prefs is Record<string, unknown> {
  const path = prefs?.alternative_webui_path
  return !!torrentUrl && prefs?.alternative_webui_enabled === true && typeof path === 'string' && updateTarget(path, '0.0.0') !== null
}

export type UpdateFailure = 'add' | 'stalled' | 'failed' | 'missing' | 'switch' | 'canceled'

export class UpdateError extends Error {
  readonly reason: UpdateFailure
  constructor(reason: UpdateFailure) {
    super(reason)
    this.reason = reason
  }
}

export interface UpdateClient {
  addTorrents(params: Record<string, string>, files: File[]): Promise<unknown>
  getTorrentsByTag(tag: string): Promise<Pick<Torrent, 'hash' | 'name' | 'state' | 'progress'>[]>
  setPreferences(changes: Record<string, unknown>): Promise<unknown>
  deleteTorrents(hashes: string[], deleteFiles?: boolean): Promise<unknown>
}

export interface InstallOptions {
  client: UpdateClient
  torrentUrl: string
  version: string
  currentPath: string
  // A whole percent, 0 to 100.
  onProgress: (percent: number) => void
  signal?: AbortSignal
  pollMs?: number
  stallMs?: number
}

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>(resolve => {
  const timer = setTimeout(done, ms)
  function done() {
    clearTimeout(timer)
    signal?.removeEventListener('abort', done)
    resolve()
  }
  signal?.addEventListener('abort', done)
})

// Tests replace this; reloading ends the page.
export const pageActions = { reload: () => window.location.reload() }

// Adds the update torrent, waits until it is complete, then switches the Web UI to its folder and
// removes the torrent, keeping the files. Throws an UpdateError; stopping it with `signal`
// removes the torrent and its files.
export async function installUpdate({ client, torrentUrl, version, currentPath, onProgress, signal, pollMs = 1000, stallMs = STALL_MS }: InstallOptions): Promise<void> {
  const target = updateTarget(currentPath, version)
  if (!target) throw new UpdateError('add')
  const mine = async () => (await client.getTorrentsByTag(UPDATE_TAG)).filter(torrent => torrent.name === target.name)
  const removeAll = async (deleteFiles: boolean) => {
    const hashes = (await client.getTorrentsByTag(UPDATE_TAG).catch(() => [])).map(torrent => torrent.hash)
    if (hashes.length) await client.deleteTorrents(hashes, deleteFiles).catch(() => undefined)
  }

  // A torrent left by an earlier try carries on instead of being added twice.
  try {
    if (!(await mine()).length) {
      const result = await client.addTorrents({
        urls: torrentUrl, savepath: target.savePath, autoTMM: 'false', contentLayout: 'Original',
        paused: 'false', stopped: 'false', tags: UPDATE_TAG,
      }, []) as { failure_count?: number; success_count?: number; pending_count?: number } | undefined
      if (result?.failure_count && !result.success_count && !result.pending_count) throw new Error('refused')
    }
  } catch {
    throw new UpdateError('add')
  }

  let hash = ''
  let best = 0
  let lastMoved = Date.now()
  onProgress(0)
  for (;;) {
    if (signal?.aborted) {
      await removeAll(true)
      throw new UpdateError('canceled')
    }
    const found = (await mine().catch(() => []))[0]
    if (found) {
      hash = found.hash
      if (found.state === 'error' || found.state === 'missingFiles') {
        await removeAll(true)
        throw new UpdateError('failed')
      }
      if (found.progress > best) {
        best = found.progress
        lastMoved = Date.now()
        onProgress(Math.floor(Math.min(found.progress, 1) * 100))
      }
      if (found.progress >= 1) break
    } else if (hash) {
      throw new UpdateError('missing')
    }
    if (Date.now() - lastMoved > stallMs) {
      await removeAll(true)
      throw new UpdateError('stalled')
    }
    await sleep(pollMs, signal)
  }

  try {
    await client.setPreferences({ alternative_webui_path: target.webUiPath })
  } catch {
    throw new UpdateError('switch')
  }
  await client.deleteTorrents([hash], false).catch(() => undefined)
}
