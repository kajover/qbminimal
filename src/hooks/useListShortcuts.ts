import { useEffect } from 'react'

// Dialogs and menus that take the keys while open. Not the torrent details on phones and tablets
// (data-keeps-swipes): they leave the list usable, as the details panel on desktop does.
export const KEY_TAKING_LAYERS = '[role="dialog"]:not([data-keeps-swipes]), [role="menu"]'

// Keys typed into a field, or pressed while a dialog or menu is open, aren't list shortcuts.
export function isListShortcut(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (target.closest?.('input, textarea, select, [contenteditable="true"]')) return false
  return !document.querySelector(KEY_TAKING_LAYERS)
}

// What the torrent list's keys do. Each runs with the list as it is when the key is pressed.
export interface ListShortcuts {
  hasSelection: boolean
  selectAll: () => void
  selectNone: () => void
  invertSelection: () => void
  start: () => void
  stop: () => void
  add: () => void
  deleteSelection: () => void
  // Escape: closes the details, or else clears the selection.
  escape: () => void
  search: () => void
  showShortcuts: () => void
  toggleFilters: () => void
  toggleView: () => void
  // A key's code, pressed with Option or Alt: runs the action ACTION_KEYS gives it on the
  // selection, telling whether there was one.
  runAction: (code: string) => boolean
}

// Ctrl or ⌘ + A selects every matching torrent and with Shift none, + I swaps the selected and
// unselected ones. With torrents selected, Option or Alt + S starts, + P stops, + D (or Delete)
// asks to delete them, and + the letters in ACTION_KEYS run the other actions. Escape closes the
// details and then clears the selection; S opens the search, F the filters, N adds torrents, V
// switches between table and cards, and ? lists all of these.
export function useListShortcuts(keys: ListShortcuts) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isListShortcut(event)) return
      const mod = event.metaKey || event.ctrlKey
      const plain = !mod && !event.altKey && !event.shiftKey
      // Actions on the selection take Option or Alt, so no key alone runs one by accident. Read
      // by the key's place, as Option with a letter types another character on a Mac.
      const alt = event.altKey && !mod && !event.shiftKey && keys.hasSelection
      const key = event.key.toLowerCase()
      const take = (run: () => void) => { event.preventDefault(); run() }
      if (mod && key === 'a') take(event.shiftKey ? keys.selectNone : keys.selectAll)
      else if (mod && key === 'i') take(keys.invertSelection)
      else if (event.key === 'Escape') keys.escape()
      else if (alt && event.code === 'KeyS') take(keys.start)
      else if (alt && event.code === 'KeyP') take(keys.stop)
      else if (alt && event.code === 'KeyD') take(keys.deleteSelection)
      // Delete too, and Backspace, which a Mac's delete key sends: deleting asks first.
      else if (keys.hasSelection && !mod && !event.altKey && (event.key === 'Delete' || event.key === 'Backspace')) take(keys.deleteSelection)
      else if (alt && keys.runAction(event.code)) event.preventDefault()
      else if (event.key === '?') take(keys.showShortcuts)
      else if (plain && key === 's') take(keys.search)
      else if (plain && key === 'f') take(keys.toggleFilters)
      else if (plain && key === 'n') take(keys.add)
      else if (plain && key === 'v') take(keys.toggleView)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
}
