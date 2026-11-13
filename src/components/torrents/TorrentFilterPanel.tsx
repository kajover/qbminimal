import type { ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/SearchInput'
import { NativeSelect } from '@/components/NativeSelect'
import { RemovableChip } from '@/components/ColumnFilters'
import { STATUS_FILTERS, TRACKERLESS, type StatusFilter } from '@/lib/torrentFilters'
import type { TorrentList } from '@/hooks/useTorrentList'
import type { FilterView } from '@/lib/filterViews'
import { SaveViewButton } from './FilterViews'
import { t } from '@/i18n'

interface TorrentFilterPanelProps {
  list: TorrentList
  categories: string[]
  tags: string[]
  views: FilterView[]
  onViewsChange: (views: FilterView[]) => void
  // More buttons after Reset filters.
  actions?: ReactNode
}

// Name search plus status, category, tag, and tracker, each choice showing how many it would match.
export function TorrentFilterPanel({ list, categories, tags, views, onViewsChange, actions }: TorrentFilterPanelProps) {
  const { filters, setFilter, counts, trackerHosts } = list
  const withCount = (label: string, count = 0) => `${label} (${count})`

  return (
    <div id="torrent-filters" className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
      <SearchInput autoFocus aria-label={t('Filter by name')} placeholder={t('Filter by name')} value={filters.name} onValueChange={(value) => setFilter('name', value)} className="col-span-2 md:w-52" />
      <NativeSelect aria-label={t('Filter by status')} className="col-span-2" value={filters.status} onChange={(e) => setFilter('status', e.target.value as StatusFilter)}>
        {STATUS_FILTERS.map(({ value, label }) => <option key={value} value={value}>{withCount(label, counts.status[value])}</option>)}
      </NativeSelect>
      <NativeSelect aria-label={t('Filter by category')} value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
        <option value="">{t('All categories')}</option>
        {categories.map(name => <option key={name} value={name}>{withCount(name, counts.category[name])}</option>)}
      </NativeSelect>
      <NativeSelect aria-label={t('Filter by tag')} value={filters.tag} onChange={(e) => setFilter('tag', e.target.value)}>
        <option value="">{t('All tags')}</option>
        {tags.map(name => <option key={name} value={name}>{withCount(name, counts.tag[name])}</option>)}
      </NativeSelect>
      <NativeSelect aria-label={t('Filter by tracker')} className="col-span-2 md:max-w-52" value={filters.tracker} onChange={(e) => setFilter('tracker', e.target.value)}>
        <option value="">{t('All trackers')}</option>
        <option value={TRACKERLESS}>{withCount('Trackerless', counts.trackerless)}</option>
        {trackerHosts.map(host => <option key={host} value={host}>{withCount(host, counts.tracker[host])}</option>)}
      </NativeSelect>
      {/* The buttons share one row, which joins the filters' row on wide screens when it fits, and
          otherwise moves to a row of its own rather than cutting labels short. */}
      <div className="col-span-2 flex min-w-0 items-center gap-1 md:min-w-fit md:flex-1">
        <SaveViewButton list={list} views={views} onViewsChange={onViewsChange} />
        {/* Clears every filter, the column filters included. */}
        {/* The facing sides have less padding, so the text gap matches the one before the icon buttons. */}
        <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 rounded-full px-2.5 has-[>svg]:ps-1" disabled={!list.filtered} onClick={list.clearFilters}>
          <RotateCcw className="size-4" />
          {t('Reset filters')}
        </Button>
        {actions}
      </div>
    </div>
  )
}

// The panel's filters in force, as chips above the list while it's closed. They're kept between
// visits, so without these a saved status or category could hide torrents unnoticed.
export function ListFilterChips({ list }: { list: TorrentList }) {
  const { filters, setFilter } = list
  const status = STATUS_FILTERS.find(option => option.value === filters.status)
  return (
    <>
      {filters.name.trim() && <RemovableChip text={`${t('Name')}: ${filters.name.trim()}`} onRemove={() => setFilter('name', '')} />}
      {filters.status !== 'all' && status && <RemovableChip text={status.label} onRemove={() => setFilter('status', 'all')} />}
      {filters.category && <RemovableChip text={`${t('Category')}: ${filters.category}`} onRemove={() => setFilter('category', '')} />}
      {filters.tag && <RemovableChip text={`${t('Tags')}: ${filters.tag}`} onRemove={() => setFilter('tag', '')} />}
      {filters.tracker && <RemovableChip text={`${t('Tracker')}: ${filters.tracker === TRACKERLESS ? 'Trackerless' : filters.tracker}`} onRemove={() => setFilter('tracker', '')} />}
    </>
  )
}
