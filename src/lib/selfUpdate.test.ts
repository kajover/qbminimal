import { describe, expect, it, vi } from 'vitest'
import { canInstall, installUpdate, updateTarget, UpdateError, type UpdateClient } from './selfUpdate'

describe('update folder', () => {
  it('puts the new version next to the current folder, in the same path style', () => {
    expect(updateTarget('/opt/qbminimal', '1.2.3')).toEqual({ savePath: '/opt', name: 'qbminimal-1.2.3', webUiPath: '/opt/qbminimal-1.2.3' })
    expect(updateTarget('/opt/qbminimal/', '1.2.3')?.webUiPath).toBe('/opt/qbminimal-1.2.3')
    expect(updateTarget('/home/me/web uis/qbminimal//', '1.2.3')?.savePath).toBe('/home/me/web uis')
    expect(updateTarget('C:\\Apps\\qbminimal', '1.2.3')).toEqual({ savePath: 'C:\\Apps', name: 'qbminimal-1.2.3', webUiPath: 'C:\\Apps\\qbminimal-1.2.3' })
    expect(updateTarget('C:\\Apps\\qbminimal\\', '1.2.3')?.webUiPath).toBe('C:\\Apps\\qbminimal-1.2.3')
  })

  it('keeps the root or the drive as the parent', () => {
    expect(updateTarget('/qbminimal', '1.0.0')).toEqual({ savePath: '/', name: 'qbminimal-1.0.0', webUiPath: '/qbminimal-1.0.0' })
    expect(updateTarget('C:\\qbminimal', '1.0.0')).toEqual({ savePath: 'C:\\', name: 'qbminimal-1.0.0', webUiPath: 'C:\\qbminimal-1.0.0' })
    expect(updateTarget('C:/qbminimal', '1.0.0')?.webUiPath).toBe('C:/qbminimal-1.0.0')
  })

  it('has no answer without a parent folder', () => {
    expect(updateTarget('qbminimal', '1.0.0')).toBeNull()
    expect(updateTarget('  ', '1.0.0')).toBeNull()
    expect(updateTarget('/', '1.0.0')).toBeNull()
  })

  it('offers the install only with a torrent and an alternative Web UI folder', () => {
    const url = 'https://example.org/qbminimal-update.torrent'
    expect(canInstall({ alternative_webui_enabled: true, alternative_webui_path: '/opt/qbminimal' }, url)).toBe(true)
    expect(canInstall({ alternative_webui_enabled: true, alternative_webui_path: '/opt/qbminimal' }, undefined)).toBe(false)
    expect(canInstall({ alternative_webui_enabled: false, alternative_webui_path: '/opt/qbminimal' }, url)).toBe(false)
    expect(canInstall({ alternative_webui_enabled: true, alternative_webui_path: '' }, url)).toBe(false)
    expect(canInstall(undefined, url)).toBe(false)
  })
})

function fakeClient(progress: number[], state = 'downloading') {
  let polls = 0
  let added = false
  const client = {
    addTorrents: vi.fn(async () => { added = true; return { success_count: 1, failure_count: 0, pending_count: 0 } }),
    getTorrentsByTag: vi.fn(async () => {
      if (!added) return []
      const value = progress[Math.min(polls++, progress.length - 1)]
      return [{ hash: 'abc', name: 'qbminimal-1.2.3', state, progress: value }]
    }),
    setPreferences: vi.fn(async () => undefined),
    deleteTorrents: vi.fn(async () => undefined),
  } satisfies UpdateClient
  return client
}

const run = (client: UpdateClient, extra: Partial<Parameters<typeof installUpdate>[0]> = {}) => installUpdate({
  client, torrentUrl: 'https://example.org/qbminimal-update.torrent', version: '1.2.3', currentPath: '/opt/qbminimal',
  onProgress: () => undefined, pollMs: 1, ...extra,
})

describe('install update', () => {
  it('adds the torrent, waits for it, switches the Web UI and removes the torrent but not its files', async () => {
    const client = fakeClient([0, 0.4, 1])
    const percents: number[] = []
    await run(client, { onProgress: percent => percents.push(percent) })
    expect(client.addTorrents).toHaveBeenCalledWith(expect.objectContaining({
      urls: 'https://example.org/qbminimal-update.torrent', savepath: '/opt', autoTMM: 'false', contentLayout: 'Original', tags: 'qbminimal-update', stopped: 'false',
    }), [])
    expect(percents).toEqual([0, 40, 100])
    expect(client.setPreferences).toHaveBeenCalledWith({ alternative_webui_path: '/opt/qbminimal-1.2.3' })
    expect(client.deleteTorrents).toHaveBeenCalledWith(['abc'], false)
  })

  it('reports a refused add', async () => {
    const client = fakeClient([1])
    client.addTorrents.mockResolvedValueOnce({ success_count: 0, failure_count: 1, pending_count: 0 })
    await expect(run(client)).rejects.toMatchObject({ reason: 'add' })
    client.addTorrents.mockRejectedValueOnce(new Error('offline'))
    await expect(run(client)).rejects.toBeInstanceOf(UpdateError)
    expect(client.setPreferences).not.toHaveBeenCalled()
  })

  it('gives up when the progress stays the same, and removes what it added', async () => {
    const client = fakeClient([0.2])
    await expect(run(client, { stallMs: 20 })).rejects.toMatchObject({ reason: 'stalled' })
    expect(client.deleteTorrents).toHaveBeenCalledWith(['abc'], true)
    expect(client.setPreferences).not.toHaveBeenCalled()
  })

  it('stops on a torrent error', async () => {
    const client = fakeClient([0.1], 'error')
    await expect(run(client)).rejects.toMatchObject({ reason: 'failed' })
  })

  it('removes the torrent with its files when canceled', async () => {
    const client = fakeClient([0.1])
    const control = new AbortController()
    const done = run(client, { signal: control.signal, pollMs: 50 })
    setTimeout(() => control.abort(), 10)
    await expect(done).rejects.toMatchObject({ reason: 'canceled' })
    expect(client.deleteTorrents).toHaveBeenCalledWith(['abc'], true)
  })

  it('does not add the torrent twice after an earlier try', async () => {
    const client = fakeClient([1])
    await run(client)
    client.addTorrents.mockClear()
    // The torrent is still listed, as after a reload in the middle of a download.
    await run(client)
    expect(client.addTorrents).not.toHaveBeenCalled()
  })
})

describe('updateTarget and the folder in use', () => {
  it('refuses a new folder that is the one qBittorrent uses now', () => {
    expect(updateTarget('/opt/qbminimal-1.6.8', '1.6.8')).toBeNull()
  })
})
