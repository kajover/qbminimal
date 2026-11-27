import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRemembered } from '@/hooks/useRemembered'
import { Download, Eraser, Loader2, PanelRight, Plus, Search, X } from 'lucide-react'
import { Tooltip } from '@/components/ui/tooltip'
import { SelectionBar } from '@/components/torrents/SelectionBar'
import { useSelection } from '@/hooks/useSelection'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchInput } from '@/components/SearchInput'
import { PageHeader } from '@/components/PageHeader'
import { FilterSheet } from '@/components/FilterSidebarParts'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchPlugins } from '@/hooks/useApi'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useSearchJob } from '@/hooks/useSearchJob'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import { activeCount, withFilter, type ColumnFilter, type ColumnFilters } from '@/lib/columnFilters'
import { formatBytes } from '@/lib/format'
import { searchFilterTargets } from '@/lib/searchFilters'
import type { SavedSearch } from '@/lib/searchPatterns'
import { readStored, writeStored } from '@/lib/storage'
import { cn } from '@/lib/utils'
import type { SearchResult } from '@/types'
import { SearchPluginsDialog } from './SearchPluginsDialog'
import { SearchResults } from './SearchResults'
import { resultKey } from '@/lib/searchFilters'
import { SearchSidebar } from './SearchSidebar'
import { t } from '@/i18n'
import { withKeys } from '@/lib/shortcutKeys'
import { ROOM_FOR_SIDEBAR } from '@/lib/pageScroll'

// Whether the sidebar was left open beside the results, kept on this device.
const SIDEBAR_KEY = 'qbminimal.searchSidebar'

