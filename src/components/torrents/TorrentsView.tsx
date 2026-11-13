import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type ReactElement } from 'react'
import { ChevronLeft, ChevronRight, FolderCog, Pause, Play, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/NativeSelect'
import { PageBoundary } from '@/components/PageBoundary'
import { PageHeader } from '@/components/PageHeader'
import { useCategories, useDeleteTorrents, usePauseTorrents, useResumeTorrents, useSessionPausedWarning, useTags, useTorrents, useTrackerMap } from '@/hooks/useApi'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useRowPress, type RowProps } from '@/hooks/useRowPress'
import { useSelection } from '@/hooks/useSelection'
import { useTorrentList } from '@/hooks/useTorrentList'
import { PAGE_SIZES } from '@/lib/listSettings'
import { loadFilterViews, type FilterView } from '@/lib/filterViews'
import { announce } from '@/lib/announce'
import { loadBarActions, saveBarActions } from '@/lib/actionBar'
import { Tooltip } from '@/components/ui/tooltip'
import { toast } from '@/hooks/use-toast'
import { getColumn, loadColumnLayout, saveColumnLayout, TORRENT_FILTER_COLUMNS, type ColumnLayout } from '@/lib/torrentColumns'
import { choiceOptions, NONE } from '@/lib/columnFilters'
import { AddFilterButton, ColumnFilterChips, type FilterTarget } from '@/components/ColumnFilters'
import type { Torrent } from '@/types'
import { useBulkActions, type BulkPrompt } from './bulkActions'
import { BulkPromptDialog } from './BulkPromptDialog'
import { ActionBarDialog } from './ActionBarDialog'
import { DeleteTorrentsDialog } from './DeleteTorrentsDialog'
import { FilterViewChips } from './FilterViews'
import { TorrentCards } from './TorrentCards'
import { ListFilterChips, TorrentFilterPanel } from './TorrentFilterPanel'
import { MoreMenu, TorrentContextMenu } from './TorrentMenus'
import { ShortcutsDialog } from './ShortcutsDialog'
import { TorrentTable } from './TorrentTable'
// Loaded with the list rather than on first use, so the details and dialogs open at once.
import { AddTorrentDialog } from './AddTorrentView'
import { CategoriesTagsDialog } from './CategoriesTagsDialog'
import { TorrentDetailsDialog, TorrentDetailsPanel } from './TorrentDetails'
import { AddTorrentButton, TorrentToolbar } from './TorrentToolbar'
import { t } from '@/i18n'


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
  const warnIfPaused = useSessionPausedWarning()
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
  const [addOpen, setAddOpen] = useState(false)
  const [views, setViews] = useState<FilterView[]>(loadFilterViews)
  // The row that Tab reaches and the arrow keys move from.
  const [focusHash, setFocusHash] = useState<string | null>(null)

  // Looked up on every refresh, so open details stay current. Torrents deleted elsewhere drop out.
  const detailsTorrent = torrents.find(t => t.hash === detailsHash)
  const selectedTorrents = torrents.filter(t => selection.selected.has(t.hash))
  const count = selectedTorrents.length
  const groups = useBulkActions(selectedTorrents, setPrompt)
  // Actions pinned from the More menu to the selection bar.
  // Chosen apart for wide screens and phones.
  const barKind = wide ? 'wide' : 'phone'
  const [allBarActions, setAllBarActions] = useState(() => ({ wide: loadBarActions('wide'), phone: loadBarActions('phone') }))
  const barActions = allBarActions[barKind]
  const [barDialogOpen, setBarDialogOpen] = useState(false)
  const changeBarActions = (ids: string[]) => {
    setAllBarActions(current => ({ ...current, [barKind]: ids }))
    saveBarActions(barKind, ids)
  }
  // On phones the table's scrollbar moves up above the selection bar, which takes the bottom spot.
  const phoneBar = count > 0 && !wide
  useEffect(() => {
    if (!phoneBar) return
    const root = document.documentElement.style
    root.setProperty('--selection-bar-space', 'calc(2.75rem + 0.5rem)')
    return () => { root.removeProperty('--selection-bar-space') }
  }, [phoneBar])
  const entries = groups.flatMap(group => group.entries)
  const pinnedEntries = barActions.flatMap(id => entries.filter(entry => entry.id === id))
  const closeDetails = useCallback(() => setDetailsHash(null), [])

  // What each column's filter needs. A choice offers the values the torrents have, whatever
  // the other filters show, with what the empty value means for that column.
  const filterTargets = useMemo(() => {
    const none: Record<string, string> = { category: t('No category'), tags: t('No tags'), tracker: t('No tracker') }
    return new Map(TORRENT_FILTER_COLUMNS.map((column): [string, FilterTarget] => [column.id, {
      ...column,
      options: column.kind === 'set' ? () => choiceOptions(torrents, column) : undefined,
      valueLabel: (value: string) => (value === NONE ? none[column.id] ?? t('None') : value),
    }]))
  }, [torrents])


  // Screen readers hear changes the user made, not the 2 second data refresh.
  const previousCount = useRef(count)
  useEffect(() => {
    if (previousCount.current === count) return
    // Clearing the selection closes the details too, which belonged to it.
    if (count === 0 && previousCount.current > 0) setDetailsHash(null)
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
  // An Effect Event reads the count as it is when the timer fires, without restarting the timer.
  const matchingLength = list.matching.length
  const announceMatches = useEffectEvent(() => {
    const n = matchingLength
    announce(n === 0 ? t('No torrents match these filters') : n === 1 ? t('1 torrent') : t('{count} torrents', { count: n }))
  })
  const { name: filterName, status: filterStatus, category: filterCategory, tag: filterTag, tracker: filterTracker } = list.filters
  const filtersMounted = useRef(false)
  useEffect(() => {
    if (!filtersMounted.current) { filtersMounted.current = true; return }
    const timer = setTimeout(announceMatches, 800)
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
  // A short note once qBittorrent has done it: the torrent's name for one, or how many.
  const done = (targets: Torrent[], one: (name: string) => string, many: (count: number) => string) => () =>
    toast.success(targets.length === 1 ? one(targets[0].name) : many(targets.length))
  const confirmDelete = (withFiles: boolean) => {
    const targets = deleteRequest.torrents
    const hashes = targets.map(t => t.hash)
    remove.mutate({ hashes, deleteFiles: withFiles }, {
      onSuccess: withFiles
        ? done(targets, name => t('Deleted {name} and its files', { name }), count => t('Torrents and their files deleted: {count}', { count }))
        : done(targets, name => t('Deleted {name}', { name }), count => t('Torrents deleted: {count}', { count })),
    })
    selection.remove(hashes)
    if (detailsHash && hashes.includes(detailsHash)) closeDetails()
    setDeleteOpen(false)
  }
  const started = done(selectedTorrents, name => t('Started {name}', { name }), count => t('Torrents started: {count}', { count }))
  // While all transfers are paused, the warning stands in for "Started".
  const start = () => resume.mutate(selectedTorrents.map(t => t.hash), { onSuccess: () => { if (!warnIfPaused()) started() } })
  const stop = () => pause.mutate(selectedTorrents.map(t => t.hash), { onSuccess: done(selectedTorrents, name => t('Stopped {name}', { name }), count => t('Torrents stopped: {count}', { count })) })

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

  // Phones: where a thumb reaches, right above the tab bar, or where the tab bar would be when it's
  // off. Wide screens: in the header, in the middle of the window, so the list below doesn't move
  // when a torrent is selected.
  const selectionBar = count > 0 && (
    <div
      role="toolbar"
      aria-label={t('Selected torrents')}
      className="glass glass-flat-phone z-30 flex items-center gap-1 overflow-x-auto max-md:fixed max-md:inset-x-3 max-md:bottom-[calc(var(--bottom-nav-height,4rem)+var(--selection-bar-gap,0.5rem))] max-md:rounded-full max-md:p-1.5 max-md:px-2 md:absolute md:top-1/2 md:left-1/2 md:max-w-[calc(100vw-38rem)] md:-translate-1/2 md:rounded-xl md:p-0.5"
    >
      <Button variant="ghost" size="icon" className="size-8 shrink-0 rounded-full" aria-label={t('Clear selection')} title={t('Clear selection (Esc)')} onClick={selection.clear}>
        <X className="size-4" />
      </Button>
      <span className="pe-1 text-sm whitespace-nowrap tabular-nums">{t('{selected}/{total} selected', { selected: count, total: list.matching.length })}</span>
      <Button variant="ghost" size="sm" className="gap-1" title={t('Start')} onClick={start}><Play className="size-4" /><span className="max-sm:sr-only">{t('Start')}</span></Button>
      <Button variant="ghost" size="sm" className="gap-1" title={t('Stop')} onClick={stop}><Pause className="size-4" /><span className="max-sm:sr-only">{t('Stop')}</span></Button>
      {pinnedEntries.map(entry => {
        const Icon = entry.icon
        return Icon && (
          <Tooltip key={entry.id} label={entry.label}>
            <Button variant={entry.pressed || entry.checked ? 'secondary' : 'ghost'} size="icon" className="size-8 shrink-0" aria-label={entry.label} aria-pressed={entry.pressed ?? entry.checked} onClick={entry.onSelect}>
              <Icon className="size-4" />
            </Button>
          </Tooltip>
        )
      })}
      <MoreMenu torrents={selectedTorrents} groups={groups} onCustomize={() => setBarDialogOpen(true)} />
      <Button variant="ghost" size="sm" className="gap-1 text-destructive hover:text-destructive" title={t('Delete (Del)')} onClick={() => askToDelete(selectedTorrents)}><Trash2 className="size-4" /><span className="max-sm:sr-only">{t('Delete')}</span></Button>
    </div>
  )

  const total = torrents.length
  const header = (
    <PageHeader
      // The title opens the connection status and statistics.
      title={t('Torrents')}
      middle={selectionBar}
      actions={total > 0
        ? <TorrentToolbar list={list} filtersOpen={filtersOpen} onToggleFilters={() => setFiltersOpen(open => !open)} columns={columns} onColumnsChange={changeColumns} onShowShortcuts={() => setShortcutsOpen(true)} onAdd={() => setAddOpen(true)} />
        : !isLoading && <AddTorrentButton onAdd={() => setAddOpen(true)} />}
    />
  )

  if (isLoading) {
    // Placeholder rows in the shape of the list, so the page doesn't jump when it arrives.
    return (
      <div className="space-y-4">
        {header}
        <div role="status" aria-label={t('Loading torrents')} className="space-y-2 rounded-xl border bg-card p-3 max-sm:-mx-2">
          {[72, 55, 64, 48, 60].map((width, i) => (
            <div key={i} className="flex animate-pulse items-center gap-3 py-1.5">
              <div className="size-4 rounded bg-muted" />
              <div className="h-3 rounded bg-muted" style={{ width: `${width}%` }} />
              <div className="ms-auto h-3 w-16 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const addDialog = addOpen && <AddTorrentDialog open onOpenChange={setAddOpen} />

  const notice = isError && total === 0 ? t('Couldn\'t load torrents. Check the connection to qBittorrent.')
    : total === 0 ? t('No torrents yet. Add one with the + button.')
    : null
  if (notice) {
    return (
      <div className="space-y-4">
        {header}
        <p className="py-8 text-center text-sm text-muted-foreground">{notice}</p>
        {addDialog}
      </div>
    )
  }

  const hasPanelFilters = !!list.filters.name.trim() || list.filters.status !== 'all' || !!list.filters.category || !!list.filters.tag || !!list.filters.tracker
  const matchingSelected = list.matching.filter(t => selection.selected.has(t.hash)).length

  return (
    <div className="space-y-4">
      {header}

      <FilterViewChips list={list} views={views} onViewsChange={setViews} />

      <ColumnFilterChips
        targets={[...filterTargets.values()]}
        filters={list.filters.columns ?? {}}
        onChange={list.setColumnFilter}
        // Added from the filter panel's funnel button, and in the table from the column titles too.
        showAdd={false}
        start={!filtersOpen && hasPanelFilters && <ListFilterChips list={list} />}
      />

      {filtersOpen && (
        <TorrentFilterPanel
          list={list}
          categories={Object.keys(categories ?? {})}
          tags={tags ?? []}
          views={views}
          onViewsChange={setViews}
          actions={(
            <>
              <Button type="button" variant="outline" size="icon" className="size-8 shrink-0" aria-label={t('Categories and tags')} title={t('Categories and tags')} onClick={() => setManageOpen(true)}>
                <FolderCog className="size-4" />
              </Button>
              <AddFilterButton targets={[...filterTargets.values()]} onChange={list.setColumnFilter} />
              <Button type="button" variant="ghost" size="icon" className="ms-auto size-8 shrink-0 rounded-full bg-muted hover:bg-accent" aria-label={t('Close filters')} title={t('Close filters')} onClick={() => setFiltersOpen(false)}>
                <X className="size-4" />
              </Button>
            </>
          )}
        />
      )}

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
          columnFilters={list.filters.columns ?? {}}
          filterTargets={filterTargets}
          onColumnFilter={list.setColumnFilter}
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
              <Button variant="outline" size="sm" aria-label={t('Previous page')} disabled={list.page === 1} onClick={() => list.setPage(list.page - 1)}><ChevronLeft className="size-4 rtl:rotate-180" /></Button>
              <span className="text-sm tabular-nums">{list.page} / {list.pageCount}</span>
              <Button variant="outline" size="sm" aria-label={t('Next page')} disabled={list.page === list.pageCount} onClick={() => list.setPage(list.page + 1)}><ChevronRight className="size-4 rtl:rotate-180" /></Button>
            </div>
          )}
        </div>
      )}

      {/* Keeps the last cards clear of the selection bar on phones. */}
      {count > 0 && <div aria-hidden className="h-[calc(3.5rem+var(--table-scrollbar-space,0px))] md:hidden" />}

      <DeleteTorrentsDialog key={deleteRequest.id} torrents={deleteRequest.torrents} open={deleteOpen} onOpenChange={setDeleteOpen} onConfirm={confirmDelete} />
      <BulkPromptDialog torrents={selectedTorrents} prompt={prompt} onClose={() => setPrompt(null)} />
      <ActionBarDialog kind={barKind} open={barDialogOpen} onOpenChange={setBarDialogOpen} groups={groups} pinned={barActions} onChange={changeBarActions} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      {addDialog}
      {manageOpen && <CategoriesTagsDialog open onOpenChange={setManageOpen} />}
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
