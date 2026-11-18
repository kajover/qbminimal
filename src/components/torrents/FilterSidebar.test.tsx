// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Torrent } from '@/types'

const torrent = (hash: string, name: string, category: string, tags: string): Partial<Torrent> => ({
  hash, name, category, tags, state: 'uploading', progress: 1, size: 1000, total_size: 1000, amount_left: 0, completed: 1000,
  dlspeed: 0, upspeed: 0, uploaded: 0, ratio: 1, eta: 8640000, num_seeds: 1, num_complete: 1, num_leechs: 0, num_incomplete: 0,
  tracker: '', trackers_count: 0, magnet_uri: '', force_start: false, auto_tmm: false, priority: 0, added_on: 1, completion_on: 2, save_path: '/data',
})

const api = vi.hoisted(() => ({
  getMainData: async () => ({
    rid: 1,
    full_update: true,
    torrents: {
      h0: torrent('h0', 'alpha', 'Linux', 'iso'),
      h1: torrent('h1', 'bravo', 'Video', 'hd'),
      h2: torrent('h2', 'charlie', '', ''),
    },
    server_state: { dl_info_speed: 0, up_info_speed: 0 },
  }),
  getCategories: async () => ({ Linux: { name: 'Linux', savePath: '/data/linux' }, Video: { name: 'Video', savePath: '' } }),
  getTags: async () => ['iso', 'hd'],
  getWebApiVersion: async () => '2.11.3',
  createCategory: vi.fn(async () => undefined),
  editCategory: vi.fn(async () => undefined),
  setCategory: vi.fn(async () => undefined),
  removeCategories: vi.fn(async () => undefined),
  createTags: vi.fn(async () => undefined),
  addTags: vi.fn(async () => undefined),
  removeTags: vi.fn(async () => undefined),
  deleteTags: vi.fn(async () => undefined),
}))

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, qbitClient: new Proxy(api, { get: (target, key) => (key in target ? target[key as keyof typeof target] : async () => []) }) }
})

const { TorrentsView } = await import('./TorrentsView')

async function openSidebar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><TorrentsView /></QueryClientProvider>)
  await screen.findByText('alpha')
  await userEvent.click(screen.getByRole('button', { name: /^Search and filter/ }))
  const sidebar = screen.getByRole('complementary', { name: 'Filters' })
  await within(sidebar).findByRole('checkbox', { name: /Linux/ })
  return sidebar
}

const shown = () => ['alpha', 'bravo', 'charlie'].filter(name => within(screen.getAllByRole('table').at(-1)!).queryByText(name))

