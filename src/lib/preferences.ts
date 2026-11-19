import { t } from '@/i18n'
import { PREFERENCE_SECTIONS } from './preferenceSections'

export { PREFERENCE_SECTIONS }

// Every qBittorrent 5.2.3 preference the app can edit, plus the ones qBittorrent 5.3 adds, grouped
// like qBittorrent's own Options. Labels, choices, and units follow qBittorrent's preferences page.
// Settings page shows only the preferences the running qBittorrent reports, so each version
// sees just its own options.

export type PrefType = 'bool' | 'int' | 'number' | 'text' | 'textarea' | 'password' | 'path' | 'file' | 'select' | 'custom'

export type CustomPref = 'scanDirs' | 'webUiPassword' | 'apiKey' | 'networkInterface' | 'interfaceAddress' | 'testEmail' | 'trackerUrlList' | 'bannedPeers' | 'cookies' | 'shutdown'

export interface PrefOption {
  value: string | number
  label: string
}

export interface PrefDef {
  key: string
  label: string
  type: PrefType
  options?: PrefOption[]
  unit?: string
  // The value qBittorrent stores is the shown value times this, such as KiB shown and bytes stored.
  scale?: number
  help?: string
  // Greyed out unless this boolean preference is on.
  dependsOn?: string
  custom?: CustomPref
}

export interface PrefGroup {
  title: string
  warning?: string
  prefs: PrefDef[]
}

export interface PrefSection {
  id: string
  title: string
  groups: PrefGroup[]
}


// Converts a stored value to what the form shows.
export function toFormValue(def: PrefDef, value: unknown): unknown {
  if (def.type === 'bool') return !!value
  if (def.type === 'select' && def.options?.some(option => typeof option.value === 'string') && typeof value === 'boolean') return String(value)
  if ((def.type === 'int' || def.type === 'number') && typeof value === 'number' && def.scale) {
    return value > 0 ? Math.round((value / def.scale) * 100) / 100 : value
  }
  return value
}

// Converts a form value back to what qBittorrent stores. Returns undefined for an invalid number.
export function toStoredValue(def: PrefDef, value: unknown): unknown {
  if (def.type === 'int' || def.type === 'number') {
    const number = typeof value === 'number' ? value : Number(String(value).trim())
    if (String(value).trim() === '' || !Number.isFinite(number)) return undefined
    if (def.type === 'int' && !Number.isInteger(number) && !def.scale) return undefined
    return def.scale && number > 0 ? Math.round(number * def.scale) : number
  }
  if (def.type === 'select') {
    const option = def.options?.find(o => String(o.value) === String(value))
    if (!option) return value
    if (value === 'true' || value === 'false') return value === 'true'
    return option.value
  }
  return value
}

export const ALL_PREFS: PrefDef[] = PREFERENCE_SECTIONS.flatMap(section => section.groups.flatMap(group => group.prefs))

// The stored values that differ from what qBittorrent sent, or a list of invalid labels.
export function getChangedPreferences(original: Record<string, unknown>, edits: Record<string, unknown>): { changes: Record<string, unknown>; invalid: string[] } {
  const changes: Record<string, unknown> = {}
  const invalid: string[] = []
  for (const [key, value] of Object.entries(edits)) {
    const def = ALL_PREFS.find(p => p.key === key)
    if (!def) {
      // Custom editors store their own final values.
      changes[key] = value
      continue
    }
    const stored = def.type === 'custom' ? value : toStoredValue(def, value)
    if (stored === undefined) {
      invalid.push(def.label)
      continue
    }
    if (JSON.stringify(stored) !== JSON.stringify(original[key])) changes[key] = stored
  }

  // qBittorrent only applies these when both halves arrive together.
  for (const pair of SENT_TOGETHER) {
    if (!pair.some(key => key in changes)) continue
    for (const key of pair) {
      if (key in changes) continue
      const def = ALL_PREFS.find(p => p.key === key)
      changes[key] = key in edits && def ? toStoredValue(def, edits[key]) : original[key]
    }
  }

  // A limit that's switched on needs a value of 0 or more, or qBittorrent turns it back off.
  for (const [enabledKey, valueKey, label] of LIMITS_WITH_SWITCH) {
    if (changes[enabledKey] === true || (enabledKey in changes === false && valueKey in changes && original[enabledKey] === true)) {
      const value = Number(changes[valueKey] ?? original[valueKey])
      if (!(value >= 0)) invalid.push(t(label))
    }
  }
  return { changes, invalid }
}

const SENT_TOGETHER: string[][] = [
  ['schedule_from_hour', 'schedule_from_min'],
  ['schedule_to_hour', 'schedule_to_min'],
  ['max_ratio_enabled', 'max_ratio'],
  ['max_seeding_time_enabled', 'max_seeding_time'],
  ['max_inactive_seeding_time_enabled', 'max_inactive_seeding_time'],
]

const LIMITS_WITH_SWITCH: [string, string, string][] = [
  ['max_ratio_enabled', 'max_ratio', 'Ratio'],
  ['max_seeding_time_enabled', 'max_seeding_time', 'Seeding time'],
  ['max_inactive_seeding_time_enabled', 'max_inactive_seeding_time', 'Inactive time'],
]

// Leaves out preferences this qBittorrent doesn't report, such as 5.3's options on 5.2, or ones
// a newer version removed. The app's own fields that aren't stored preferences always stay.
export function getSupportedPrefs(prefs: PrefDef[], reported: Record<string, unknown>): PrefDef[] {
  return prefs.filter(def => def.type === 'custom' || def.key in reported)
}
