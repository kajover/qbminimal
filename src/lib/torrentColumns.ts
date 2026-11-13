import type { Torrent } from '@/types'
import { getTrackerHost, parseTags } from './torrentFilters'
import { getStateLabel } from './torrentState'
import type { FilterColumn, FilterKind } from './columnFilters'
import { t } from '@/i18n'

// The torrent table's columns. Each can be shown or hidden, dragged to a new place, and resized,
// and the layout is kept per device.
export const COLUMN_IDS = [
  'priority', 'name', 'size', 'progress', 'state', 'num_seeds', 'num_leechs', 'dlspeed', 'upspeed', 'eta', 'ratio',
  'popularity', 'category', 'tags', 'added_on', 'completion_on', 'tracker', 'downloaded', 'uploaded', 'amount_left',
  'time_active', 'seeding_time', 'last_activity', 'availability', 'dl_limit', 'up_limit', 'save_path',
] as const
export type ColumnId = typeof COLUMN_IDS[number]

export interface ColumnDef {
  id: ColumnId
  // The name in menus, and in the header unless it has a shorter one.
  label: string
  header?: string
  // Pixels.
  width: number
  minWidth: number
  defaultVisible: boolean
  // Numbers line up on the right.
  numeric?: boolean
}

const col = (id: ColumnId, label: string, width: number, defaultVisible: boolean, extra: Partial<ColumnDef> = {}): ColumnDef =>
  ({ id, label, width, minWidth: 48, defaultVisible, ...extra })

export const COLUMNS: ColumnDef[] = [
  // The queue position, headed # as in qBittorrent.
  col('priority', t('Queue'), 44, true, { numeric: true, header: '#', minWidth: 36 }),
  col('name', t('Name'), 320, true, { minWidth: 120 }),
  col('size', t('Size'), 90, true, { numeric: true }),
  col('progress', t('Progress'), 140, true, { minWidth: 80 }),
  col('state', t('Status'), 116, true, { minWidth: 80 }),
  col('num_seeds', t('Seeds'), 88, true, { numeric: true }),
  col('num_leechs', t('Peers'), 88, true, { numeric: true }),
  col('dlspeed', t('Down speed'), 110, true, { numeric: true }),
  col('upspeed', t('Up speed'), 110, true, { numeric: true }),
  col('eta', t('ETA'), 72, true, { numeric: true }),
  col('ratio', t('Ratio'), 72, true, { numeric: true }),
  col('popularity', t('Popularity'), 88, true, { numeric: true }),
  col('category', t('Category'), 130, true),
  col('tags', t('Tags'), 150, false),
  // Dates always show whole: "2026-11-06 19:11" with a margin for wider fonts, even when a narrower
  // width was saved.
  col('added_on', t('Added'), 160, true, { minWidth: 152 }),
  col('completion_on', t('Completed on'), 160, false, { minWidth: 152 }),
  col('tracker', t('Tracker'), 150, false),
  col('downloaded', t('Downloaded'), 100, false, { numeric: true }),
  col('uploaded', t('Uploaded'), 100, false, { numeric: true }),
  col('amount_left', t('Remaining'), 100, false, { numeric: true }),
  col('time_active', t('Time active'), 100, false, { numeric: true }),
  col('seeding_time', t('Seeding time'), 104, false, { numeric: true }),
  col('last_activity', t('Last activity'), 160, false, { minWidth: 152 }),
  col('availability', t('Availability'), 96, false, { numeric: true }),
  col('dl_limit', t('Down limit'), 100, false, { numeric: true }),
  col('up_limit', t('Up limit'), 100, false, { numeric: true }),
  col('save_path', t('Save path'), 200, false),
]

const BY_ID = new Map(COLUMNS.map(def => [def.id, def]))
export const getColumn = (id: ColumnId): ColumnDef => BY_ID.get(id)!
const MAX_WIDTH = 1200

// Layouts saved before version 2 had the queue column hidden near the end; it now leads, as in qBittorrent.
const LAYOUT_VERSION = 2

export interface ColumnLayout {
  order: ColumnId[]
  hidden: ColumnId[]
  widths: Partial<Record<ColumnId, number>>
}

