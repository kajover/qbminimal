import { useSyncExternalStore } from 'react'
import { readStored, writeStored } from './storage'

// Light, dark, or following the device. The choice is kept under the same key the app used before,
// so a theme picked earlier still applies.
export type Theme = 'system' | 'light' | 'dark'
const THEME_KEY = 'theme'
const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

const listeners = new Set<() => void>()

export function chosenTheme(): Theme {
  const stored = readStored(THEME_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

// Marks the page .dark when it should be dark, and tells the browser which scheme its own parts
// (scrollbars, form controls) should use.
export function applyTheme(theme: Theme = chosenTheme()) {
  const dark = theme === 'dark' || (theme === 'system' && darkQuery().matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

export function setTheme(theme: Theme) {
  writeStored(THEME_KEY, theme === 'system' ? null : theme)
  applyTheme(theme)
  listeners.forEach(listener => listener())
}

// Applies the saved theme now and follows the device's setting while that is the choice.
export function startTheme() {
  applyTheme()
  darkQuery().addEventListener('change', () => { if (chosenTheme() === 'system') applyTheme('system') })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, chosenTheme)
  return { theme, setTheme }
}
