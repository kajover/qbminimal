// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => {
  const state = { status: 'Stopped', nextId: 1, searches: [] as { id: number; status: string; total: number }[] }
  const results = ['ubuntu-desktop.iso', 'ubuntu-server.iso'].map((fileName, i) => ({
    fileName, fileUrl: `https://example.org/${i}.torrent`, fileSize: 1000 * (i + 1), nbSeeders: 10 - i, nbLeechers: i,
    siteUrl: 'https://example.org', descrLink: `https://example.org/${i}`, engineName: 'demo', pubDate: 1_700_000_000,
  }))
  return {
    state,
    searchPlugins: vi.fn(async () => [{ name: 'demo', fullName: 'Demo', enabled: true, version: '1', url: '', supportedCategories: [{ id: 'movies', name: 'Movies' }] }]),
    startSearch: vi.fn(async () => {
      const id = state.nextId++
      state.searches.push({ id, status: state.status, total: results.length })
      return { id }
    }),
    stopSearch: vi.fn(async () => undefined),
    deleteSearch: vi.fn(async (id: number) => { state.searches = state.searches.filter(search => search.id !== id) }),
    getSearchStatus: vi.fn(async () => api.state.searches),
    getSearchResults: vi.fn(async () => ({ results, status: state.status })),
  }
})

// Anything else the page asks for answers with an empty list.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, qbitClient: new Proxy(api, { get: (target, key) => (key in target ? target[key as keyof typeof target] : async () => []) }) }
})

const { SearchView } = await import('./SearchView')
const { forgetShownSearch } = await import('@/hooks/useSearchJob')

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><SearchView /></QueryClientProvider>)
}

const field = () => screen.getByRole('searchbox', { name: 'Search for' })

async function search(text = 'ubuntu') {
  await userEvent.type(field(), text)
  await userEvent.click(screen.getByRole('button', { name: 'Search' }))
}

// The buttons above the results that show, in order: those in a hidden part are left out.
const toolbar = () => {
  const bar = screen.getByRole('button', { name: /^Filters/ }).parentElement!
  return within(bar).getAllByRole('button').filter(button => !button.closest('.hidden')).map(button => button.getAttribute('aria-label'))
}

