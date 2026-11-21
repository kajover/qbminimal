import { useMemo, useState, type FormEvent } from 'react'
import { Eraser, Loader2, PanelRight, Plus, Search, X } from 'lucide-react'
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
  const [filtersFor, setFiltersFor] = useState<{ job: number | null; filters: ColumnFilters }>({ job: null, filters: {} })
  const filters = filtersFor.job === search.jobId ? filtersFor.filters : {}
  const setFilter = (id: string, filter: ColumnFilter | null) => setFiltersFor({ job: search.jobId, filters: withFilter(filters, id, filter) })
  // The sidebar starts closed. Where it fits beside the results it stays open once opened there; on
  // phones it opens over the page each time.
  const sideBySide = useMediaQuery(ROOM_FOR_SIDEBAR)
  const [sidebarPref, setSidebarPref] = useState(() => readStored(SIDEBAR_KEY))
  const [sheetOpen, setSheetOpen] = useState(false)
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
  const [adding, setAdding] = useState<SearchResult | null>(null)
  const [addBusy, setAddBusy] = useState(false)


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


  const add = async (result: SearchResult) => {
    setAddBusy(true)
    try {
      // The plugin fetches the .torrent itself when it can, for sites that need its login.
      await (result.engineName ? qbitClient.downloadSearchTorrent(result.fileUrl, result.engineName) : qbitClient.addTorrentUrl(result.fileUrl))
      toast.success(t('Added to qBittorrent'))
      setAdding(null)
    } catch (error) {
      toast.error(t('Couldn\'t add the torrent'), { description: error instanceof Error ? error.message : undefined })
    } finally {
      setAddBusy(false)
    }
  }

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
          <SearchResults searchId={search.jobId ?? null} results={search.results} onAdd={setAdding} toolbarSlot={toolbarSlot} filters={filters} onFilterChange={setFilter} />
          {search.results.length === 0 && search.searched && !search.running && <p className="py-8 text-center text-sm text-muted-foreground">{t('Nothing found')}</p>}
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
            <DialogTitle>{t('Add this torrent?')}</DialogTitle>
            <DialogDescription>{t('qBittorrent downloads it with your default settings.')}</DialogDescription>
          </DialogHeader>
          {adding && (
            <div className="space-y-1 text-sm">
              <p className="font-medium wrap-anywhere">{adding.fileName}</p>
              <p className="text-muted-foreground">{formatBytes(adding.fileSize)} · {t('{seeds} seeds · {leeches} leeches', { seeds: adding.nbSeeders, leeches: adding.nbLeechers })}</p>
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
