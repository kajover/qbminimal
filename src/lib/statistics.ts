import { useSyncExternalStore } from 'react'

// Whether the statistics dialog is open. One dialog for the whole app, opened from the menu, the
// sidebar, the header's speeds, or the torrent list's title.
let open = false
const listeners = new Set<() => void>()

export function setStatisticsOpen(next: boolean) {
  open = next
  listeners.forEach(listener => listener())
}
export const openStatistics = () => setStatisticsOpen(true)

export function useStatisticsOpen(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    () => open,
  )
}
