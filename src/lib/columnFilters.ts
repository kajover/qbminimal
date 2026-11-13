import { readStored, writeStored } from './storage'
import { formatBytes } from './format'
import { t } from '@/i18n'

// Filters set from a table's column titles, like qui's: a range for numbers, sizes, speeds, times
// and dates, a text match for names and paths, or a choice of values for states, categories and
// tags. Each column holds at most one; a row has to pass all of them.

// How a column is filtered, and which units its editor offers.
export type FilterKind = 'text' | 'size' | 'speed' | 'number' | 'percent' | 'duration' | 'date' | 'set'

export type TextOperator = 'contains' | 'excludes' | 'is' | 'isNot'

export type ColumnFilter =
  | { type: 'text'; op: TextOperator; value: string }
  // Bounds in the column's base unit: bytes, bytes per second, seconds, percent, or, for dates,
  // seconds since 1970. A missing bound is open.
  | { type: 'range'; min?: number; max?: number }
  | { type: 'set'; values: string[] }

export type ColumnFilters = Record<string, ColumnFilter>

// One filterable column: its value for a row, as a number for ranges, as text for text
// filters, and as the list of values it has for a choice (a torrent can have several tags).
export interface FilterColumn<Row> {
  id: string
  label: string
  kind: FilterKind
  value: (row: Row) => number | string | string[]
}

export const TEXT_OPERATORS: { value: TextOperator; label: string }[] = [
  { value: 'contains', label: t('contains') },
  { value: 'excludes', label: t("doesn't contain") },
  { value: 'is', label: t('is') },
  { value: 'isNot', label: t("isn't") },
]

// The units a range can be typed in. The first is where the editor starts.
export const UNITS: Partial<Record<FilterKind, { label: string; factor: number }[]>> = {
  size: [
    { label: 'GB', factor: 1024 ** 3 },
    { label: 'MB', factor: 1024 ** 2 },
    { label: 'KB', factor: 1024 },
    { label: 'TB', factor: 1024 ** 4 },
  ],
  speed: [
    { label: 'MB/s', factor: 1024 ** 2 },
    { label: 'KB/s', factor: 1024 },
  ],
  duration: [
    { label: t('hours'), factor: 3600 },
    { label: t('minutes'), factor: 60 },
    { label: t('days'), factor: 86400 },
  ],
}

// The empty value, shown as "None" in a choice.
export const NONE = ''

export const isActive = (filter: ColumnFilter | undefined): filter is ColumnFilter =>
  !!filter && (filter.type === 'text' ? filter.value.trim() !== '' : filter.type === 'set' ? filter.values.length > 0 : filter.min !== undefined || filter.max !== undefined)

export function matchesFilter(value: number | string | string[], filter: ColumnFilter): boolean {
  switch (filter.type) {
    case 'text': {
      const text = (Array.isArray(value) ? value.join(', ') : String(value)).toLowerCase()
      const wanted = filter.value.trim().toLowerCase()
      switch (filter.op) {
        case 'contains': return text.includes(wanted)
        case 'excludes': return !text.includes(wanted)
        case 'is': return text === wanted
        case 'isNot': return text !== wanted
      }
      return true
    }
    case 'range': {
      // Unknown values (NaN) pass no range.
      if (typeof value !== 'number' || Number.isNaN(value)) return false
      return (filter.min === undefined || value >= filter.min) && (filter.max === undefined || value <= filter.max)
    }
    case 'set': {
      const values = Array.isArray(value) ? (value.length ? value : [NONE]) : [String(value)]
      return values.some(v => filter.values.includes(v))
    }
  }
}

export function applyColumnFilters<Row>(rows: Row[], columns: FilterColumn<Row>[], filters: ColumnFilters): Row[] {
  const active = columns.flatMap(column => (isActive(filters[column.id]) ? [{ column, filter: filters[column.id] }] : []))
  if (!active.length) return rows
  return rows.filter(row => active.every(({ column, filter }) => matchesFilter(column.value(row), filter)))
}