export function SearchView() {
  const search = useSearchJob()
  const queryClient = useQueryClient()
  const { data: plugins } = useSearchPlugins()
  const [pattern, setPatternState] = useState(search.pattern)
  const [category, setCategory] = useState(search.category)
  // Column filters belong to the search shown, so a new search starts without them.
  // Kept while another page shows, as is the open filter sheet (useRemembered).
  const [filtersFor, setFiltersFor] = useRemembered<{ job: number | null; filters: ColumnFilters }>('search.filters', { job: null, filters: {} })
  const filters = filtersFor.job === search.jobId ? filtersFor.filters : {}
  const setFilter = (id: string, filter: ColumnFilter | null) => setFiltersFor({ job: search.jobId, filters: withFilter(filters, id, filter) })
  // The sidebar starts closed. Where it fits beside the results it stays open once opened there; on
  // phones it opens over the page each time.
  const sideBySide = useMediaQuery(ROOM_FOR_SIDEBAR)
  const [sidebarPref, setSidebarPref] = useState(() => readStored(SIDEBAR_KEY))
  const [sheetOpen, setSheetOpen] = useRemembered('search.sheetOpen', false)
  // The results' column, which the phone filter sheet lines up with.
  const [resultsColumn, setResultsColumn] = useState<HTMLDivElement | null>(null)
  const sidebarOpen = sideBySide ? sidebarPref === 'open' : sheetOpen
  const setSidebarOpen = (open: boolean) => {
    if (!sideBySide) return setSheetOpen(open)
    setSidebarPref(open ? 'open' : null)
    writeStored(SIDEBAR_KEY, open ? 'open' : null)
  }
  const [pluginsOpen, setPluginsOpen] = useState(false)
  const [toolbarSlot, setToolbarSlot] = useState<HTMLDivElement | null>(null)
  // The results asked to be added: one from its own button or card, or the ticked ones.
  const [adding, setAdding] = useState<SearchResult[] | null>(null)
  const [addBusy, setAddBusy] = useState(false)
  // Ticked results, kept while another page shows, and only for the search they were ticked in.
  const [shownKeys, setShownKeys] = useState<string[]>([])
  // The same list again keeps the old one, so drawing the results again doesn't start another round.
  const onShown = useCallback((keys: string[]) => setShownKeys(current => (current.length === keys.length && current.every((key, i) => key === keys[i]) ? current : keys)), [])
  const selection = useSelection(shownKeys, 'search.selected')
  const [selectedFor, setSelectedFor] = useRemembered<number | null>('search.selectedFor', search.jobId ?? null)
  if ((search.jobId ?? null) !== selectedFor) {
    setSelectedFor(search.jobId ?? null)
    if (selection.selected.size) selection.clear()
  }
  const selectedResults = useMemo(() => search.results.filter(result => selection.selected.has(resultKey(result))), [search.results, selection.selected])
  const resultSelection = useMemo(() => ({
    selected: selection.selected,
    toggle: (key: string, range: boolean) => (range ? selection.extendTo(key) : selection.toggle(key)),
    replace: selection.replace,
    clear: selection.clear,
  }), [selection])
  const [barWidth, setBarWidth] = useState<number>()
  const [barInHeader, setBarInHeader] = useState(false)
  // Esc clears the ticks, as on the torrent list, unless a field or a dialog takes it.
  const hasSelection = selectedResults.length > 0
  const clearSelection = selection.clear
  useEffect(() => {
    if (!hasSelection) return
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.key !== 'Escape' || event.defaultPrevented || target?.closest('input, textarea, select, [role="dialog"], [role="menu"]')) return
      clearSelection()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [hasSelection, clearSelection])


  const enabled = (plugins ?? []).filter(plugin => plugin.enabled)
  const setPattern = (text: string) => setPatternState(text)

  // Every enabled plugin searches; the sidebar's plugins narrow the results afterwards.
  const submit = (event: FormEvent) => {
    event.preventDefault()
    // The same button stops a running search, and ignores a click that lands just after it ended.
    if (search.running) void search.cancel()
    else if (pattern.trim() && !search.justEnded()) void search.start(pattern.trim(), 'enabled', category)
  }

  // A category is searched in, so picking one runs the search shown again with it.
  const changeCategory = (next: string) => {
    setCategory(next)
    if (search.searched && !search.running && pattern.trim()) void search.start(pattern.trim(), 'enabled', next)
  }

  // Runs a saved search with its own category, shown in the form and sidebar too.
  const runAgain = (saved: SavedSearch) => {
    setPattern(saved.pattern)
    setCategory(saved.category)
    return search.start(saved.pattern, 'enabled', saved.category)
  }
  const targets = useMemo(() => searchFilterTargets(search.results), [search.results])
  const pluginCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const result of search.results) if (result.engineName) counts.set(result.engineName, (counts.get(result.engineName) ?? 0) + 1)
    return counts
  }, [search.results])
  const narrowed = category !== 'all' || activeCount(filters) > 0
  const sidebarLabel = narrowed ? t('Filters (on)') : t('Filters')


  // Each one as qBittorrent's own search does: the plugin fetches the .torrent itself when it
  // can, for sites that need its login. Added one after another; those that fail are told.
  const add = async (results: SearchResult[]) => {
    setAddBusy(true)
    let failed = 0
    let reason: string | undefined
    for (const result of results) {
      try {
        await (result.engineName ? qbitClient.downloadSearchTorrent(result.fileUrl, result.engineName) : qbitClient.addTorrentUrl(result.fileUrl))
      } catch (error) {
        failed++
        reason = error instanceof Error ? error.message : undefined
      }
    }
    setAddBusy(false)
    const added = results.length - failed
    if (added) toast.success(results.length === 1 ? t('Added to qBittorrent') : t('{count} torrents added to qBittorrent', { count: added }))
    if (failed) toast.error(results.length === 1 ? t('Couldn\'t add the torrent') : t('Couldn\'t add {count} torrents', { count: failed }), { description: reason })
    if (!failed) {
      setAdding(null)
      if (results.length > 1) selection.clear()
    }
  }

  const selectionBar = (inHeader: boolean, centered: boolean) => selectedResults.length > 0 && (
    <SelectionBar
      label={t('Selected results')}
      inHeader={inHeader}
      centered={centered}
      onWidth={setBarWidth}
      onPlace={setBarInHeader}
      count={selectedResults.length}
      total={shownKeys.length}
      trailing={(
        <>
          <Tooltip label={t('Add')}>
            <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={t('Add')} onClick={() => setAdding(selectedResults)}><Download className="size-4" /></Button>
          </Tooltip>
          <Tooltip label={`${t('Clear selection')} (Esc)`}>
            <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={t('Clear selection')} onClick={selection.clear}><X className="size-4" /></Button>
          </Tooltip>
        </>
      )}
    />
  )

  const sidebar = (
    <SearchSidebar
      activeId={search.jobId}
      running={search.running}
      onOpen={(id, running) => search.open(id, running)}
      onRun={runAgain}
      onStop={(id) => void (id === search.jobId ? search.cancel() : qbitClient.stopSearch(id).then(() => queryClient.invalidateQueries({ queryKey: ['search', 'status'] }), () => toast.error(t('Couldn\'t stop the search in qBittorrent'))))}
      onCleared={search.close}
      plugins={enabled}
      pluginCounts={pluginCounts}
      category={category}
      onCategoryChange={changeCategory}
      onManagePlugins={() => setPluginsOpen(true)}
      targets={targets}
      filters={filters}
      onFilterChange={setFilter}
    />
  )

  return (
    // In the frame (wide screens) the page fills the window: the search field stays, only the
    // results scroll, and the sidebar beside them on its own. Phones scroll the whole page.
    <div className="flex flex-col gap-4 frame:h-full">
      {/* The results put their filter, columns and view buttons here, as the torrent list does,
          shown before a search too so the view can be picked first. */}
      {/* The results put their columns and view buttons here, as the torrent list does, shown before
          a search too so the view can be picked first. The sidebar button comes last. */}
      <PageHeader
        title={t('Search')}
        middle={selectionBar}
        middleWidth={barWidth}
        actions={(
          <>
            <div ref={setToolbarSlot} className="flex items-center gap-1" />
            <Button variant={sidebarOpen ? 'secondary' : 'outline'} size="icon" className="relative size-8" aria-label={sidebarLabel} title={withKeys(sidebarLabel, 'F')} data-key="f" aria-expanded={sidebarOpen} aria-controls="search-sidebar" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <PanelRight className="size-4" />
              {narrowed && <span aria-hidden className="absolute -end-0.5 -top-0.5 size-2.5 rounded-full bg-primary ring-2 ring-background" />}
            </Button>
          </>
        )}
      />

      {/* A short field: the plugins and category are in the sidebar. Above it, so the sidebar
          starts where the results do. */}
      <form onSubmit={submit} className="flex max-w-xl shrink-0 items-center gap-2">
        <SearchInput id="search-pattern" aria-label={t('Search for')} placeholder={t('Search')} title={withKeys(t('Search'), 'S')} data-key="s" value={pattern} onValueChange={setPattern} required={!search.running} className="min-w-0 flex-1" />
        {/* While searching, the spinner turns into a stop button under the pointer. It stops the
            search even with the field emptied: the field is only required to start one. */}
        <Button type="submit" className="group" aria-label={search.running ? t('Stop search') : t('Search')} title={search.running ? t('Stop search') : t('Search')}>
          {search.running ? (
            <>
              <Loader2 className="size-4 animate-spin group-hover:hidden group-focus-visible:hidden" />
              <X className="hidden size-4 group-hover:block group-focus-visible:block" />
            </>
          ) : <Search className="size-4" />}
        </Button>
        {/* Takes the results and the text away, stopping a search still running, ready for the
            next search. Always there, so the field keeps its width; greyed out with nothing to clear. */}
        <Button type="button" variant="outline" size="icon" disabled={!search.searched} aria-label={t('Clear results')} title={t('Clear results')} onClick={() => { if (search.running) void search.cancel(); search.close(); setPattern(''); document.getElementById('search-pattern')?.focus() }}>
          <Eraser className="size-4" />
        </Button>
      </form>

      {/* Beside the results where it fits, over them on phones, as on the torrent list. */}
      <div className={cn('frame:flex frame:min-h-0 frame:flex-1', sidebarOpen && sideBySide && 'flex items-start gap-4 frame:items-stretch')}>
        {!sideBySide && <FilterSheet open={sheetOpen} onOpenChange={setSheetOpen} list={resultsColumn}>{sidebar}</FilterSheet>}
        <div ref={setResultsColumn} className="flex min-w-0 flex-1 flex-col gap-4 frame:min-h-0">
          <SearchResults searchId={search.jobId ?? null} results={search.results} onAdd={(result) => setAdding([result])} toolbarSlot={toolbarSlot} filters={filters} onFilterChange={setFilter} selection={resultSelection} onShown={onShown} />
          {search.results.length === 0 && search.searched && !search.running && <p className="py-8 text-center text-sm text-muted-foreground">{t('Nothing found')}</p>}
          {/* Room for the selection bar above the tab bar, so it never covers the last card. */}
          {hasSelection && !barInHeader && <div aria-hidden className="h-10 shrink-0 wide:hidden" />}
        </div>
        {sidebarOpen && sideBySide && (
          <aside aria-label={t('Filters')} className="sticky top-0 max-h-[calc(100dvh-var(--header-height,3rem)-2rem)] w-72 shrink-0 overflow-y-auto rounded-xl border bg-card p-3 window-scroll:top-[calc(var(--header-height,3rem)+1rem)] window-scroll:max-h-[calc(100dvh-var(--header-height,3rem)-var(--bottom-nav-height,0px)-2rem)]">
            {/* Sticks at the top of the scrolling area, whose own padding already leaves the gap; an
                offset would add to it and push the sidebar below what's beside it. Where the window
                scrolls, it sticks below the header, which lies over the page. */}
            {sidebar}
          </aside>
        )}
      </div>

      <SearchPluginsDialog open={pluginsOpen} onOpenChange={setPluginsOpen} />

      <Dialog open={!!adding} onOpenChange={(open) => !open && setAdding(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{adding && adding.length > 1 ? t('Add {count} torrents?', { count: adding.length }) : t('Add this torrent?')}</DialogTitle>
            <DialogDescription>{t('qBittorrent downloads it with your default settings.')}</DialogDescription>
          </DialogHeader>
          {adding?.length === 1 && (
            // One line each, clipped where the window is too narrow; hovering gives the whole name.
            // min-w-0, so the dialog's grid lets the line shrink below the name's width.
            <div className="min-w-0 space-y-1 text-sm">
              <p className="truncate font-medium" title={adding[0].fileName}>{adding[0].fileName}</p>
              <p className="text-muted-foreground">{formatBytes(adding[0].fileSize)} · {t('{seeds} seeds · {leeches} leeches', { seeds: adding[0].nbSeeders, leeches: adding[0].nbLeechers })}</p>
            </div>
          )}
          {adding && adding.length > 1 && (
            <div className="min-w-0 space-y-1 text-sm">
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {adding.map(result => <li key={resultKey(result)} className="truncate" title={result.fileName}>{result.fileName}</li>)}
              </ul>
              <p className="text-muted-foreground">{formatBytes(adding.reduce((sum, result) => sum + Math.max(result.fileSize, 0), 0))}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(null)}>{t('Cancel')}</Button>
            {/* Enter adds it: it's the dialog's last button. */}
            <Button disabled={addBusy} onClick={() => adding && void add(adding)} className="gap-2">
              {addBusy ? <Loader2 className="size-4 animate-spin" /> : <Plus />}
              {t('Add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