describe('the filter sidebar', () => {
  beforeEach(() => {
    for (const mock of [api.createCategory, api.editCategory, api.setCategory, api.removeCategories, api.createTags, api.addTags, api.removeTags, api.deleteTags]) mock.mockClear()
  })

  it('shows torrents in any of the chosen categories, and those without one', async () => {
    const sidebar = await openSidebar()
    await userEvent.click(within(sidebar).getByRole('checkbox', { name: /Linux/ }))
    expect(shown()).toEqual(['alpha'])
    await userEvent.click(within(sidebar).getByRole('checkbox', { name: /Video/ }))
    expect(shown()).toEqual(['alpha', 'bravo'])
    await userEvent.click(within(sidebar).getByRole('checkbox', { name: /Uncategorized/ }))
    expect(shown()).toEqual(['alpha', 'bravo', 'charlie'])
    await userEvent.click(within(sidebar).getByRole('checkbox', { name: /Linux/ }))
    expect(shown()).toEqual(['bravo', 'charlie'])
  })

  it('combines tags with categories', async () => {
    const sidebar = await openSidebar()
    await userEvent.click(within(sidebar).getByRole('checkbox', { name: /Untagged/ }))
    await userEvent.click(within(sidebar).getByRole('checkbox', { name: /^iso/ }))
    expect(shown()).toEqual(['alpha', 'charlie'])
    await userEvent.click(within(sidebar).getByRole('checkbox', { name: /Linux/ }))
    expect(shown()).toEqual(['alpha'])
  })

  it('deletes a category from its menu and stops filtering by it', async () => {
    const sidebar = await openSidebar()
    await userEvent.click(within(sidebar).getByRole('checkbox', { name: /Linux/ }))
    await userEvent.click(within(sidebar).getByRole('button', { name: 'More actions for Linux' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Delete the Linux category?')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(api.removeCategories).toHaveBeenCalledWith(['Linux'])
    await waitFor(() => expect(shown()).toEqual(['alpha', 'bravo', 'charlie']))
  })

  it('creates a category with its save path', async () => {
    const sidebar = await openSidebar()
    await userEvent.click(within(sidebar).getByRole('button', { name: 'New category' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'New category name' }), 'Books')
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Save path (blank = default)' }), '/data/books')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }))
    expect(api.createCategory).toHaveBeenCalledWith('Books', '/data/books')
  })

  it('renames a category, moving its torrents and keeping it chosen', async () => {
    const sidebar = await openSidebar()
    await userEvent.click(within(sidebar).getByRole('checkbox', { name: /Linux/ }))
    await userEvent.click(within(sidebar).getByRole('button', { name: 'More actions for Linux' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit category' }))
    const dialog = await screen.findByRole('dialog')
    const name = within(dialog).getByRole('textbox', { name: 'Name' })
    await userEvent.clear(name)
    await userEvent.type(name, 'Distros')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(api.createCategory).toHaveBeenCalledWith('Distros', '/data/linux')
    expect(api.setCategory).toHaveBeenCalledWith(['h0'], 'Distros')
    expect(api.removeCategories).toHaveBeenCalledWith(['Linux'])
  })

  it('changes only the save path when the name stays', async () => {
    const sidebar = await openSidebar()
    await userEvent.click(within(sidebar).getByRole('button', { name: 'More actions for Video' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit category' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Save path (blank = default)' }), '/data/video')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(api.editCategory).toHaveBeenCalledWith('Video', '/data/video')
    expect(api.createCategory).not.toHaveBeenCalled()
  })

  it('renames a tag on every torrent that has it, and refuses a name in use', async () => {
    const sidebar = await openSidebar()
    await userEvent.click(within(sidebar).getByRole('button', { name: 'More actions for iso' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }))
    const dialog = await screen.findByRole('dialog')
    const name = within(dialog).getByRole('textbox', { name: 'Name' })
    await userEvent.clear(name)
    await userEvent.type(name, 'hd')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(api.createTags).not.toHaveBeenCalled()

    await userEvent.clear(name)
    await userEvent.type(name, 'image')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(api.createTags).toHaveBeenCalledWith(['image'])
    expect(api.addTags).toHaveBeenCalledWith(['h0'], ['image'])
    expect(api.removeTags).toHaveBeenCalledWith(['h0'], ['iso'])
    expect(api.deleteTags).toHaveBeenCalledWith(['iso'])
  })

  it('renames a saved view', async () => {
    localStorage.setItem('qbminimal.filterViews', JSON.stringify([{ name: 'Mine', filters: { categories: ['Linux'] } }]))
    const sidebar = await openSidebar()
    await userEvent.click(within(sidebar).getByRole('button', { name: 'More actions for Mine' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }))
    const dialog = await screen.findByRole('dialog')
    const name = within(dialog).getByRole('textbox', { name: 'Name' })
    await userEvent.clear(name)
    await userEvent.type(name, 'Distros')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(within(sidebar).getByRole('button', { name: 'Distros' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('qbminimal.filterViews')!)[0].name).toBe('Distros')
  })

  it('lists column filters in the sidebar, where they can be removed', async () => {
    localStorage.setItem('qbminimal.columnFilters.torrents', JSON.stringify({ name: { type: 'text', op: 'contains', value: 'al' } }))
    const sidebar = await openSidebar()
    expect(shown()).toEqual(['alpha'])
    // The funnel shows a dot while a column filter is on.
    expect(within(sidebar).getByRole('button', { name: 'Column filter (filters on)' })).toBeInTheDocument()
    const group = within(sidebar).getByRole('group', { name: 'Column filters' })
    await userEvent.click(within(group).getByRole('button', { name: /Remove filter/ }))
    expect(shown()).toEqual(['alpha', 'bravo', 'charlie'])
    expect(within(sidebar).queryByRole('group', { name: 'Column filters' })).toBeNull()
    expect(within(sidebar).getByRole('button', { name: 'Column filter' })).toBeInTheDocument()
  })

  it('filters a column the sidebar covers with the sidebar\'s own tick boxes', async () => {
    localStorage.setItem('qbminimal.columnFilters.torrents', JSON.stringify({ state: { type: 'set', values: ['uploading'] } }))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><TorrentsView /></QueryClientProvider>)
    await screen.findAllByText('alpha')
    // An old Status column filter is gone, so nothing is hidden by it.
    expect(shown()).toEqual(['alpha', 'bravo', 'charlie'])

    await userEvent.click(screen.getByRole('button', { name: 'Filter Status' }))
    const popup = await screen.findByRole('dialog')
    await userEvent.click(within(popup).getByRole('checkbox', { name: /Errored/ }))
    expect(screen.getByText('No torrents match these filters')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')

    // The same choice is ticked in the sidebar, and there's no column filter for it.
    await userEvent.click(screen.getByRole('button', { name: /^Search and filter/ }))
    const sidebar = screen.getByRole('complementary', { name: 'Filters' })
    expect(within(sidebar).getByRole('checkbox', { name: /Errored/ })).toHaveAttribute('aria-checked', 'true')
    expect(within(sidebar).queryByRole('group', { name: 'Column filters' })).toBeNull()
  })

  it('hides what a choice matches with Ctrl and a click, and lets it go with another click', async () => {
    const sidebar = await openSidebar()
    const linux = within(sidebar).getByRole('checkbox', { name: /Linux/ })
    const user = userEvent.setup()
    await user.keyboard('{Control>}')
    await user.click(linux)
    await user.keyboard('{/Control}')
    expect(shown()).toEqual(['bravo', 'charlie'])
    expect(linux).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(linux)
    expect(shown()).toEqual(['alpha', 'bravo', 'charlie'])
  })

  it('narrows a section with its own search', async () => {
    const sidebar = await openSidebar()
    await userEvent.type(within(sidebar).getByRole('searchbox', { name: 'Search Categories' }), 'vid')
    expect(within(sidebar).queryByRole('checkbox', { name: /Linux/ })).toBeNull()
    expect(within(sidebar).getByRole('checkbox', { name: /Video/ })).toBeInTheDocument()
  })

  it('shows empty statuses only when asked, and folds trackers at first', async () => {
    const sidebar = await openSidebar()
    expect(within(sidebar).queryByRole('checkbox', { name: /Errored/ })).toBeNull()
    await userEvent.click(within(sidebar).getByRole('button', { name: 'Show empty statuses' }))
    expect(within(sidebar).getByRole('checkbox', { name: /Errored/ })).toBeInTheDocument()
    expect(within(sidebar).getByRole('button', { name: /Trackers/ })).toHaveAttribute('aria-expanded', 'false')
  })

  it('asks before deleting a view, and says when there are none', async () => {
    localStorage.setItem('qbminimal.filterViews', JSON.stringify([{ name: 'Mine', filters: { categories: ['Linux'] } }]))
    const sidebar = await openSidebar()
    await userEvent.click(within(sidebar).getByRole('button', { name: 'More actions for Mine' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove this view' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(sidebar).getByText('Mine')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(within(sidebar).queryByRole('button', { name: 'Mine' })).toBeNull()
    expect(within(sidebar).getByText(/No saved views yet/)).toBeInTheDocument()
  })
})