// Every value a choice column has among the rows, with how many rows have it, most first.
export function choiceOptions<Row>(rows: Row[], column: FilterColumn<Row>): { value: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const raw = column.value(row)
    const values = Array.isArray(raw) ? (raw.length ? raw : [NONE]) : [String(raw)]
    for (const value of new Set(values)) counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

const pad = (n: number) => String(n).padStart(2, '0')
// A date as the date field writes it, in local time.
export const toDateInput = (seconds: number) => {
  const d = new Date(seconds * 1000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
// The start of a local day, or with `end`, its last second.
export const fromDateInput = (text: string, end = false): number | undefined => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!match) return undefined
  const day = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Math.floor(day.getTime() / 1000) + (end ? 86399 : 0)
}

const trimNumber = (n: number) => String(Math.round(n * 100) / 100)

// One bound as text, in the units the column shows.
function formatBound(kind: FilterKind, value: number): string {
  switch (kind) {
    case 'size': return formatBytes(value)
    case 'speed': return `${formatBytes(value)}/s`
    case 'percent': return `${trimNumber(value)}%`
    case 'date': return toDateInput(value)
    case 'duration': {
      const unit = [...UNITS.duration!].sort((a, b) => b.factor - a.factor).find(u => value >= u.factor && value % u.factor === 0) ?? UNITS.duration![1]
      return `${trimNumber(value / unit.factor)} ${unit.label}`
    }
    default: return trimNumber(value)
  }
}

// A short line for a filter, such as "Size: 1 GB – 4 GB", for the chips above the list.
export function describeFilter(column: { label: string; kind: FilterKind }, filter: ColumnFilter, valueLabel: (value: string) => string = v => v): string {
  const { label, kind } = column
  switch (filter.type) {
    case 'text': {
      const op = TEXT_OPERATORS.find(o => o.value === filter.op)?.label ?? ''
      return `${label} ${op} "${filter.value.trim()}"`
    }
    case 'set': {
      const shown = filter.values.slice(0, 2).map(valueLabel).join(', ')
      return `${label}: ${shown}${filter.values.length > 2 ? ` +${filter.values.length - 2}` : ''}`
    }
    case 'range': {
      const { min, max } = filter
      if (min !== undefined && max !== undefined) return `${label}: ${formatBound(kind, min)} – ${formatBound(kind, max)}`
      if (min !== undefined) return `${label} ≥ ${formatBound(kind, min)}`
      return `${label} ≤ ${formatBound(kind, max!)}`
    }
  }
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

// Keeps the readable filters of a saved set and drops the rest.
export function parseColumnFilters(raw: unknown): ColumnFilters {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const result: ColumnFilters = {}
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue
    const f = value as Record<string, unknown>
    let filter: ColumnFilter | null = null
    if (f.type === 'text' && typeof f.value === 'string' && TEXT_OPERATORS.some(o => o.value === f.op)) filter = { type: 'text', op: f.op as TextOperator, value: f.value }
    else if (f.type === 'range') filter = { type: 'range', ...(isFiniteNumber(f.min) && { min: f.min }), ...(isFiniteNumber(f.max) && { max: f.max }) }
    else if (f.type === 'set' && Array.isArray(f.values)) filter = { type: 'set', values: f.values.filter((v): v is string => typeof v === 'string') }
    if (filter && isActive(filter)) result[id] = filter
  }
  return result
}

export const activeCount = (filters: ColumnFilters | undefined) => Object.values(filters ?? {}).filter(isActive).length

export const sameColumnFilters = (a: ColumnFilters | undefined, b: ColumnFilters | undefined) =>
  JSON.stringify(parseColumnFilters(a ?? {})) === JSON.stringify(parseColumnFilters(b ?? {}))

// Sets or, with null, removes one column's filter.
export function withFilter(filters: ColumnFilters, id: string, filter: ColumnFilter | null): ColumnFilters {
  const next = { ...filters }
  if (filter && isActive(filter)) next[id] = filter
  else delete next[id]
  return next
}

const storageKey = (table: string) => `qbminimal.columnFilters.${table}`
export const loadColumnFilters = (table: string): ColumnFilters => {
  try {
    return parseColumnFilters(JSON.parse(readStored(storageKey(table)) ?? '{}'))
  } catch {
    return {}
  }
}
export const saveColumnFilters = (table: string, filters: ColumnFilters) =>
  writeStored(storageKey(table), Object.keys(filters).length ? JSON.stringify(filters) : null)
