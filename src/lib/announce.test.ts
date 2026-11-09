// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { announce } from './announce'

describe('announce', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sets the text of a polite live region on the next frame', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1 })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    announce('3 selected')
    const region = document.querySelector('[role="status"][aria-live="polite"]')
    expect(region?.textContent).toBe('3 selected')
    announce('Selection cleared')
    expect(document.querySelectorAll('[aria-live="polite"]')).toHaveLength(1)
    expect(region?.textContent).toBe('Selection cleared')
    vi.unstubAllGlobals()
  })
})
