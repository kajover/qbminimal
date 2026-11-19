import { useState } from 'react'
import { AppWindow, BookOpen, ChevronDown, Film, Filter, Gamepad2, History, Image as ImageIcon, LayoutGrid, Loader2, Music, Puzzle, RefreshCw, Search, Settings, Shapes, Sparkles, Trash2, Tv, X, type LucideIcon } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ConfirmAction } from '@/components/ConfirmAction'
import { AddFilterButton, ColumnFilterChips, type FilterTarget } from '@/components/ColumnFilters'
import { FilterItem, NothingMatches, Section, SidebarHeader } from '@/components/FilterSidebarParts'
import { useSidebarSections } from '@/hooks/useSidebarSections'
import { toast } from '@/hooks/use-toast'
import { qbitClient, type SearchPlugin } from '@/lib/api'
import { activeCount, type ColumnFilter, type ColumnFilters } from '@/lib/columnFilters'
import { forgetSearches, keepSearchesOn, parseSearchesShown, readSavedSearches, searchesShown, setKeepSearches, setSearchesShown, type SavedSearch } from '@/lib/searchPatterns'
import { toggleChoice } from '@/lib/torrentFilters'
import { t } from '@/i18n'

// qBittorrent's own search categories.
const SEARCH_CATEGORIES: [value: string, label: string, icon: LucideIcon][] = [
  ['all', 'All categories', LayoutGrid], ['anime', 'Anime', Sparkles], ['books', 'Books', BookOpen], ['games', 'Games', Gamepad2],
  ['movies', 'Movies', Film], ['music', 'Music', Music], ['pictures', 'Pictures', ImageIcon], ['software', 'Software', AppWindow], ['tv', 'TV shows', Tv],
]

// Sections folded away stay folded on this device.
const FOLDED_KEY = 'qbminimal.searchSidebarFolded'

interface SearchSidebarProps {
  // The search shown, and whether it's still running.
  activeId: number | null
  running: boolean
  // Opens a search, following it while it still runs.
  onOpen: (id: number, running: boolean) => void
  // Starts the same search again and says whether it started.
  onRun: (search: SavedSearch) => Promise<boolean>
  onStop: (id: number) => void
  onCleared: () => void
  // The enabled plugins; each search asks them all.
  plugins: SearchPlugin[]
  // How many of the shown results each plugin found, by the name results carry.
  pluginCounts: ReadonlyMap<string, number>
  category: string
  onCategoryChange: (category: string) => void
  onManagePlugins: () => void
  targets: FilterTarget[]
  filters: ColumnFilters
  onFilterChange: (id: string, filter: ColumnFilter | null) => void
}

