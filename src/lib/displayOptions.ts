import { useSyncExternalStore } from 'react'
import { readStored, writeStored } from './storage'

// On/off choices under Settings > App > Appearance, remembered on this device. Each one that
// differs from its default marks the page with a data attribute, such as data-tab-labels="off",
// which the components and index.css style by. No React state is needed to follow them.
export const DISPLAY_OPTIONS = {
  tabLabels: true,
  // Off by default, to keep the header for the page's own title and buttons.
  headerSpeeds: false,
  // The pages in a sidebar on wide screens and a tab bar on phones, besides the menu button.
  menuBar: false,
} as const

export type DisplayOption = keyof typeof DISPLAY_OPTIONS

const storageKey = (option: DisplayOption) => `qbminimal.${option}`
const attribute = (option: DisplayOption) => option.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)

export function displayOption(option: DisplayOption): boolean {
  const stored = readStored(storageKey(option))
  return stored === 'on' ? true : stored === 'off' ? false : DISPLAY_OPTIONS[option]
}

function applyOne(option: DisplayOption, on: boolean) {
  const name = `data-${attribute(option)}`
  if (on === DISPLAY_OPTIONS[option]) document.documentElement.removeAttribute(name)
  else document.documentElement.setAttribute(name, on ? 'on' : 'off')
}

export function applyDisplayOptions() {
  for (const option of Object.keys(DISPLAY_OPTIONS) as DisplayOption[]) applyOne(option, displayOption(option))
}

const listeners = new Set<() => void>()

export function setDisplayOption(option: DisplayOption, on: boolean) {
  writeStored(storageKey(option), on === DISPLAY_OPTIONS[option] ? null : on ? 'on' : 'off')
  applyOne(option, on)
  listeners.forEach(listener => listener())
}

// For the few choices that change what React renders, not only how the page is styled.
export function useDisplayOption(option: DisplayOption): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    () => displayOption(option),
  )
}
