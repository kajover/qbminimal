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
    searchPlugins: vi.fn(async () => [{ name: 'demo', fullName: 'Demo', enabled: true, version: '1', url: '', supportedCategories: [] }]),
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
  const bar = screen.getByRole('button', { name: 'Column filter' }).parentElement!
  return within(bar).getAllByRole('button').filter(button => !button.closest('.hidden')).map(button => button.getAttribute('aria-label'))
}

describe('search', () => {
  beforeEach(() => {
    api.state.status = 'Stopped'
    api.state.nextId = 1
    api.state.searches = []
    for (const mock of [api.startSearch, api.stopSearch, api.deleteSearch]) mock.mockClear()
  })

  it('shows name, size, seeds, leeches and plugin, with Published hidden and no Source', async () => {
    renderView()
    await search()
    await screen.findAllByText('ubuntu-desktop.iso')
    const titles = within(screen.getAllByRole('table')[0]).getAllByRole('columnheader').map(th => th.textContent?.trim())
    expect(titles).toEqual(['Name', 'Size', 'Seeds', 'Leeches', 'Plugin', 'Actions'])
  })

  it('keeps the form in one row with the plugins button', async () => {
    renderView()
    const form = field().closest('form')!
    for (const name of ['Search', 'Manage plugins']) expect(within(form).getByRole('button', { name })).toBeInTheDocument()
    for (const name of ['Search plugin', 'Search category']) expect(within(form).getByRole('combobox', { name })).toBeInTheDocument()
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

  it('switches between the table and cards, with the buttons for each', async () => {
    renderView()
    await search()
    await screen.findAllByText('ubuntu-desktop.iso')
    expect(toolbar()).toEqual(['Columns', 'Card view', 'Column filter'])

    await userEvent.click(screen.getByRole('button', { name: 'Card view' }))
    expect(toolbar()).toEqual(['Sort: Seeds', 'Table view', 'Column filter'])
    expect(screen.getAllByRole('table')[0].closest('.hidden')).not.toBeNull()
    // Wide screens show the table by default, so cards are the choice kept.
    expect(localStorage.getItem('qbminimal.searchView')).toBe('cards')

    await userEvent.click(screen.getByRole('button', { name: 'Table view' }))
    expect(toolbar()).toEqual(['Columns', 'Card view', 'Column filter'])
    expect(localStorage.getItem('qbminimal.searchView')).toBeNull()
  })

  it('stops a running search from the search button, without starting another', async () => {
    api.state.status = 'Running'
    renderView()
    await search()
    const stop = await screen.findByRole('button', { name: 'Stop search' })

    await userEvent.click(stop)
    // A second click right after, as when a search ends just before the click.
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(api.stopSearch).toHaveBeenCalledWith(1)
    expect(api.startSearch).toHaveBeenCalledTimes(1)
  })

  it('stops a running search with Enter in the field', async () => {
    api.state.status = 'Running'
    renderView()
    await search()
    await screen.findByRole('button', { name: 'Stop search' })

    await userEvent.type(field(), '{Enter}')

    expect(api.stopSearch).toHaveBeenCalledWith(1)
    expect(api.startSearch).toHaveBeenCalledTimes(1)
  })

  it('deletes earlier searches and hides the list unless past searches are kept', async () => {
    api.state.searches = [{ id: 7, status: 'Stopped', total: 3 }]
    api.state.nextId = 8
    renderView()
    await search()

    await waitFor(() => expect(api.deleteSearch).toHaveBeenCalledWith(7))
    expect(api.deleteSearch).not.toHaveBeenCalledWith(8)
    expect(screen.queryByText('Searches in qBittorrent')).toBeNull()
  })

  it('keeps earlier searches and lists them when turned on', async () => {
    localStorage.setItem('qbminimal.keepSearches', 'on')
    api.state.searches = [{ id: 7, status: 'Stopped', total: 3 }]
    api.state.nextId = 8
    renderView()
    await search()

    expect(await screen.findByText('Searches in qBittorrent')).toBeInTheDocument()
    expect(api.deleteSearch).not.toHaveBeenCalled()
  })

  it('asks for text instead of starting an empty search', async () => {
    renderView()
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Fill in this field')
    expect(api.startSearch).not.toHaveBeenCalled()
  })
})
