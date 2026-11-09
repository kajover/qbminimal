import { lazy, useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type ReactElement } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/NativeSelect'
import { PageBoundary } from '@/components/PageBoundary'
import { PageHeader } from '@/components/PageHeader'
import { useCategories, useDeleteTorrents, usePauseTorrents, useResumeTorrents, useTags, useTorrents, useTrackerMap } from '@/hooks/useApi'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useRowPress, type RowProps } from '@/hooks/useRowPress'
import { useSelection } from '@/hooks/useSelection'
import { useTorrentList } from '@/hooks/useTorrentList'
import { PAGE_SIZES } from '@/lib/listSettings'
import { loadFilterViews, type FilterView } from '@/lib/filterViews'
import { announce } from '@/lib/announce'
import { getColumn, loadColumnLayout, saveColumnLayout, type ColumnLayout } from '@/lib/torrentColumns'
import type { Torrent } from '@/types'
import { useBulkActions, type BulkPrompt } from './bulkActions'
import { BulkPromptDialog } from './BulkPromptDialog'
import { DeleteTorrentsDialog } from './DeleteTorrentsDialog'
import { FilterViewChips } from './FilterViews'
import { TorrentCards } from './TorrentCards'
import { TorrentFilterPanel } from './TorrentFilterPanel'
import { MoreMenu, TorrentContextMenu } from './TorrentMenus'
import { ShortcutsDialog } from './ShortcutsDialog'
import { TorrentStats } from './TorrentStats'
import { TorrentTable } from './TorrentTable'
import { TorrentToolbar } from './TorrentToolbar'
import { t } from '@/i18n'

const CategoriesTagsDialog = lazy(() => import('./CategoriesTagsDialog').then(m => ({ default: m.CategoriesTagsDialog })))
const TorrentDetailsPanel = lazy(() => import('./TorrentDetails').then(m => ({ default: m.TorrentDetailsPanel })))
const TorrentDetailsDialog = lazy(() => import('./TorrentDetails').then(m => ({ default: m.TorrentDetailsDialog })))

const EMPTY: Torrent[] = []

// Keys typed into a field, or pressed while a dialog or menu is open, aren't list shortcuts.
function isListShortcut(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (target.closest('input, textarea, select, [contenteditable="true"]')) return false
  return !document.querySelector('[role="dialog"], [role="menu"]')
}

