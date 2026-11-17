// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => {
  const state = { added: false, progress: 0 }
  return {
    state,
    getPreferences: vi.fn(async () => ({ alternative_webui_enabled: true, alternative_webui_path: '/opt/qbminimal' })),
    addTorrents: vi.fn(async () => { state.added = true; return { success_count: 1, failure_count: 0, pending_count: 0 } }),
    getTorrentsInfo: vi.fn(async () => (state.added ? [{ hash: 'abc', name: 'qbminimal-9.9.9', state: 'downloading', save_path: '/opt', progress: (state.progress = Math.min(1, state.progress + 0.5)) }] : [])),
    setPreferences: vi.fn(async () => undefined),
    deleteTorrents: vi.fn(async () => undefined),
  }
})

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, qbitClient: new Proxy(api, { get: (target, key) => (key in target ? target[key as keyof typeof target] : async () => []) }) }
})

vi.mock('@/hooks/useUpdateNotice', () => ({
  useUpdateNotice: () => ({
    lastChecked: 1,
    latest: { qbminimal: '9.9.9', qbittorrent: '5.0.0', qbminimalTorrent: 'https://github.com/kajover/qbminimal/releases/download/v9.9.9/qbminimal-update.torrent' },
    qbminimalNewer: true,
    qbittorrentNewer: false,
  }),
}))

const { UpdateCheck } = await import('./UpdateCheck')
const { pageActions } = await import('@/lib/selfUpdate')

function renderIt() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><UpdateCheck /></QueryClientProvider>)
}

describe('install update', () => {
  beforeEach(() => {
    api.state.added = false
    api.state.progress = 0
    for (const mock of [api.addTorrents, api.setPreferences, api.deleteTorrents]) mock.mockClear()
    pageActions.reload = vi.fn()
  })

  it('asks first, then downloads, switches the Web UI, and reloads only when asked', async () => {
    renderIt()
    await userEvent.click(await screen.findByRole('button', { name: 'Install update' }))
    expect(api.addTorrents).not.toHaveBeenCalled()
    await userEvent.click(await screen.findByRole('button', { name: 'Install' }))

    await waitFor(() => expect(api.setPreferences).toHaveBeenCalledWith({ alternative_webui_path: '/opt/qbminimal-9.9.9' }), { timeout: 5000 })
    expect(api.addTorrents).toHaveBeenCalledWith(expect.objectContaining({ savepath: '/opt' }), [])
    expect((api.addTorrents.mock.calls as unknown as [Record<string, string>][])[0][0]).not.toHaveProperty('tags')
    await waitFor(() => expect(api.deleteTorrents).toHaveBeenCalledWith(['abc'], false))
    const reload = await screen.findByRole('button', { name: 'Reload' }, { timeout: 3000 })
    expect(pageActions.reload).not.toHaveBeenCalled()
    await userEvent.click(reload)
    expect(pageActions.reload).toHaveBeenCalled()
  })

  it('offers no install without an alternative Web UI', async () => {
    api.getPreferences.mockResolvedValueOnce({ alternative_webui_enabled: false, alternative_webui_path: '' })
    renderIt()
    await screen.findByText('Version 9.9.9 is available')
    await waitFor(() => expect(api.getPreferences).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Install update' })).toBeNull()
  })
})
