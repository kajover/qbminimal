// Keyboard shortcuts named in hover labels and menus, so each one is found where it's used.
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
export const MOD = isMac ? '⌘' : 'Ctrl'
export const ALT = isMac ? '⌥' : 'Alt'

// Ctrl or ⌘ with a key, written the way each system writes it: ⌘S, Ctrl+S.
export const modKey = (key: string) => (isMac ? `${MOD}${key}` : `${MOD}+${key}`)

// Option or Alt with a key: ⌥C, Alt+C. For the actions on the selection, which a key alone could
// run by accident; Ctrl or ⌘ with C, T, L, R or M belongs to the browser.
export const altKey = (key: string) => (isMac ? `${ALT}${key}` : `${ALT}+${key}`)

// A label with its shortcut after it, as in "Start (⌥S)".
export const withKeys = (label: string, keys: string) => `${label} (${keys})`

// The keys that go to a page: G, then its place in the menu.
export const pageKeys = (place: number) => `G ${place}`