describe('search', () => {
  beforeEach(() => {
    api.state.status = 'Stopped'
    api.state.nextId = 1
    api.state.searches = []
    for (const mock of [api.startSearch, api.stopSearch, api.deleteSearch]) mock.mockClear()
    forgetShownSearch()
    // The sidebar starts closed; most tests here use it.
    localStorage.setItem('qbminimal.searchSidebar', 'open')
  })

  it('shows name, size, seeds, leeches and plugin, with Published hidden and no Source', async () => {
    renderView()
    await search()
    await screen.findAllByText('ubuntu-desktop.iso')
    const titles = within(screen.getAllByRole('table')[0]).getAllByRole('columnheader').map(th => th.textContent?.trim())
    expect(titles).toEqual(['Name', 'Size', 'Seeds', 'Leeches', 'Plugin', 'Actions'])
  })

  it('searches with every enabled plugin, filters results by plugin, and searches again in a category', async () => {
    renderView()
    const sidebar = screen.getByRole('complementary', { name: 'Filters' })
    expect(within(sidebar).getByRole('button', { name: 'Manage plugins' })).toBeInTheDocument()
    await search()
    expect(api.startSearch).toHaveBeenCalledWith('ubuntu', 'enabled', 'all')
    await screen.findAllByText('ubuntu-desktop.iso')

    // Plugins and categories start folded.
    await userEvent.click(within(sidebar).getByRole('button', { name: /^Plugins/, expanded: false }))
    // A plugin shows how many results it found, and picking it shows only those.
    const demo = within(sidebar).getByRole('checkbox', { name: /^Demo/ })
    expect(demo).toHaveTextContent('2')
    await userEvent.click(demo)
    expect(screen.getByRole('button', { name: 'Filters (on)' })).toBeInTheDocument()
    await userEvent.click(within(sidebar).getByRole('button', { name: 'Clear the Plugins filter' }))

    // Picking a category searches again in it.
    await userEvent.click(within(sidebar).getByRole('button', { name: /^Categories/, expanded: false }))
    await userEvent.click(within(sidebar).getByRole('checkbox', { name: /Movies/ }))
    await waitFor(() => expect(api.startSearch).toHaveBeenLastCalledWith('ubuntu', 'enabled', 'movies'))
  })

  it('gives every column, the name too, a resize handle, and saves a fitted width', async () => {
    renderView()
    await search()
    await screen.findAllByText('ubuntu-desktop.iso')
    const labels = screen.getAllByRole('separator').map(handle => handle.getAttribute('aria-label'))
    expect(labels).toEqual(['Resize Name', 'Resize Size', 'Resize Seeds', 'Resize Leeches', 'Resize Plugin'])
    expect(screen.getByRole('separator', { name: 'Resize Name' })).toHaveAttribute('title', 'Drag to resize. Double-click to fit the content.')

    await userEvent.dblClick(screen.getByRole('separator', { name: 'Resize Name' }))
    expect(JSON.parse(localStorage.getItem('qbminimal.searchWidths')!)).toHaveProperty('fileName')
  })

  it('goes through the table, the compact table and cards, the button showing the one on screen', async () => {
    renderView()
    await search()
    await screen.findAllByText('ubuntu-desktop.iso')
    expect(toolbar()).toEqual(['Columns', 'Table view', 'Filters'])

    await userEvent.click(screen.getByRole('button', { name: 'Table view' }))
    expect(toolbar()).toEqual(['Columns', 'Compact view', 'Filters'])
    expect(localStorage.getItem('qbminimal.searchView')).toBe('compact')

    await userEvent.click(screen.getByRole('button', { name: 'Compact view' }))
    expect(toolbar()).toEqual(['Sort: Seeds', 'Card view', 'Filters'])
    expect(screen.getAllByRole('table')[0].closest('.hidden')).not.toBeNull()
    expect(localStorage.getItem('qbminimal.searchView')).toBe('cards')

    // Wide screens show the table by default, so going back to it keeps no choice.
    await userEvent.click(screen.getByRole('button', { name: 'Card view' }))
    expect(toolbar()).toEqual(['Columns', 'Table view', 'Filters'])
    expect(localStorage.getItem('qbminimal.searchView')).toBeNull()
  })

  it('stops a running search from the search button, without starting another', async () => {
    api.state.status = 'Running'
    renderView()
    await search()
    const stop = await within(field().closest('form')!).findByRole('button', { name: 'Stop search' })

    await userEvent.click(stop)
    // A second click right after, as when a search ends just before the click.
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(api.stopSearch).toHaveBeenCalledWith(1)
    expect(api.startSearch).toHaveBeenCalledTimes(1)
  })

  it('stops a running search from the button after its text was deleted', async () => {
    api.state.status = 'Running'
    renderView()
    await search()
    const stop = await within(field().closest('form')!).findByRole('button', { name: 'Stop search' })
    await userEvent.clear(field())
    expect(field()).toBeValid()
    await userEvent.click(stop)
    expect(api.stopSearch).toHaveBeenCalledWith(1)
  })

  it('stops a running search with Enter in the field', async () => {
    api.state.status = 'Running'
    renderView()
    await search()
    await within(field().closest('form')!).findByRole('button', { name: 'Stop search' })

    await userEvent.type(field(), '{Enter}')

    expect(api.stopSearch).toHaveBeenCalledWith(1)
    expect(api.startSearch).toHaveBeenCalledTimes(1)
  })

  it('deletes earlier searches and hides the list unless past searches are kept', async () => {
    localStorage.setItem('qbminimal.keepSearches', 'off')
    api.state.searches = [{ id: 7, status: 'Stopped', total: 3 }]
    api.state.nextId = 8
    renderView()
    await search()

    await waitFor(() => expect(api.deleteSearch).toHaveBeenCalledWith(7))
    expect(api.deleteSearch).not.toHaveBeenCalledWith(8)
    expect(screen.queryByRole('button', { name: 'Delete every search' })).toBeNull()
  })

  it('keeps earlier searches and lists them when turned on', async () => {
    localStorage.setItem('qbminimal.keepSearches', 'on')
    api.state.searches = [{ id: 7, status: 'Stopped', total: 3 }]
    api.state.nextId = 8
    renderView()
    await search()

    expect(await screen.findByRole('button', { name: 'Delete every search' })).toBeInTheDocument()
    expect(api.deleteSearch).not.toHaveBeenCalled()
  })

  it('replaces a kept search when the same one runs again, and keeps the others', async () => {
    localStorage.setItem('qbminimal.keepSearches', 'on')
    api.state.searches = [{ id: 6, status: 'Stopped', total: 3 }, { id: 7, status: 'Stopped', total: 3 }, { id: 8, status: 'Stopped', total: 3 }]
    api.state.nextId = 9
    localStorage.setItem('qbminimal.searchPatterns', JSON.stringify({
      6: { pattern: 'debian', plugins: 'enabled', category: 'all' },
      7: { pattern: 'ubuntu', plugins: 'enabled', category: 'all' },
      8: { pattern: 'ubuntu', plugins: 'enabled', category: 'movies' },
    }))
    renderView()
    await search()

    await waitFor(() => expect(api.deleteSearch).toHaveBeenCalledWith(7))
    expect(api.deleteSearch).toHaveBeenCalledTimes(1)
    expect(Object.keys(JSON.parse(localStorage.getItem('qbminimal.searchPatterns')!))).toEqual(['6', '8', '9'])
  })

  it('opens another saved search while one runs, and stops the running one from its own button', async () => {
    localStorage.setItem('qbminimal.keepSearches', 'on')
    api.state.searches = [{ id: 3, status: 'Running', total: 2 }, { id: 4, status: 'Stopped', total: 2 }]
    renderView()
    const sidebar = screen.getByRole('complementary', { name: 'Filters' })
    await userEvent.click(await within(sidebar).findByRole('button', { name: /^Search 4/ }))
    await waitFor(() => expect(api.getSearchResults).toHaveBeenCalledWith(4))
    await userEvent.click(within(sidebar).getByRole('button', { name: 'Stop search' }))
    expect(api.stopSearch).toHaveBeenCalledWith(3)
  })

  it('lists the latest ten searches, and more on request', async () => {
    localStorage.setItem('qbminimal.keepSearches', 'on')
    api.state.searches = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, status: 'Stopped', total: 1 }))
    renderView()
    const sidebar = screen.getByRole('complementary', { name: 'Filters' })
    // Each name's span carries it whole as its title.
    expect(await within(sidebar).findByTitle('Search 12')).toBeInTheDocument()
    expect(within(sidebar).getByTitle('Search 3')).toBeInTheDocument()
    expect(within(sidebar).queryByTitle('Search 2')).toBeNull()
    await userEvent.click(within(sidebar).getByRole('button', { name: /Show more/ }))
    expect(within(sidebar).getByTitle('Search 1')).toBeInTheDocument()
    expect(within(sidebar).queryByRole('button', { name: /Show more/ })).toBeNull()
  })

  it('starts with the sidebar closed, and deletes past searches when keeping them is turned off', async () => {
    localStorage.removeItem('qbminimal.searchSidebar')
    localStorage.setItem('qbminimal.keepSearches', 'on')
    api.state.searches = [{ id: 3, status: 'Stopped', total: 2 }, { id: 4, status: 'Stopped', total: 2 }]
    renderView()
    expect(screen.queryByRole('complementary', { name: 'Filters' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }))
    const sidebar = screen.getByRole('complementary', { name: 'Filters' })
    await within(sidebar).findByTitle('Search 4')
    await userEvent.click(within(sidebar).getByRole('button', { name: 'Saved search settings' }))
    await userEvent.click(await screen.findByRole('switch', { name: 'Keep past searches' }))
    await waitFor(() => expect(api.deleteSearch).toHaveBeenCalledTimes(2))
    expect(localStorage.getItem('qbminimal.keepSearches')).toBeNull()
  })

  it('asks for text instead of starting an empty search', async () => {
    renderView()
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Fill in this field')
    expect(api.startSearch).not.toHaveBeenCalled()
  })
})
