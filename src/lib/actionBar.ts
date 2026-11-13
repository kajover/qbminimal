import { readStored, writeStored } from './storage'

// The actions shown in the selection bar besides Start, Stop, More, and Delete, by their ids in
// components/torrents/bulkActions, chosen apart for wide screens and phones, where the bar is
// narrow and holds only the two organizing ones by default. Remembered on this device.
export type BarKind = 'wide' | 'phone'

export const DEFAULT_BAR_ACTIONS: Record<BarKind, string[]> = {
  wide: ['forceStart', 'recheck', 'reannounce', 'category', 'addTags'],
  phone: ['category', 'addTags'],
}

const storageKey = (kind: BarKind) => (kind === 'wide' ? 'qbminimal.actionBar' : 'qbminimal.actionBar.phone')

export function loadBarActions(kind: BarKind): string[] {
  try {
    const parsed: unknown = JSON.parse(readStored(storageKey(kind)) ?? 'null')
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : DEFAULT_BAR_ACTIONS[kind]
  } catch {
    return DEFAULT_BAR_ACTIONS[kind]
  }
}

export function saveBarActions(kind: BarKind, ids: string[]) {
  const defaults = DEFAULT_BAR_ACTIONS[kind]
  const same = ids.length === defaults.length && ids.every((id, i) => id === defaults[i])
  writeStored(storageKey(kind), same ? null : JSON.stringify(ids))
}

// Pins an action, at the end, or unpins it.
export const toggleBarAction = (ids: string[], id: string) => (ids.includes(id) ? ids.filter(other => other !== id) : [...ids, id])
