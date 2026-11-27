import { useCallback, useEffect, useLayoutEffect, useEffectEvent, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type ReactElement } from 'react'
import { Button } from '@/components/ui/button'
import { Pause, Play, Trash2 } from 'lucide-react'
import { Tooltip } from '@/components/ui/tooltip'
import { altKey, withKeys } from '@/lib/shortcutKeys'
import { cn } from '@/lib/utils'
import { PageBoundary } from '@/components/PageBoundary'
import { PageHeader } from '@/components/PageHeader'
import { useCategories, useDeleteTorrents, usePauseTorrents, useResumeTorrents, useSessionPausedWarning, useTags, useTorrents, useTrackerMap } from '@/hooks/useApi'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useRowPress, type RowProps } from '@/hooks/useRowPress'
import { revealRow } from '@/hooks/useRowWindow'
import { useSelection } from '@/hooks/useSelection'
import { useTorrentList } from '@/hooks/useTorrentList'
import { forget, useRemembered } from '@/hooks/useRemembered'
import { useGrowingList } from '@/hooks/useGrowingList'
import { chosenCount, SIDEBAR_COLUMNS } from '@/lib/torrentFilters'
import { loadFilterViews, type FilterView } from '@/lib/filterViews'
import { announce } from '@/lib/announce'
import { pageScroller, ROOM_FOR_HEADER_SEARCH, ROOM_FOR_SIDEBAR, WIDE } from '@/lib/pageScroll'
import { loadBarActions, saveBarActions } from '@/lib/actionBar'
import { toast } from '@/hooks/use-toast'
import { getColumn, loadColumnLayout, saveColumnLayout, TORRENT_FILTER_COLUMNS, type ColumnLayout } from '@/lib/torrentColumns'
import { choiceOptions, NONE } from '@/lib/columnFilters'
import { type FilterTarget } from '@/components/ColumnFilters'
import type { Torrent } from '@/types'
import { ACTION_KEYS, actionKeyName, useBulkActions, type BulkPrompt } from './bulkActions'
import { BulkPromptDialog } from './BulkPromptDialog'
import { ActionBarDialog } from './ActionBarDialog'
import { DeleteTorrentsDialog } from './DeleteTorrentsDialog'
import { TorrentCards } from './TorrentCards'
import { viewLabel } from '@/lib/listSettings'
import { FilterChoices, FilterSidebar } from './TorrentFilterPanel'
import { FilterSheet } from '@/components/FilterSidebarParts'
import { useMarkedTorrents } from '@/hooks/useTrackerIssues'
import { MoreMenu, TorrentContextMenu } from './TorrentMenus'
import { SelectionBar } from './SelectionBar'
import { useListShortcuts } from '@/hooks/useListShortcuts'
import { ShortcutsDialog } from './ShortcutsDialog'
import { TorrentTable } from './TorrentTable'
// Loaded with the list rather than on first use, so the details and dialogs open at once.
import { AddTorrentDialog } from './AddTorrentView'
import { DETAILS_MEMORY, TorrentDetailsPanel } from './TorrentDetails'
import { TorrentDetailsDialog } from './TorrentDetailsSheet'
import { AddTorrentButton, QuickSearchField, TorrentToolbar } from './TorrentToolbar'
import { t } from '@/i18n'


const EMPTY: Torrent[] = []

