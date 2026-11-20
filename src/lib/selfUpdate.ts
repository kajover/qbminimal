// Installs a new qbminimal through qBittorrent itself. qBittorrent can't write a file it is given,
// but it can download a torrent. Each release has a torrent of the unpacked app that only has a
// web seed on GitHub, so it is added next to the current Web UI folder, and the Web UI path is then
// pointed at the new folder.
import type { Torrent } from '@/types'
import { isNewer, parseVersion, UPDATE_TORRENT_ASSET } from './updates'

// Tags earlier versions put on their update torrents. The update torrents are now found by their
// name and folder instead, so no tag shows in the filters; these are deleted when they're left over.
export const OLD_TAGS = ['qbminimal-update', 'qbminimal-cleanup']

// Whether two folders are the same, whatever slash ends them.
const sameFolder = (a: string | undefined, b: string) => (a ?? '').replace(/[\\/]+$/, '') === b.replace(/[\\/]+$/, '')
// How long the download may stay at the same progress.
export const STALL_MS = 60_000

// The folder that holds the current Web UI's `public` folder, and where its new version goes.
// Works for `/` and `\` paths, with or without a trailing slash, and for Windows drives.
export function updateTarget(currentPath: string, version: string): { savePath: string; name: string; webUiPath: string } | null {
  const trimmed = currentPath.trim().replace(/[\\/]+$/, '')
  const split = splitFolder(trimmed)
  if (!split) return null
  const { parent: savePath, separator } = split
  const name = `qbminimal-${version}`
  const webUiPath = savePath.endsWith(separator) ? savePath + name : `${savePath}${separator}${name}`
  // Never the folder in use: cancelling deletes the download's files, which would then be the app's own.
  if (webUiPath === trimmed) return null
  return { savePath, name, webUiPath }
}

// A folder's parent and its own name. "/qbminimal" has the root as its parent, and "C:\qbminimal"
// the drive.
function splitFolder(path: string): { parent: string; name: string; separator: string } | null {
  const trimmed = path.trim().replace(/[\\/]+$/, '')
  const at = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  if (!trimmed || at < 0) return null
  const separator = trimmed[at]
  let parent = trimmed.slice(0, at)
  if (!parent || /^[A-Za-z]:$/.test(parent)) parent += separator
  return { parent, name: trimmed.slice(at + 1), separator }
}

// Whether the update can be installed from here: qBittorrent has to use an alternative Web UI at
// a folder we can find the parent of. Never in the demo, which has no qBittorrent to install into.
export function canInstall(prefs: Record<string, unknown> | undefined, torrentUrl: string | undefined): prefs is Record<string, unknown> {
  const path = prefs?.alternative_webui_path
  return !__DEMO__ && !!torrentUrl && prefs?.alternative_webui_enabled === true && typeof path === 'string' && updateTarget(path, '0.0.0') !== null
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
  getTorrentsInfo(): Promise<Pick<Torrent, 'hash' | 'name' | 'state' | 'progress' | 'save_path'>[]>
  deleteTags(tags: string[]): Promise<unknown>
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
  // The version that's running now, whose folder is removed once the new one is in use.
  currentVersion?: string
  // Called once qBittorrent has taken the update's torrent.
  onAdded?: () => void
}

// The torrent of a release, which every release from 1.6.8 on has. Older folders can't be removed
// this way, as qBittorrent only deletes files that belong to a torrent.
export function releaseTorrentUrl(version: string): string | null {
  const parsed = parseVersion(version)
  if (!parsed || isNewer([1, 6, 8], parsed)) return null
  return `https://github.com/kajover/qbminimal/releases/download/v${parsed.join('.')}/${UPDATE_TORRENT_ASSET}`
}

// Removes the previous version: its own release torrent is added over its folder, stopped and
// unchecked, and deleted with its files. Only the files that release had go. A folder an update
// made is named like the torrent's own folder, so it's added as that folder, and qBittorrent
// removes the folder too once it's empty, as for any torrent. A folder named otherwise, as one
// copied by hand, gets the files only and stays, empty. Says whether it worked.
export async function removeOldVersion(client: UpdateClient, version: string, folder: string, pollMs = 1000): Promise<boolean> {
  const url = releaseTorrentUrl(version)
  const split = splitFolder(folder)
  if (!url || !split) return false
  const whole = split.name === `qbminimal-${version}`
  const savePath = whole ? split.parent : folder.trim().replace(/[\\/]+$/, '')
  try {
    await client.addTorrents({
      urls: url, savepath: savePath, autoTMM: 'false', contentLayout: whole ? 'Original' : 'NoSubfolder',
      paused: 'true', stopped: 'true', skip_checking: 'true',
    }, [])
    // qBittorrent downloads the .torrent first, which takes a moment.
    for (let tries = 0; tries < 30; tries++) {
      // Only this release's torrent in exactly that folder, so no other torrent's files are touched.
      const found = (await client.getTorrentsInfo()).find(torrent => torrent.name === `qbminimal-${version}` && sameFolder(torrent.save_path, savePath))
      if (found) {
        await client.deleteTorrents([found.hash], true)
        return true
      }
      await sleep(pollMs)
    }
  } catch {
    // The update itself worked; the old folder just stays.
  }
  return false
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
// Says whether the previous version's files were removed too.
export async function installUpdate({ client, torrentUrl, version, currentPath, onProgress, signal, pollMs = 1000, stallMs = STALL_MS, currentVersion, onAdded }: InstallOptions): Promise<{ oldRemoved: boolean }> {
  const target = updateTarget(currentPath, version)
  if (!target) throw new UpdateError('add')
  const mine = async () => (await client.getTorrentsInfo()).filter(torrent => torrent.name === target.name && sameFolder(torrent.save_path, target.savePath))
  const removeAll = async (deleteFiles: boolean) => {
    const hashes = (await mine().catch(() => [])).map(torrent => torrent.hash)
    if (hashes.length) await client.deleteTorrents(hashes, deleteFiles).catch(() => undefined)
  }

  // A torrent left by an earlier try carries on instead of being added twice.
  try {
    if (!(await mine()).length) {
      const result = await client.addTorrents({
        urls: torrentUrl, savepath: target.savePath, autoTMM: 'false', contentLayout: 'Original',
        paused: 'false', stopped: 'false',
      }, []) as { failure_count?: number; success_count?: number; pending_count?: number } | undefined
      if (result?.failure_count && !result.success_count && !result.pending_count) throw new Error('refused')
      onAdded?.()
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
  // Only once qBittorrent serves the new folder, so the old one is no longer in use.
  const oldRemoved = currentVersion ? await removeOldVersion(client, currentVersion, currentPath.trim(), pollMs) : false
  await client.deleteTags(OLD_TAGS).catch(() => undefined)
  return { oldRemoved }
}