export function TorrentsView() {
  const { data: torrents = EMPTY, isLoading, isError } = useTorrents()
  const { data: trackerMap } = useTrackerMap()
  const { data: categories } = useCategories()
  const { data: tags } = useTags()
  const list = useTorrentList(torrents, trackerMap)
  const pause = usePauseTorrents()
  const resume = useResumeTorrents()
  const remove = useDeleteTorrents()
  const wide = useMediaQuery('(min-width: 1200px)')
  const mouse = useMediaQuery('(pointer: fine)')

  const selection = useSelection(list.rows.map(t => t.hash))
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [detailsHash, setDetailsHash] = useState<string | null>(null)
  const [columns, setColumns] = useState<ColumnLayout>(loadColumnLayout)
  // A new id for each request starts the delete dialog fresh.
  const [deleteRequest, setDeleteRequest] = useState<{ id: number; torrents: Torrent[] }>({ id: 0, torrents: [] })
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [prompt, setPrompt] = useState<BulkPrompt | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [views, setViews] = useState<FilterView[]>(loadFilterViews)
  // The row that Tab reaches and the arrow keys move from.
  const [focusHash, setFocusHash] = useState<string | null>(null)

  // Looked up on every refresh, so open details stay current. Torrents deleted elsewhere drop out.
  const detailsTorrent = torrents.find(t => t.hash === detailsHash)
  const selectedTorrents = torrents.filter(t => selection.selected.has(t.hash))
  const count = selectedTorrents.length
  const groups = useBulkActions(selectedTorrents, setPrompt)
  const closeDetails = useCallback(() => setDetailsHash(null), [])

  // Screen readers hear changes the user made, not the 2 second data refresh.
  const previousCount = useRef(count)
  useEffect(() => {
    if (previousCount.current === count) return
    previousCount.current = count
    announce(count > 0 ? t('{count} selected', { count }) : t('Selection cleared'))
  }, [count])
  const { field: sortField, direction: sortDirection } = list.sort
  const sortMounted = useRef(false)
  useEffect(() => {
    if (!sortMounted.current) { sortMounted.current = true; return }
    const column = getColumn(sortField).label
    announce(sortDirection === 'asc' ? t('Sorted by {column}, ascending', { column }) : t('Sorted by {column}, descending', { column }))
  }, [sortField, sortDirection])
  const viewMounted = useRef(false)
  useEffect(() => {
    if (!viewMounted.current) { viewMounted.current = true; return }
    announce(list.showTable ? t('Table view') : t('Card view'))
  }, [list.showTable])
  const matchingCount = useRef(list.matching.length)
  const matchingLength = list.matching.length
  useEffect(() => { matchingCount.current = matchingLength })
  const { name: filterName, status: filterStatus, category: filterCategory, tag: filterTag, tracker: filterTracker } = list.filters
  const filtersMounted = useRef(false)
  useEffect(() => {
    if (!filtersMounted.current) { filtersMounted.current = true; return }
    const timer = setTimeout(() => {
      const n = matchingCount.current
      announce(n === 0 ? t('No torrents match these filters') : n === 1 ? t('1 torrent') : t('{count} torrents', { count: n }))
    }, 800)
    return () => clearTimeout(timer)
  }, [filterName, filterStatus, filterCategory, filterTag, filterTracker])

  const changeColumns = (layout: ColumnLayout) => {
    setColumns(layout)
    saveColumnLayout(layout)
  }

  const askToDelete = (targets: Torrent[]) => {
    if (!targets.length) return
    setDeleteRequest(current => ({ id: current.id + 1, torrents: targets }))
    setDeleteOpen(true)
  }
  const confirmDelete = (withFiles: boolean) => {
    const hashes = deleteRequest.torrents.map(t => t.hash)
    remove.mutate({ hashes, deleteFiles: withFiles })
    selection.remove(hashes)
    if (detailsHash && hashes.includes(detailsHash)) closeDetails()
    setDeleteOpen(false)
  }
  const start = () => resume.mutate(selectedTorrents.map(t => t.hash))
  const stop = () => pause.mutate(selectedTorrents.map(t => t.hash))

  const press = useRowPress<Torrent>({
    onPress: (event: MouseEvent, torrent, touch) => {
      const { hash } = torrent
      if (touch) {
        // After a long press has started selecting, taps add and remove instead of opening.
        if (count > 0) selection.toggle(hash)
        else setDetailsHash(hash)
        return
      }
      if (event.shiftKey) return selection.extendTo(hash)
      if (event.metaKey || event.ctrlKey) return selection.toggle(hash)
      // Clicking the open torrent again, when it's the only one selected, closes it.
      if (detailsHash === hash && count === 1 && selection.selected.has(hash)) {
        selection.clear()
        closeDetails()
        return
      }
      selection.only(hash)
      setDetailsHash(hash)
    },
    onLongPress: torrent => selection.toggle(torrent.hash),
    // The menu acts on the selection, so a row outside it becomes the selection.
    onMenu: torrent => {
      if (!selection.selected.has(torrent.hash)) selection.only(torrent.hash)
    },
  })
  const toggleBox = (hash: string, range: boolean) => (range ? selection.extendTo(hash) : selection.toggle(hash))

  // Only one row is a Tab stop; the arrow keys move between rows, like in a file manager.
  const tabStop = list.rows.some(t => t.hash === focusHash) ? focusHash : list.rows[0]?.hash
  const onRowKey = (event: ReactKeyboardEvent<HTMLElement>, torrent: Torrent) => {
    if (event.target !== event.currentTarget) return
    const index = list.rows.findIndex(t => t.hash === torrent.hash)
    const moves: Record<string, number> = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: list.rows.length - 1 }
    if (event.key in moves) {
      event.preventDefault()
      const next = list.rows[Math.max(0, Math.min(list.rows.length - 1, moves[event.key]))]
      if (!next) return
      document.querySelector<HTMLElement>(`[data-hash="${next.hash}"]`)?.focus()
      // Shift extends the selection, Ctrl or Cmd only moves, and a plain arrow selects the row,
      // following with the details when they're open.
      if (event.shiftKey) selection.extendTo(next.hash)
      else if (!event.metaKey && !event.ctrlKey) {
        selection.only(next.hash)
        if (detailsHash) setDetailsHash(next.hash)
      }
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (!selection.selected.has(torrent.hash)) selection.only(torrent.hash)
      setDetailsHash(torrent.hash)
    } else if (event.key === ' ') {
      event.preventDefault()
      selection.toggle(torrent.hash)
    }
  }
  const rowProps = (torrent: Torrent): RowProps => ({
    ...press(torrent),
    'data-hash': torrent.hash,
    tabIndex: torrent.hash === tabStop ? 0 : -1,
    onFocus: (event) => {
      if (event.target === event.currentTarget) setFocusHash(torrent.hash)
    },
    onKeyDown: (event) => onRowKey(event, torrent),
  })

  const withMenu = (target: ReactElement) => (
    <TorrentContextMenu torrents={selectedTorrents} groups={groups} onDetails={t => setDetailsHash(t.hash)} onStart={start} onStop={stop} onDelete={() => askToDelete(selectedTorrents)}>
      {target}
    </TorrentContextMenu>
  )

  // Ctrl or Cmd + A selects every matching torrent, Delete asks to delete the selection, Escape
  // closes the details and then clears the selection, / opens the search, and ? lists all of these.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isListShortcut(event)) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        selection.replace(list.matching.map(t => t.hash))
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && count > 0) {
        event.preventDefault()
        askToDelete(selectedTorrents)
      } else if (event.key === 'Escape') {
        if (detailsHash) closeDetails()
        else selection.clear()
      } else if (event.key === '/') {
        event.preventDefault()
        if (filtersOpen) document.querySelector<HTMLElement>('#torrent-filters input')?.focus()
        else setFiltersOpen(true)
      } else if (event.key === '?') {
        event.preventDefault()
        setShortcutsOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const total = torrents.length
  const header = (
    <PageHeader
      title={t('Torrents')}
      description={!isLoading && (
        // The count opens the connection status and statistics.
        <TorrentStats>
          <button type="button" className="underline-offset-4 hover:text-foreground hover:underline" title={t('Show connection status and statistics')}>
            {list.filtered ? t('{length} of {total} torrents', { length: list.matching.length, total }) : (total === 1 ? t('1 torrent') : t('{count} torrents', { count: total }))}
          </button>
        </TorrentStats>
      )}
      actions={total > 0 && <TorrentToolbar list={list} filtersOpen={filtersOpen} onToggleFilters={() => setFiltersOpen(open => !open)} columns={columns} onColumnsChange={changeColumns} onShowShortcuts={() => setShortcutsOpen(true)} />}
    />
  )

  if (isLoading) {
    // Placeholder rows in the shape of the list, so the page doesn't jump when it arrives.
    return (
      <div className="space-y-4">
        {header}
        <div role="status" aria-label={t('Loading torrents')} className="space-y-2 rounded-xl border bg-card p-3">
          {[72, 55, 64, 48, 60].map((width, i) => (
            <div key={i} className="flex animate-pulse items-center gap-3 py-1.5">
              <div className="h-4 w-4 rounded bg-muted" />
              <div className="h-3 rounded bg-muted" style={{ width: `${width}%` }} />
              <div className="ms-auto h-3 w-16 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const notice = isError && total === 0 ? t('Couldn\'t load torrents. Check the connection to qBittorrent.')
    : total === 0 ? t('No torrents yet. Add one from the Add page.')
    : null
  if (notice) {
    return (
      <div className="space-y-4">
        {header}
        <p className="py-8 text-center text-sm text-muted-foreground">{notice}</p>
      </div>
    )
  }

  const matchingSelected = list.matching.filter(t => selection.selected.has(t.hash)).length

  return (
    <div className="space-y-4">
      {header}

      {count > 0 && (
        // Phones: above the tab bar and the table's scrollbar, where a thumb reaches, without the list's gap
        // below it, which would only push it up. Wide screens: under the header.
        <div
          role="toolbar"
          aria-label={t('Selected torrents')}
          className="glass z-30 flex items-center gap-1 overflow-x-auto p-1.5 max-md:fixed max-md:inset-x-3 max-md:mb-0 max-md:bottom-[calc(var(--bottom-nav-height,4rem)+var(--table-scrollbar-space,0px)+0.5rem)] max-md:rounded-full max-md:px-2 md:sticky md:top-16 md:rounded-xl"
        >
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" aria-label={t('Clear selection')} title={t('Clear selection (Esc)')} onClick={selection.clear}>
            <X className="h-4 w-4" />
          </Button>
          <span className="me-auto pe-2 text-sm whitespace-nowrap tabular-nums">{t('{count} selected', { count })}</span>
          <Button variant="ghost" size="sm" className="gap-1" title={t('Start')} onClick={start}><Play className="h-4 w-4" /><span className="max-sm:sr-only">{t('Start')}</span></Button>
          <Button variant="ghost" size="sm" className="gap-1" title={t('Stop')} onClick={stop}><Pause className="h-4 w-4" /><span className="max-sm:sr-only">{t('Stop')}</span></Button>
          <MoreMenu torrents={selectedTorrents} groups={groups} />
          <Button variant="ghost" size="sm" className="gap-1 text-destructive hover:text-destructive" title={t('Delete (Del)')} onClick={() => askToDelete(selectedTorrents)}><Trash2 className="h-4 w-4" /><span className="max-sm:sr-only">{t('Delete')}</span></Button>
        </div>
      )}

      <FilterViewChips list={list} views={views} onViewsChange={setViews} />

      {filtersOpen && <TorrentFilterPanel list={list} categories={Object.keys(categories ?? {})} tags={tags ?? []} onManage={() => setManageOpen(true)} views={views} onViewsChange={setViews} />}

      {list.matching.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
          <span>{t('No torrents match these filters')}</span>
          <Button variant="outline" size="sm" onClick={list.clearFilters}>{t('Clear filters')}</Button>
        </div>
      ) : list.showTable ? (
        <TorrentTable
          torrents={list.rows}
          layout={columns}
          onLayoutChange={changeColumns}
          onResetSort={list.resetSort}
          selected={selection.selected}
          selectAllState={matchingSelected === 0 ? false : matchingSelected === list.matching.length ? true : 'indeterminate'}
          onToggle={toggleBox}
          onSelectAll={(checked) => (checked ? selection.replace(list.matching.map(t => t.hash)) : selection.clear())}
          openHash={detailsTorrent ? detailsTorrent.hash : null}
          sortField={list.sort.field}
          sortDirection={list.sort.direction}
          onSort={list.sortBy}
          rowProps={rowProps}
          wrapBody={withMenu}
        />
      ) : (
        <TorrentCards
          torrents={list.rows}
          selected={selection.selected}
          showCheckboxes={mouse || count > 0}
          onToggle={toggleBox}
          openHash={detailsTorrent ? detailsTorrent.hash : null}
          rowProps={rowProps}
          wrapList={withMenu}
        />
      )}

      {list.matching.length > PAGE_SIZES[0] && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            {t('Show')}
            <NativeSelect className="h-8 text-foreground" value={list.pageSize} onChange={(e) => list.setPageSize(Number(e.target.value))}>
              {PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
            </NativeSelect>
            {t('per page')}
          </label>
          {list.pageCount > 1 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" aria-label={t('Previous page')} disabled={list.page === 1} onClick={() => list.setPage(list.page - 1)}><ChevronLeft className="h-4 w-4 rtl:rotate-180" /></Button>
              <span className="text-sm tabular-nums">{list.page} / {list.pageCount}</span>
              <Button variant="outline" size="sm" aria-label={t('Next page')} disabled={list.page === list.pageCount} onClick={() => list.setPage(list.page + 1)}><ChevronRight className="h-4 w-4 rtl:rotate-180" /></Button>
            </div>
          )}
        </div>
      )}

      {/* Keeps the last cards clear of the selection bar on phones. */}
      {count > 0 && <div aria-hidden className="h-[calc(3.5rem+var(--table-scrollbar-space,0px))] md:hidden" />}

      <DeleteTorrentsDialog key={deleteRequest.id} torrents={deleteRequest.torrents} open={deleteOpen} onOpenChange={setDeleteOpen} onConfirm={confirmDelete} />
      <BulkPromptDialog torrents={selectedTorrents} prompt={prompt} onClose={() => setPrompt(null)} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      {manageOpen && (
        <PageBoundary loading={null}>
          <CategoriesTagsDialog open onOpenChange={setManageOpen} />
        </PageBoundary>
      )}
      {detailsTorrent && (
        <PageBoundary loading={null}>
          {wide
            ? <TorrentDetailsPanel torrent={detailsTorrent} onClose={closeDetails} />
            : <TorrentDetailsDialog torrent={detailsTorrent} onClose={closeDetails} />}
        </PageBoundary>
      )}
    </div>
  )
}
