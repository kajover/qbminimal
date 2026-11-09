// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, chosenTheme, setTheme } from './theme'

describe('theme', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('dark'), media: query, addEventListener: () => {}, removeEventListener: () => {} }))
  })
  afterEach(() => {
    setTheme('system')
    vi.unstubAllGlobals()
  })

  it('follows the device by default', () => {
    expect(chosenTheme()).toBe('system')
    applyTheme()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('remembers a picked theme under the old key', () => {
    setTheme('light')
    expect(localStorage.getItem('theme')).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe('light')
  })
})
