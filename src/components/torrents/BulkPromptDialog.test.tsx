// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { Torrent } from '@/types'

const api = vi.hoisted(() => ({
  getTags: async () => ['iso', 'hd', 'old'],
  addTags: vi.fn(async () => undefined),
  removeTags: vi.fn(async () => undefined),
}))

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, qbitClient: new Proxy(api, { get: (target, key) => (key in target ? target[key as keyof typeof target] : async () => []) }) }
})

const { BulkPromptDialog } = await import('./BulkPromptDialog')
const { loadBarActions } = await import('@/lib/actionBar')

const torrent = (hash: string, tags: string) => ({ hash, name: hash, tags, category: '', priority: 0 }) as Torrent

describe('Set tags', () => {
  it('starts from the tags the torrents have, and adds and removes only what changed', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><BulkPromptDialog torrents={[torrent('a', 'iso, hd'), torrent('b', 'iso')]} prompt="setTags" onClose={() => {}} /></QueryClientProvider>)
    const box = (name: string) => screen.getByRole('checkbox', { name: new RegExp(`^${name}`) })

    // Both have iso, only one has hd, neither has old.
    await waitFor(() => expect(box('old')).toHaveAttribute('aria-checked', 'false'))
    expect(box('iso')).toHaveAttribute('aria-checked', 'true')
    expect(box('hd')).toHaveAttribute('aria-checked', 'mixed')

    await userEvent.click(box('hd'))
    expect(box('hd')).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(box('iso'))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'new')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => expect(api.addTags).toHaveBeenCalledWith(['a', 'b'], ['hd', 'new']))
    expect(api.removeTags).toHaveBeenCalledWith(['a', 'b'], ['iso'])
  })

  it('turns pinned Add tags and Remove tags into one Set tags', () => {
    localStorage.setItem('qbminimal.actionBar', JSON.stringify(['recheck', 'addTags', 'removeTags']))
    expect(loadBarActions('wide')).toEqual(['recheck', 'setTags'])
    localStorage.clear()
  })
})