export function TorrentsView() {
  const { data: torrents = EMPTY, isLoading, isError } = useTorrents()
  const { data: trackerMap } = useTrackerMap()
  const { data: categories } = useCategories()
  const { data: tags } = useTags()
  // Marked with what their trackers say, for the Unregistered and Tracker down statuses.
  const marked = useMarkedTorrents(torrents)
  const list = useTorrentList(marked, trackerMap)
  const pause = usePauseTorrents()
  const resume = useResumeTorrents()
  const warnIfPaused = useSessionPausedWarning()
  const remove = useDeleteTorrents()
  const wide = useMediaQuery(WIDE)
  // The filters beside the list, and the quick search in the header, wherever they fit.
  const sideBySide = useMediaQuery(ROOM_FOR_SIDEBAR)
  const headerSearch = useMediaQuery(ROOM_FOR_HEADER_SEARCH)
  // In the frame (wide), only the list scrolls; elsewhere the window does.
  const framed = wide
  // Outside the frame the table fills the screen and scrolls on its own, so the page starts at its
  // top: the cards' scroll would otherwise leave the column titles above the screen.
  useEffect(() => { if (!framed && list.showTable) pageScroller().scrollTo(0, 0) }, [framed, list.showTable])
  const mouse = useMediaQuery('(pointer: fine)')

  // Kept while another page shows, with the open details and filters (useRemembered).
  const selection = useSelection(list.matching.map(t => t.hash), 'torrents.selected')
  // The table draws only the rows in view; the cards draw in batches as the list scrolls.
  const growing = useGrowingList(list.matching, list.restarts)
  const rows = list.showTable ? list.matching : growing.shown
  const [filtersOpen, setFiltersOpen] = useRemembered('torrents.filtersOpen', false)
  // The search bar over the list on phones.
  const [searchOpen, setSearchOpen] = useRemembered('torrents.searchOpen', false)
  const [detailsHash, setDetailsHash] = useRemembered<string | null>('torrents.details', null)
  // Closed details open next time at medium height, not maximized.
  useEffect(() => { if (!detailsHash) forget(...DETAILS_MEMORY) }, [detailsHash])
  const [columns, setColumns] = useState<ColumnLayout>(loadColumnLayout)
  // A new id for each request starts the delete dialog fresh.
  const [deleteRequest, setDeleteRequest] = useState<{ id: number; torrents: Torrent[] }>({ id: 0, torrents: [] })
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [prompt, setPrompt] = useState<BulkPrompt | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  // The list's column, which the phone filter sheet lines up with.
  const [listColumn, setListColumn] = useState<HTMLDivElement | null>(null)
  // The details panel lines up with the list, leaving the same room at its sides as the table,
  // and not covering the filters beside it. Measured from the window's edges.
  const [listEdges, setListEdges] = useState<{ start: number; end: number; top: number }>()
  useLayoutEffect(() => {
    if (!wide || !listColumn) return
    const measure = () => {
      const box = listColumn.getBoundingClientRect()
      const fromLeft = Math.round(box.left)
      const fromRight = Math.round(document.documentElement.clientWidth - box.right)
      const rtl = getComputedStyle(listColumn).direction === 'rtl'
      setListEdges(current => {
        const top = Math.round(box.top)
        const next = rtl ? { start: fromRight, end: fromLeft, top } : { start: fromLeft, end: fromRight, top }
        return current?.start === next.start && current.end === next.end && current.top === next.top ? current : next
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(listColumn)
    addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      removeEventListener('resize', measure)
    }
  }, [wide, listColumn, filtersOpen])
  const [addOpen, setAddOpen] = useState(false)
  const [views, setViews] = useState<FilterView[]>(loadFilterViews)
  // The row that Tab reaches and the arrow keys move from.
  const [focusHash, setFocusHash] = useRemembered<string | null>('torrents.focus', null)

  // Looked up on every refresh, so open details stay current. Torrents deleted elsewhere drop out.
  // A search or filter that hides the open torrent closes its details, so they never show a
  // torrent that isn't in the list. Done while drawing, so they don't show for a moment first.
  if (detailsHash && !list.matching.some(t => t.hash === detailsHash)) setDetailsHash(null)
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
  // Below wide screens the selection bar goes into the header where it fits, or else above the
  // bottom edge, where the table's scrollbar moves up above it.
  const [barWidth, setBarWidth] = useState<number>()
  const [barInHeader, setBarInHeader] = useState(false)
  const phoneBar = count > 0 && !wide && !barInHeader
  useEffect(() => {
    if (!phoneBar) return
    const root = document.documentElement.style
    root.setProperty('--selection-bar-space', 'calc(2.75rem + 0.5rem)')
    return () => { root.removeProperty('--selection-bar-space') }
  }, [phoneBar])
  const entries = groups.flatMap(group => group.entries)
  const pinnedEntries = barActions.flatMap(id => entries.filter(entry => entry.id === id))
  const closeDetails = useCallback(() => setDetailsHash(null), [])
  // Details in the menus opens the torrent's details, or closes them again.
  const toggleDetails = (torrent: Torrent) => setDetailsHash(current => (current === torrent.hash ? null : torrent.hash))

  // What each column's filter needs. A choice offers the values the torrents have, whatever
  // the other filters show, with what the empty value means for that column.
  const filterTargets = useMemo(() => {
    const none: Record<string, string> = { category: t('No category'), tags: t('No tags'), tracker: t('No tracker') }
    // Columns the sidebar covers are filtered there only.
    return new Map(TORRENT_FILTER_COLUMNS.filter(column => !(column.id in SIDEBAR_COLUMNS)).map((column): [string, FilterTarget] => [column.id, {
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
    announce(viewLabel(list.shown))
  }, [list.shown])
  // An Effect Event reads the count as it is when the timer fires, without restarting the timer.
  const matchingLength = list.matching.length
  const announceMatches = useEffectEvent(() => {
    const n = matchingLength
    announce(n === 0 ? t('No torrents match these filters') : n === 1 ? t('1 torrent') : t('{count} torrents', { count: n }))
  })
  const { name: filterName, statuses: filterStatuses, categories: filterCategories, tags: filterTags, trackers: filterTrackers } = list.filters
  const filtersMounted = useRef(false)
  useEffect(() => {
    if (!filtersMounted.current) { filtersMounted.current = true; return }
    const timer = setTimeout(announceMatches, 800)
    return () => clearTimeout(timer)
  }, [filterName, filterStatuses, filterCategories, filterTags, filterTrackers])

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
      // Wide screens act on a finger's tap as on a click, so a tap on a tablet selects the row too.
      if (touch && !wide) {
        // After a long press has started selecting, taps add and remove instead of opening. A
        // tap on the torrent whose details are open closes them, as a click does on desktop.
        if (count > 0) selection.toggle(hash)
        else if (detailsHash === hash) closeDetails()
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
  const tabStop = rows.some(t => t.hash === focusHash) ? focusHash : rows[0]?.hash
  const onRowKey = (event: ReactKeyboardEvent<HTMLElement>, torrent: Torrent) => {
    if (event.target !== event.currentTarget) return
    const index = rows.findIndex(t => t.hash === torrent.hash)
    const moves: Record<string, number> = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: list.matching.length - 1 }
    if (event.key in moves) {
      event.preventDefault()
      const target = Math.max(0, Math.min(list.matching.length - 1, moves[event.key]))
      if (!list.showTable) growing.showUpTo(target)
      const next = list.matching[target]
      if (!next) return
      // A long list may not have drawn that row yet (Home, End).
      revealRow(target, next.hash, row => row.focus())
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
    <TorrentContextMenu torrents={selectedTorrents} groups={groups} onDetails={toggleDetails} detailsHash={detailsHash} onStart={start} onStop={stop} onDelete={() => askToDelete(selectedTorrents)}>
      {target}
    </TorrentContextMenu>
  )

  useListShortcuts({
    hasSelection: count > 0,
    selectAll: () => selection.replace(list.matching.map(t => t.hash)),
    selectNone: selection.clear,
    invertSelection: () => selection.replace(list.matching.filter(t => !selection.selected.has(t.hash)).map(t => t.hash)),
    start,
    stop,
    add: () => setAddOpen(true),
    deleteSelection: () => askToDelete(selectedTorrents),
    escape: () => (detailsHash ? closeDetails() : selection.clear()),
    search: () => {
      const field = document.getElementById('torrent-search')
      if (field) field.focus()
      else setSearchOpen(true)
    },
    showShortcuts: () => setShortcutsOpen(true),
    toggleFilters: () => setFiltersOpen(open => !open),
    toggleView: list.switchView,
    runAction: (code) => {
      const name = actionKeyName(code)
      const entry = name ? entries.find(entry => ACTION_KEYS[entry.id] === name && !entry.disabled) : undefined
      entry?.onSelect()
      return !!entry
    },
  })

  const matchingSelected = list.matching.filter(t => selection.selected.has(t.hash)).length
  const selectionBar = (inHeader: boolean, centered: boolean) => count > 0 && (
    <SelectionBar
      label={t('Selected torrents')}
      inHeader={inHeader}
      centered={centered}
      onWidth={setBarWidth}
      onPlace={setBarInHeader}
      count={count}
      total={list.matching.length}
      pinned={pinnedEntries}
      leading={(
        <>
          <Tooltip label={withKeys(t('Start'), altKey('S'))}>
            <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={t('Start')} onClick={start}><Play className="size-4" /></Button>
          </Tooltip>
          <Tooltip label={withKeys(t('Stop'), altKey('P'))}>
            <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={t('Stop')} onClick={stop}><Pause className="size-4" /></Button>
          </Tooltip>
        </>
      )}
      trailing={(
        <>
          <MoreMenu torrents={selectedTorrents} groups={groups} onDetails={toggleDetails} detailsHash={detailsHash} onStart={start} onStop={stop} onDelete={() => askToDelete(selectedTorrents)} onCustomize={() => setBarDialogOpen(true)} cards={list.showTable ? undefined : { onSelectAll: matchingSelected < list.matching.length ? () => selection.replace(list.matching.map(t => t.hash)) : undefined, onClear: selection.clear }} />
          <Tooltip label={withKeys(t('Delete'), `${altKey('D')}, Del`)}>
            <Button variant="ghost" size="icon" className="size-8 shrink-0 text-destructive hover:text-destructive" aria-label={t('Delete')} onClick={() => askToDelete(selectedTorrents)}><Trash2 className="size-4" /></Button>
          </Tooltip>
        </>
      )}
    />
  )

  const total = torrents.length
  const header = (
    <PageHeader
      // The title opens the connection status and statistics.
      title={t('Torrents')}
      middle={selectionBar}
      middleWidth={barWidth}
      actions={total > 0
        ? <TorrentToolbar list={list} filtersOpen={filtersOpen} onToggleFilters={() => setFiltersOpen(open => !open)} searchOpen={searchOpen} onSearchOpenChange={setSearchOpen} columns={columns} onColumnsChange={changeColumns} onAdd={() => setAddOpen(true)} />
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

  const sidebar = (
    <FilterSidebar
      list={list}
      torrents={torrents}
      categories={categories ?? {}}
      tags={tags ?? []}
      views={views}
      onViewsChange={setViews}
      columnTargets={[...filterTargets.values()]}
    />
  )



  return (
    // In the frame (wide screens) the page fills the window above the details panel: only the
    // table or cards scroll, and the sidebar beside them on its own. Phones scroll the whole page.
    <div className="flex flex-col gap-4 frame:h-full">
      {header}

      {/* The filters open on the list's end side: beside it where it fits, over it on phones. */}
      <div className={cn('frame:flex frame:min-h-0 frame:flex-1', filtersOpen && sideBySide && 'flex items-start gap-4 frame:items-stretch')}>
        {!sideBySide && <FilterSheet open={filtersOpen} onOpenChange={setFiltersOpen} list={listColumn}>{sidebar}</FilterSheet>}
        {/* Above the docked details: the table ends 16px above them, with its own frame; cards run
            on under their top edge as far as its rounded corners, so a card cut off there still
            shows its border in the corners, without a gap. */}
        <div ref={setListColumn} className={cn('flex min-w-0 flex-1 flex-col gap-4 frame:min-h-0', list.showTable ? 'frame:pb-(--details-room)' : 'frame:pb-[max(calc(var(--details-room,0px)-1rem-var(--radius-xl)),0px)]')}>
          {searchOpen && !headerSearch && <QuickSearchField list={list} wide={false} onClose={() => setSearchOpen(false)} />}

        {list.matching.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
            <span>{t('No torrents match these filters')}</span>
            <Button variant="outline" size="sm" onClick={list.clearFilters}>{t('Clear filters')}</Button>
          </div>
        ) : list.showTable ? (
          <TorrentTable
            torrents={rows}
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
            sortShown={list.sortShown}
            onSort={list.sortBy}
            rowProps={rowProps}
            wrapBody={withMenu}
            columnFilters={list.filters.columns ?? {}}
            filterTargets={filterTargets}
            compact={list.compact}
            sidebarFilter={{
              has: (id) => id in SIDEBAR_COLUMNS,
              active: (id) => chosenCount(list.filters, SIDEBAR_COLUMNS[id]) > 0,
              choices: (id) => <FilterChoices list={list} listKey={SIDEBAR_COLUMNS[id]} categories={categories ?? {}} tags={tags ?? []} />,
            }}
            onColumnFilter={list.setColumnFilter}
          />
        ) : (
          // Scrolled on their own in the frame, with room for a card's focus ring. Placed, so the
          // cards' hidden labels are placed in it, not in the page, which they'd make scroll.
          // Below the last card, room for Safari's toolbar, which grows at the end of the page. In the
          // frame the box reaches 4px past the column for the cards' focus rings, but is cut off
          // level with the filters sidebar, with room inside so the last card's border shows.
          // With the details docked, the last card scrolls up clear of their corners.
          <div className={cn('relative mb-[var(--toolbar-room,0px)] frame:-m-1 frame:min-h-0 frame:overflow-y-auto frame:p-1 frame:pb-2 frame:[clip-path:inset(0_0_4px_0)]', wide && detailsTorrent && 'frame:pb-[calc(0.5rem+var(--radius-xl))]')}>
            <TorrentCards
              torrents={rows}
              selected={selection.selected}
              showCheckboxes={mouse || count > 0}
              onToggle={toggleBox}
              openHash={detailsTorrent ? detailsTorrent.hash : null}
              rowProps={rowProps}
              wrapList={withMenu}
            />
            {growing.endMarker}
          </div>
        )}

        </div>
        {filtersOpen && sideBySide && (
          <aside aria-label={t('Filters')} className="sticky top-0 max-h-[calc(100dvh-var(--header-height,3rem)-2rem)] w-72 shrink-0 overflow-y-auto rounded-xl border bg-card p-3 window-scroll:top-[calc(var(--header-height,3rem)+1rem)] window-scroll:max-h-[calc(100dvh-var(--header-height,3rem)-var(--bottom-nav-height,0px)-2rem)]">
            {/* Sticks at the top of the scrolling area, whose own padding already leaves the gap; an
                offset would add to it and push the sidebar below what's beside it. Where the window
                scrolls, it sticks below the header, which lies over the page. */}
            {sidebar}
          </aside>
        )}
      </div>


      {/* Keeps the last cards clear of the selection bar at the bottom; the table goes under it. */}
      {phoneBar && !list.showTable && <div aria-hidden className="h-14" />}

      <DeleteTorrentsDialog key={deleteRequest.id} torrents={deleteRequest.torrents} open={deleteOpen} onOpenChange={setDeleteOpen} onConfirm={confirmDelete} />
      <BulkPromptDialog torrents={selectedTorrents} prompt={prompt} onClose={() => setPrompt(null)} />
      <ActionBarDialog kind={barKind} open={barDialogOpen} onOpenChange={setBarDialogOpen} groups={groups} pinned={barActions} onChange={changeBarActions} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      {addDialog}
      {detailsTorrent && (
        <PageBoundary loading={null}>
          {wide
            ? <TorrentDetailsPanel torrent={detailsTorrent} onClose={closeDetails} onDelete={() => askToDelete([detailsTorrent])} edges={listEdges} />
            : <TorrentDetailsDialog torrent={detailsTorrent} onClose={closeDetails} onDelete={() => askToDelete([detailsTorrent])} />}
        </PageBoundary>
      )}
    </div>
  )
}