export const DEFAULT_COLUMN_LAYOUT: ColumnLayout = {
  order: [...COLUMN_IDS],
  hidden: COLUMNS.filter(def => !def.defaultVisible).map(def => def.id),
  widths: {},
}

const isColumnId = (value: unknown): value is ColumnId => typeof value === 'string' && BY_ID.has(value as ColumnId)

// Keeps what it can from a saved layout. Columns added in a later version join next to the column
// they follow by default, with their default visibility, and the name column can't be hidden.
export function parseColumnLayout(raw: string | null): ColumnLayout {
  let saved: Partial<Record<keyof ColumnLayout | 'version', unknown>> = {}
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) saved = parsed as typeof saved
  } catch {
    return DEFAULT_COLUMN_LAYOUT
  }
  const savedOrder = Array.isArray(saved.order) ? [...new Set(saved.order.filter(isColumnId))] : []
  const order = [...savedOrder]
  COLUMN_IDS.forEach((id, index) => {
    if (order.includes(id)) return
    const before = COLUMN_IDS.slice(0, index).reverse().find(other => order.includes(other))
    order.splice(before ? order.indexOf(before) + 1 : 0, 0, id)
  })
  let hidden = Array.isArray(saved.hidden)
    ? [...new Set(saved.hidden.filter(isColumnId))].filter(id => id !== 'name')
    : DEFAULT_COLUMN_LAYOUT.hidden
  if (savedOrder.length && saved.version !== LAYOUT_VERSION) {
    order.splice(order.indexOf('priority'), 1)
    order.unshift('priority')
    hidden = hidden.filter(id => id !== 'priority')
  }
  // Columns the saved layout didn't know about yet keep their default visibility.
  const newColumns = COLUMN_IDS.filter(id => !savedOrder.includes(id) && !getColumn(id).defaultVisible)
  const widths: Partial<Record<ColumnId, number>> = {}
  if (saved.widths && typeof saved.widths === 'object') {
    for (const [id, width] of Object.entries(saved.widths as Record<string, unknown>)) {
      if (isColumnId(id) && typeof width === 'number' && Number.isFinite(width)) widths[id] = clampWidth(id, width)
    }
  }
  return { order, hidden: savedOrder.length ? [...new Set([...hidden, ...newColumns])] : hidden, widths }
}

export function clampWidth(id: ColumnId, width: number): number {
  return Math.round(Math.min(MAX_WIDTH, Math.max(getColumn(id).minWidth, width)))
}

export const columnWidth = (layout: ColumnLayout, id: ColumnId): number => layout.widths[id] ?? getColumn(id).width

export function visibleColumns(layout: ColumnLayout): ColumnDef[] {
  return layout.order.filter(id => !layout.hidden.includes(id)).map(getColumn)
}

export function toggleColumn(layout: ColumnLayout, id: ColumnId): ColumnLayout {
  if (id === 'name') return layout
  const hidden = layout.hidden.includes(id) ? layout.hidden.filter(other => other !== id) : [...layout.hidden, id]
  return { ...layout, hidden }
}

// Puts `id` where `target` is now, shifting the others along.
export function moveColumn(layout: ColumnLayout, id: ColumnId, target: ColumnId): ColumnLayout {
  if (id === target) return layout
  const order = layout.order.filter(other => other !== id)
  const from = layout.order.indexOf(id)
  const to = layout.order.indexOf(target)
  order.splice(to, 0, id)
  return from === -1 || to === -1 ? layout : { ...layout, order }
}

// Moves a column one place left (-1) or right (1) among the visible ones.
export function shiftColumn(layout: ColumnLayout, id: ColumnId, step: -1 | 1): ColumnLayout {
  const visible = visibleColumns(layout).map(def => def.id)
  const neighbour = visible[visible.indexOf(id) + step]
  return neighbour ? moveColumn(layout, id, neighbour) : layout
}

export function resizeColumn(layout: ColumnLayout, id: ColumnId, width: number): ColumnLayout {
  return { ...layout, widths: { ...layout.widths, [id]: clampWidth(id, width) } }
}

const STORAGE_KEY = 'qbminimal.torrentColumns'

export function loadColumnLayout(): ColumnLayout {
  try {
    return parseColumnLayout(localStorage.getItem(STORAGE_KEY))
  } catch {
    return DEFAULT_COLUMN_LAYOUT
  }
}