// Earlier searches, the plugins and category to search with, and the column filters, laid out like
// the torrent list's filter sidebar.
export function SearchSidebar(props: SearchSidebarProps) {
  const { activeId, running, onOpen, onRun, onStop, onCleared, plugins, pluginCounts, category, onCategoryChange, onManagePlugins, targets, filters, onFilterChange } = props
  const queryClient = useQueryClient()
  const { data: searches = [] } = useQuery({ queryKey: ['search', 'status'], queryFn: () => qbitClient.getSearchStatus(), refetchInterval: 5000 })
  const [keep, setKeep] = useState(keepSearchesOn)
  // The latest searches listed at first, and how many more "Show more" has revealed.
  const [perPage, setPerPage] = useState(searchesShown)
  const [extra, setExtra] = useState(0)
  const { folded, fold, searchProps, matching } = useSidebarSections(FOLDED_KEY)
  const nothing = <NothingMatches />

  const saved = readSavedSearches()
  const name = (id: number) => saved[id]?.pattern ?? t('Search {id}', { id })
  const remove = async (id: number) => {
    try {
      await qbitClient.deleteSearch(id)
      forgetSearches([id])
      void queryClient.invalidateQueries({ queryKey: ['search', 'status'] })
    } catch (e) {
      toast.error(t('Couldn\'t delete the search'), { description: e instanceof Error ? e.message : undefined })
    }
  }
  // The new search replaces the old one, so the list doesn't fill up with the same text.
  const runAgain = async (id: number, search: SavedSearch) => {
    if (await onRun(search)) await remove(id)
  }
  // Deletes every search, or every one but the search shown, when past searches stop being kept.
  const clear = async (keepShown = false) => {
    const ids = searches.map(search => search.id).filter(id => !keepShown || id !== activeId)
    const outcomes = await Promise.allSettled(ids.map(id => qbitClient.deleteSearch(id)))
    forgetSearches(ids.filter((_, i) => outcomes[i].status === 'fulfilled'))
    void queryClient.invalidateQueries({ queryKey: ['search', 'status'] })
    if (!keepShown) onCleared()
    if (outcomes.some(outcome => outcome.status === 'rejected')) toast.error(t('Couldn\'t delete every search'))
  }
  const matchingSearches = matching('saved', [...searches].reverse(), search => name(search.id))
  const shownSearches = matchingSearches.slice(0, perPage + extra)
  const hiddenSearches = matchingSearches.length - shownSearches.length

  // Clicking a plugin shows only its results: it's the Plugin column's filter. Results from a
  // plugin turned off since still get a row.
  const pluginFilter = filters.engineName?.type === 'set' ? filters.engineName.values : []
  const pluginRows = [
    ...plugins.map(plugin => ({ name: plugin.name, label: plugin.fullName || plugin.name })),
    ...[...pluginCounts.keys()].filter(name => !plugins.some(plugin => plugin.name === name || plugin.fullName === name)).map(name => ({ name, label: name })),
  ]
  const countOf = (row: { name: string; label: string }) => pluginCounts.get(row.name) ?? pluginCounts.get(row.label) ?? 0
  const valueOf = (row: { name: string; label: string }) => (pluginCounts.has(row.label) && !pluginCounts.has(row.name) ? row.label : row.name)
  const togglePlugin = (value: string) => {
    const values = toggleChoice(pluginFilter, value)
    onFilterChange('engineName', values.length ? { type: 'set', values } : null)
  }
  const shownPlugins = matching('plugins', pluginRows, row => row.label)
  // Only the categories some enabled plugin can search in; the rest would find the same as All.
  const supported = new Set(plugins.flatMap(plugin => (plugin.supportedCategories ?? []).map(category => category.id)))
  const categories = SEARCH_CATEGORIES.filter(([value]) => value === 'all' || value === category || supported.has(value))
  const shownCategories = matching('categories', categories, ([, label]) => t(label))
  const sidebarFiltered = category !== 'all' || pluginFilter.length > 0
  const columnFiltered = Object.keys(filters).some(id => id !== 'engineName' && filters[id] && activeCount({ [id]: filters[id] }) > 0)

  return (
    <div id="search-sidebar" className="space-y-3">
      {/* The funnel adds a filter on any column of the results. */}
      <SidebarHeader
        title={t('Search options')}
        filterButton={<AddFilterButton targets={targets} onChange={onFilterChange} active={activeCount(filters) > 0} />}
        sidebarFiltered={sidebarFiltered}
        columnFiltered={columnFiltered}
        onClearSidebar={() => { onCategoryChange('all'); onFilterChange('engineName', null) }}
        onClearColumns={() => targets.forEach(target => target.id !== 'engineName' && filters[target.id] && onFilterChange(target.id, null))}
      />

      <Section
        id="saved" title={t('Saved searches')} icon={History} chosen={0} folded={folded.includes('saved')} onFold={fold}
        {...(keep && searches.length > 0 ? searchProps('saved') : {})}
        action={(
          <>
            {keep && searches.length > 0 && (
              <ConfirmAction label={t('Delete every search')} title={t('Delete every search?')} message={t('qBittorrent forgets these searches and their results.')} confirmLabel={t('Delete all')} onConfirm={() => void clear()}>
                <Trash2 className="size-4" />
              </ConfirmAction>
            )}
            {/* Whether past searches are kept, tucked away as it's seldom changed. */}
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={t('Saved search settings')} title={t('Saved search settings')}>
                  <Settings className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 space-y-2">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <label htmlFor="keep-searches">{t('Keep past searches')}</label>
                  <Switch id="keep-searches" checked={keep} onCheckedChange={(on) => { setKeepSearches(on); setKeep(on); if (!on) void clear(true) }} />
                </div>
                <p className="text-xs text-muted-foreground">{t('Earlier searches stay in qBittorrent, so they can be opened or run again. When off, each new search deletes the ones before it.')}</p>
                <div className="flex items-center justify-between gap-2 border-t pt-2 text-sm">
                  <label htmlFor="searches-shown">{t('Searches listed')}</label>
                  <Input
                    id="searches-shown" type="number" inputMode="numeric" min={1} max={500} clearable={false} className="h-8 w-20 text-end"
                    defaultValue={perPage}
                    // Saved once it's a whole number from 1 to 500; anything else is left as it was.
                    onChange={(e) => {
                      const count = parseSearchesShown(e.target.value)
                      if (String(count) !== e.target.value.trim()) return
                      setSearchesShown(count)
                      setPerPage(count)
                      setExtra(0)
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{t('The rest show under Show more.')}</p>
              </PopoverContent>
            </Popover>
          </>
        )}
      >
        {!keep ? <li className="px-2 py-1 text-sm text-muted-foreground">{t('Past searches aren\'t kept.')}</li> : searches.length === 0 ? <li className="px-2 py-1 text-sm text-muted-foreground">{t('No saved searches yet.')}</li>
          : shownSearches.length === 0 ? nothing
          : shownSearches.map(search => {
            const label = name(search.id)
            // Running here, or left running in qBittorrent after opening another.
            const live = (running && activeId === search.id) || (search.status === 'Running' && activeId !== search.id)
            return (
              <FilterItem
                key={search.id}
                single
                icon={Search}
                label={label}
                count={search.total}
                checked={activeId === search.id}
                onToggle={() => onOpen(search.id, search.status === 'Running')}
                menu={(
                  <>
                    {/* Runs it again, and while that runs, the same button stops it. */}
                    {live ? (
                      <Button type="button" variant="ghost" size="icon" className="group size-7 shrink-0" aria-label={t('Stop search')} title={t('Stop search')} onClick={() => onStop(search.id)}>
                        <Loader2 className="size-4 animate-spin group-hover:hidden group-focus-visible:hidden" />
                        <X className="hidden size-4 group-hover:block group-focus-visible:block" />
                      </Button>
                    ) : saved[search.id] && (
                      <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" disabled={running} aria-label={t('Run {value} again', { value: label })} title={t('Run again')} onClick={() => void runAgain(search.id, saved[search.id])}>
                        <RefreshCw className="size-4" />
                      </Button>
                    )}
                    <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" aria-label={t('Delete search {value}', { value: label })} title={t('Delete')} onClick={() => void remove(search.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                )}
              />
            )
          })}
        {keep && hiddenSearches > 0 && (
          <li>
            <Button type="button" variant="ghost" size="sm" className="h-7 w-full justify-start px-2 text-muted-foreground" onClick={() => setExtra(extra + perPage)}>
              <ChevronDown className="size-4" />
              {t('Show more')}
              <span className="ms-auto text-xs tabular-nums">{hiddenSearches}</span>
            </Button>
          </li>
        )}
      </Section>

      {/* Filters set from the table's titles or the funnel above, each opening its editor. */}
      {activeCount(filters) > 0 && (
        <Section id="columns" title={t('Column filters')} icon={Filter} chosen={activeCount(filters)} onClear={() => targets.forEach(target => filters[target.id] && onFilterChange(target.id, null))} folded={folded.includes('columns')} onFold={fold}>
          <li><ColumnFilterChips targets={targets} filters={filters} onChange={onFilterChange} className="gap-1.5" /></li>
        </Section>
      )}

      <Section
        id="plugins" title={t('Plugins')} icon={Puzzle} chosen={pluginFilter.length} onClear={() => onFilterChange('engineName', null)} folded={folded.includes('plugins')} onFold={fold} {...searchProps('plugins')}
        action={(
          <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={t('Manage plugins')} title={t('Manage plugins')} onClick={onManagePlugins}>
            <Settings className="size-4" />
          </Button>
        )}
      >
        {/* Every enabled plugin searches; turning them on and off is under Manage plugins. */}
        {pluginRows.length === 0 ? <li className="px-2 py-1 text-sm text-muted-foreground">{t('No plugins enabled.')}</li>
          : shownPlugins.length === 0 ? nothing
          : shownPlugins.map(row => (
            <FilterItem key={row.name} icon={Puzzle} label={row.label} count={countOf(row)} muted={countOf(row) === 0} checked={pluginFilter.includes(valueOf(row))} onToggle={() => togglePlugin(valueOf(row))} />
          ))}
      </Section>

      {/* qBittorrent searches one category at a time, so picking one searches again. Results don't
          say their category, so it can't narrow results already found. */}
      {categories.length > 1 && <Section id="categories" title={t('Categories')} icon={Shapes} chosen={category === 'all' ? 0 : 1} onClear={() => onCategoryChange('all')} folded={folded.includes('categories')} onFold={fold} {...searchProps('categories')}>
        {shownCategories.length === 0 ? nothing : shownCategories.map(([value, label, icon]) => (
          <FilterItem key={value} icon={icon} label={t(label)} muted={value === 'all'} checked={category === value} onToggle={() => onCategoryChange(category === value ? 'all' : value)} />
        ))}
      </Section>}
    </div>
  )
}
