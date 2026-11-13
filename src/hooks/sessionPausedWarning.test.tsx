// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

const warning = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ toast: { warning, success: vi.fn(), error: vi.fn() } }))
const { useSessionPausedWarning } = await import('./useApi')

function warnWith(sessionState: boolean | undefined) {
  const client = new QueryClient()
  client.setQueryData(['torrents', 'maindata'], { rid: 1, torrents: {}, trackers: {}, serverState: { session_state: sessionState } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return renderHook(() => useSessionPausedWarning(), { wrapper }).result.current
}

describe('starting torrents while all transfers are paused', () => {
  it('warns, with a way to resume them all', () => {
    warning.mockClear()
    expect(warnWith(true)()).toBe(true)
    expect(warning).toHaveBeenCalledWith('All transfers are paused', expect.objectContaining({ action: expect.objectContaining({ label: 'Resume all transfers' }) }))
  })

  it('stays quiet otherwise, so the usual "Started" shows', () => {
    warning.mockClear()
    expect(warnWith(false)()).toBe(false)
    expect(warnWith(undefined)()).toBe(false)
    expect(warning).not.toHaveBeenCalled()
  })
})