export function saveColumnLayout(layout: ColumnLayout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...layout, version: LAYOUT_VERSION }))
  } catch {
    // Blocked storage only means the layout isn't remembered.
  }
}

// The tracker column shows hosts, like the tracker filter.
export const trackerHost = (url: string | undefined): string => (url ? getTrackerHost(url) : '')

// What each column sorts by. Text sorts alphabetically, everything else by number.
export function sortValue(torrent: Torrent, id: ColumnId): number | string {
  switch (id) {
    case 'name': return torrent.name
    case 'state': return torrent.state
    case 'category': return torrent.category ?? ''
    case 'tags': return torrent.tags ?? ''
    case 'tracker': return trackerHost(torrent.tracker)
    case 'save_path': return torrent.save_path ?? ''
    case 'downloaded': return torrent.downloaded ?? torrent.total_downloaded ?? 0
    // Unknown queue positions and limits (-1 or 0) sort after real ones.
    case 'priority': return torrent.priority > 0 ? torrent.priority : Number.MAX_SAFE_INTEGER
    // Infinite popularity (-1) sorts above every number, and none known below.
    case 'popularity': return torrent.popularity === undefined ? -2 : torrent.popularity < 0 ? Number.MAX_SAFE_INTEGER : torrent.popularity
    case 'eta': return torrent.eta >= 0 && torrent.eta < 8640000 ? torrent.eta : Number.MAX_SAFE_INTEGER
    default: {
      const value = torrent[id as keyof Torrent]
      return typeof value === 'number' ? value : 0
    }
  }
}

export function compareTorrents(a: Torrent, b: Torrent, id: ColumnId): number {
  const x = sortValue(a, id)
  const y = sortValue(b, id)
  if (typeof x === 'string' || typeof y === 'string') return String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' })
  return x - y
}

// How each column is filtered from its title (see lib/columnFilters).
const FILTER_KINDS: Record<ColumnId, FilterKind> = {
  priority: 'number', name: 'text', size: 'size', progress: 'percent', state: 'set', num_seeds: 'number', num_leechs: 'number',
  dlspeed: 'speed', upspeed: 'speed', eta: 'duration', ratio: 'number', popularity: 'number', category: 'set', tags: 'set',
  added_on: 'date', completion_on: 'date', tracker: 'set', downloaded: 'size', uploaded: 'size', amount_left: 'size',
  time_active: 'duration', seeding_time: 'duration', last_activity: 'date', availability: 'number', dl_limit: 'speed',
  up_limit: 'speed', save_path: 'text',
}

// The value a column's filter tests. Unknown values are NaN, which no range matches; unlimited and
// infinite ones are Infinity, which only a lower bound matches.
function filterValue(torrent: Torrent, id: ColumnId): number | string | string[] {
  const date = (seconds: number | undefined) => (seconds && seconds > 0 ? seconds : NaN)
  switch (id) {
    case 'priority': return torrent.priority > 0 ? torrent.priority : NaN
    case 'progress': return torrent.progress * 100
    case 'state': return getStateLabel(torrent.state, torrent.completion_on)
    case 'eta': return torrent.eta >= 0 && torrent.eta < 8640000 ? torrent.eta : Infinity
    case 'popularity': return torrent.popularity === undefined ? NaN : torrent.popularity < 0 ? Infinity : torrent.popularity
    case 'availability': return torrent.availability !== undefined && torrent.availability >= 0 ? torrent.availability : NaN
    case 'dl_limit': return torrent.dl_limit > 0 ? torrent.dl_limit : Infinity
    case 'up_limit': return torrent.up_limit > 0 ? torrent.up_limit : Infinity
    case 'category': return torrent.category ?? ''
    case 'tags': return parseTags(torrent.tags)
    case 'added_on': return date(torrent.added_on)
    case 'completion_on': return date(torrent.completion_on)
    case 'last_activity': return date(torrent.last_activity)
    default: return sortValue(torrent, id)
  }
}

export const TORRENT_FILTER_COLUMNS: FilterColumn<Torrent>[] = COLUMNS.map(def => ({
  id: def.id,
  label: def.label,
  kind: FILTER_KINDS[def.id],
  value: (torrent: Torrent) => filterValue(torrent, def.id),
}))
