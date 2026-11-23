import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { forgetPages } from '@/hooks/useRemembered'

// What jsdom leaves out and the app expects from a browser. Screens count as wide, with a mouse.
if (typeof window !== 'undefined') {
  // Newer Node versions have a localStorage of their own that hides jsdom's, so tests get a simple one.
  const items = new Map<string, string>()
  const storage: Storage = {
    get length() { return items.size },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => { items.delete(key) },
    setItem: (key, value) => { items.set(key, String(value)) },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })

  window.matchMedia ??= ((query: string) => ({
    matches: /min-width:|pointer: fine/.test(query),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia

  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.HTMLElement.prototype.scrollTo ??= () => {}
  window.HTMLElement.prototype.hasPointerCapture ??= () => false
  window.HTMLElement.prototype.setPointerCapture ??= () => {}
  window.HTMLElement.prototype.releasePointerCapture ??= () => {}
  window.HTMLElement.prototype.scrollIntoView ??= () => {}

  afterEach(() => {
    cleanup()
    localStorage.clear()
    // What pages keep while the app runs (useRemembered) doesn't carry into the next test.
    forgetPages()
  })
}
