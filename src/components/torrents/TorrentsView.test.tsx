// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Torrent } from '@/types'

const torrent = (hash: string, name: string): Partial<Torrent> => ({
  hash, name, state: 'uploading', progress: 1, size: 1000, total_size: 1000, amount_left: 0, completed: 1000,
  dlspeed: 0, upspeed: 0, uploaded: 0, ratio: 1, eta: 8640000, num_seeds: 1, num_complete: 1, num_leechs: 0, num_incomplete: 0,
  category: '', tags: '', tracker: '', trackers_count: 0, magnet_uri: '', force_start: false, auto_tmm: false, priority: 0,
  added_on: 1, completion_on: 2, save_path: '/data',
})

const api = vi.hoisted(() => ({
  getMainData: async () => ({
    rid: 1,
    full_update: true,
    torrents: Object.fromEntries(['alpha', 'bravo', 'charlie', 'delta'].map((name, i) => [`h${i}`, torrent(`h${i}`, name)])),
    server_state: { dl_info_speed: 0, up_info_speed: 0 },
  }),
  getCategories: async () => ({}),
  getTags: async () => [],
  getWebApiVersion: async () => '2.11.3',
  deleteTorrents: vi.fn(async () => undefined),
  pauseTorrents: vi.fn(async () => undefined),
}))

// Anything else the page asks for answers with an empty list.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, qbitClient: new Proxy(api, { get: (target, key) => (key in target ? target[key as keyof typeof target] : async () => []) }) }
})

const { TorrentsView } = await import('./TorrentsView')

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><TorrentsView /></QueryClientProvider>)
  return screen.findByText('alpha')
}

const row = (name: string) => within(screen.getAllByRole('table').at(-1)!).getByText(name).closest('tr') as HTMLElement
const selectedNames = () => screen.queryAllByRole('row').filter(r => r.getAttribute('aria-selected') === 'true').map(r => within(r).getAllByRole('cell')[2].textContent)

describe('the torrent list', () => {
  beforeEach(() => {
    api.deleteTorrents.mockClear()
    api.pauseTorrents.mockClear()
  })

  it('selects a clicked row and opens its details', async () => {
    await renderView()
    await userEvent.click(row('bravo'))
    expect(selectedNames()).toEqual(['bravo'])
    expect(screen.getByRole('toolbar', { name: 'Selected torrents' })).toHaveTextContent(/1\/\d+ selected/)
    expect(await screen.findByRole('region', { name: 'Torrent details' })).toHaveTextContent('bravo')
  })

  it('adds with Ctrl, selects ranges with Shift, and closes on a second click', async () => {
    await renderView()
    const user = userEvent.setup()
    await user.click(row('alpha'))
    await user.keyboard('{Shift>}')
    await user.click(row('charlie'))
    await user.keyboard('{/Shift}')
    expect(selectedNames()).toEqual(['alpha', 'bravo', 'charlie'])
    await user.keyboard('{Control>}')
    await user.click(row('bravo'))
    await user.keyboard('{/Control}')
    expect(selectedNames()).toEqual(['alpha', 'charlie'])

    await user.click(row('delta'))
    expect(selectedNames()).toEqual(['delta'])
    await user.click(row('delta'))
    expect(selectedNames()).toEqual([])
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Torrent details' })).toBeNull())
  })

  it('moves with the arrow keys and clears with Escape', async () => {
    await renderView()
    const user = userEvent.setup()
    await user.click(row('alpha'))
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(selectedNames()).toEqual(['charlie'])
    expect(row('charlie')).toHaveFocus()
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}')
    expect(selectedNames()).toEqual(['bravo', 'charlie'])
    await user.keyboard('{Escape}{Escape}')
    expect(selectedNames()).toEqual([])
  })

  it('starts selecting on a long press and toggles with taps after that', async () => {
    await renderView()
    const touch = { pointerType: 'touch', clientX: 10, clientY: 10 }
    fireEvent.pointerDown(row('bravo'), touch)
    await act(() => new Promise(resolve => setTimeout(resolve, 600)))
    fireEvent.pointerUp(row('bravo'), touch)
    fireEvent.click(row('bravo'))
    expect(selectedNames()).toEqual(['bravo'])

    fireEvent.pointerDown(row('delta'), touch)
    fireEvent.pointerUp(row('delta'), touch)
    fireEvent.click(row('delta'))
    expect(selectedNames()).toEqual(['bravo', 'delta'])
    expect(screen.queryByRole('region', { name: 'Torrent details' })).toBeNull()
  })

  it('deletes with files when ticked, and the lock remembers it for next time', async () => {
    await renderView()
    const user = userEvent.setup()
    await user.click(row('alpha'))
    await user.keyboard('{Delete}')
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('checkbox', { name: 'Also delete the downloaded files' }))
    await user.click(within(dialog).getByRole('button', { name: 'Remember this choice' }))
    await user.click(within(dialog).getByRole('button', { name: 'Delete with files' }))
    expect(api.deleteTorrents).toHaveBeenCalledWith(['h0'], true)

    await user.click(row('bravo'))
    await user.keyboard('{Delete}')
    expect(await screen.findByRole('checkbox', { name: 'Also delete the downloaded files' })).toBeChecked()
  })

  it('acts on the selection from the right-click menu', async () => {
    await renderView()
    const user = userEvent.setup()
    await user.click(row('alpha'))
    await user.keyboard('{Control>}')
    await user.click(row('charlie'))
    await user.keyboard('{/Control}')
    fireEvent.contextMenu(row('charlie'))
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByText('2 torrents')).toBeTruthy()
    await user.click(within(menu).getByRole('menuitem', { name: 'Stop' }))
    expect(api.pauseTorrents).toHaveBeenCalledWith(['h0', 'h2'])
  })
})
