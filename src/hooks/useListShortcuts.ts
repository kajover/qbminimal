import { useEffect } from 'react'

// Keys typed into a field, or pressed while a dialog or menu is open, aren't list shortcuts.
export function isListShortcut(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (target.closest?.('input, textarea, select, [contenteditable="true"]')) return false
  return !document.querySelector('[role="dialog"], [role="menu"]')
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
}

// Ctrl or Cmd + A selects every matching torrent and with Shift none, + I swaps the selected and
// unselected ones, + S starts and + P stops the selection, and + O opens Add, as in qBittorrent.
// Delete asks to delete the selection, Escape closes the details and then clears the selection,
// / or S opens the search, F the filters, N adds torrents, V switches between table and cards, and ?
// lists all of these.
export function useListShortcuts(keys: ListShortcuts) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isListShortcut(event)) return
      const mod = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      const take = (run: () => void) => { event.preventDefault(); run() }
      if (mod && key === 'a') take(event.shiftKey ? keys.selectNone : keys.selectAll)
      else if (mod && key === 'i') take(keys.invertSelection)
      else if (mod && (key === 's' || key === 'p') && !event.shiftKey && keys.hasSelection) take(key === 's' ? keys.start : keys.stop)
      else if (mod && key === 'o') take(keys.add)
      else if ((event.key === 'Delete' || event.key === 'Backspace') && keys.hasSelection) take(keys.deleteSelection)
      else if (event.key === 'Escape') keys.escape()
      // S as well as /, which needs Shift on many keyboards, such as German ones.
      else if (event.key === '/' || (key === 's' && !mod && !event.altKey && !event.shiftKey)) take(keys.search)
      else if (event.key === '?') take(keys.showShortcuts)
      else if (!mod && !event.altKey && !event.shiftKey && key === 'f') take(keys.toggleFilters)
      else if (!mod && !event.altKey && !event.shiftKey && key === 'n') take(keys.add)
      else if (!mod && !event.altKey && !event.shiftKey && key === 'v') take(keys.toggleView)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
}
