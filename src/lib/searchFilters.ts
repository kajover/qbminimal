import type { FilterTarget } from '@/components/ColumnFilters'
import { choiceOptions, type FilterColumn } from './columnFilters'
import type { SearchResult } from '@/types'
import { t } from '@/i18n'

// Older qBittorrent leaves out the plugin and date, and plugins send -1 for a date they don't know.
export const published = (r: SearchResult) => (r.pubDate && r.pubDate > 0 ? r.pubDate : 0)

// Each column can be filtered like the torrent table's: a text match, a range, or a choice of sites.
export const SEARCH_FILTER_COLUMNS: FilterColumn<SearchResult>[] = [
  { id: 'fileName', get label() { return t('Name') }, kind: 'text', value: r => r.fileName },
  { id: 'fileSize', get label() { return t('Size') }, kind: 'size', value: r => (r.fileSize >= 0 ? r.fileSize : NaN) },
  { id: 'nbSeeders', get label() { return t('Seeds') }, kind: 'number', value: r => r.nbSeeders },
  { id: 'nbLeechers', get label() { return t('Leeches') }, kind: 'number', value: r => r.nbLeechers },
  { id: 'engineName', get label() { return t('Plugin') }, kind: 'set', value: r => r.engineName ?? '' },
  { id: 'pubDate', get label() { return t('Published') }, kind: 'date', value: r => published(r) || NaN },
]

// What each column can be filtered by, for the table's titles and the sidebar's funnel.
export function searchFilterTargets(results: SearchResult[]): FilterTarget[] {
  return SEARCH_FILTER_COLUMNS.map(column => ({ ...column, options: column.kind === 'set' ? () => choiceOptions(results, column) : undefined }))
}

// Each result's key, for selecting it: the same torrent can be found by two plugins.
export const resultKey = (result: SearchResult) => `${result.fileUrl}|${result.descrLink}`
