import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type HTMLAttributes, type PointerEvent, type ReactNode, type RefObject } from 'react'
import { FolderTree, Info, RadioTower, SlidersHorizontal, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePrefetchDetails } from '@/hooks/useApi'
import { holdCursor } from '@/lib/dragCursor'
import { isRemembered, useRemembered } from '@/hooks/useRemembered'
import { PAGE_SCROLL_ID } from '@/lib/pageScroll'
import { watchTorrentSpeeds } from '@/lib/speedHistory'
import { cn } from '@/lib/utils'
import { textWidth } from '@/components/TableColumns'
import { textScale } from '@/lib/textSize'
import type { Torrent } from '@/types'
import { PeersTab } from './PeersTab'
import { TorrentActions } from './TorrentActions'
import { TorrentContentTab } from './TorrentContentTab'
import { TorrentInfoTab } from './TorrentInfoTab'
import { TrackersTab } from './TrackersTab'
import { keepOpenForNotices } from '@/lib/notices'
import { t } from '@/i18n'

const TABS = [
  { id: 'details', get label() { return t('Details') }, icon: Info },
  { id: 'actions', get label() { return t('Actions') }, icon: SlidersHorizontal },
  { id: 'content', get label() { return t('Content') }, icon: FolderTree },
  { id: 'peers', get label() { return t('Peers') }, icon: Users },
  { id: 'trackers', get label() { return t('Trackers') }, icon: RadioTower },
] as const

type TabId = (typeof TABS)[number]['id']
const isTabId = (value: string | null): value is TabId => TABS.some(tab => tab.id === value)
const MIN_HEIGHT = 160
// The list keeps at least this much of the window.
const LIST_ROOM = 200

const clampHeight = (height: number) => Math.round(Math.max(MIN_HEIGHT, Math.min(height, window.innerHeight - LIST_ROOM)))

// How far down the details first open: to just below Export .torrent (marked
// data-details-reach), so the torrent's name, paths and magnet link show without scrolling. From
// the top of the panel or sheet, with room for the padding below it. With another tab open, the
// Details tab is drawn unseen to measure it (DetailsTabs' `probe`), from its own top, and the
// open tab's top is added; the result is kept.
let detailsReach: number | undefined
function measureReach(box: HTMLElement | null): number | undefined {
  // The shown one: phones place it below the magnet link, wider screens beside it.
  const mark = [...box?.querySelectorAll('[data-details-reach]') ?? []].find(element => element.getBoundingClientRect().height > 0)
  const panel = mark?.closest('[role=tabpanel]')
  // Where the open tab's contents start; the unseen Details tab starts there too.
  const open = box?.querySelector('[role=tabpanel][data-state=active]')
  if (box && mark && panel && open) {
    detailsReach = Math.ceil(mark.getBoundingClientRect().bottom - panel.getBoundingClientRect().top + open.getBoundingClientRect().top - box.getBoundingClientRect().top) + 16
  }
  return detailsReach
}

// Whether the details fill the screen: kept while another page shows, forgotten when they close
// (TorrentsView), so they never open maximized. Their tab and height are kept until a reload.
export const DETAILS_MEMORY = ['details.full', 'details.detent']

const initialHeight = () => clampHeight(detailsReach ?? window.innerHeight * 0.4)

// Everything about one torrent. The open tab is remembered, also for the next time details open,
// and each tab's key is the hash, so its content starts fresh for another torrent.
// `end` sits at the end of the tabs' row, for the close button.
// On phones the open tab is as wide as the longest tab name needs (12px text, the 14px icon and its
// 4px gap, 8px padding each side, a margin), so the others share the rest of the bar evenly and keep
// their width whichever tab is open.
const openTabWidth = () => Math.ceil(Math.max(...TABS.map(tab => textWidth(tab.label, 12 * textScale()))) + 14 + 4 + 16 + 4)

function DetailsTabs({ torrent, listClassName, barClassName, barProps, end, onDelete }: { torrent: Torrent; listClassName?: string; barClassName?: string; barProps?: HTMLAttributes<HTMLDivElement>; end?: ReactNode; onDelete?: () => void }) {
  // Its speeds are recorded while the details are open, whichever tab shows, for the Details graph.
  useEffect(() => watchTorrentSpeeds(torrent.hash), [torrent.hash])
  usePrefetchDetails(torrent.hash)
  // On the Details tab when the app is first opened; after that the tab last picked, until a reload.
  const [tab, setTab] = useRemembered<TabId>('details.tab', 'details')
  // Drawn until the first measure (see measureReach); the panel or sheet draws again with the
  // measured height, which lets it go.
  const probe = detailsReach === undefined
  const choose = (value: string) => {
    if (!isTabId(value)) return
    setTab(value)
  }
  return (
    <Tabs value={tab} onValueChange={choose} className="relative min-h-0 flex-1">
      {/* The tabs take the row's whole width, apart from a gap before the close button. */}
      <div data-sheet-bar {...barProps} className={cn('flex items-center gap-3', barClassName)}>
        <TabsList className={cn('flex min-w-0 flex-1', listClassName)} style={{ '--open-tab': `${openTabWidth()}px` } as CSSProperties}>
          {/* Icons and names where there's room. On phones five names don't fit in every language,
              so the tabs show their icons and the open one its name too; the others' names are
              still read out. There the open tab has one width for every tab, and the others share
              the rest of the bar, which always reaches the close button: nothing changes size on a
              switch. */}
          {TABS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id} className="gap-1 px-2 text-xs max-sm:data-[state=active]:w-(--open-tab) max-sm:data-[state=active]:flex-none sm:px-3">
              <Icon className="size-3.5" />
              <span className="max-sm:in-data-[state=inactive]:sr-only">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {end && <div className="ms-auto shrink-0">{end}</div>}
      </div>
      {/* Until the opening height is known, the Details tab is also drawn unseen behind another
          open tab, to measure it. */}
      <TabsContent
        value="details"
        forceMount={probe || undefined}
        className="overflow-y-auto pb-(--details-end,0px) data-[state=inactive]:pointer-events-none data-[state=inactive]:invisible data-[state=inactive]:absolute data-[state=inactive]:inset-x-0"
      ><TorrentInfoTab torrent={torrent} /></TabsContent>
      <TabsContent value="content" className="flex min-h-0 flex-col overflow-hidden"><TorrentContentTab key={torrent.hash} hash={torrent.hash} savePath={torrent.save_path} /></TabsContent>
      <TabsContent value="actions" className="overflow-y-auto pb-(--details-end,0px)"><TorrentActions key={torrent.hash} torrent={torrent} onDelete={onDelete} /></TabsContent>
      <TabsContent value="trackers" className="overflow-y-auto pb-(--details-end,0px)"><TrackersTab key={torrent.hash} hash={torrent.hash} /></TabsContent>
      <TabsContent value="peers" className="overflow-y-auto pb-(--details-end,0px)"><PeersTab key={torrent.hash} hash={torrent.hash} /></TabsContent>
    </Tabs>
  )
}

interface DetailsProps {
  torrent: Torrent
  onClose: () => void
  // Asks to delete the torrent, from the Actions tab.
  onDelete?: () => void
}

interface PanelProps extends DetailsProps {
  // How far from the window's edges the panel starts and ends: where the list does, so it has
  // the table's room at its sides and leaves the filters beside it in view. Maximized, it reaches
  // up to the list's top.
  edges?: { start: number; end: number; top: number }
}

// Wide screens: a panel along the bottom of the window, below the list, with an edge to drag
// for its height. Picking another torrent in the list shows that one instead.
export function TorrentDetailsPanel({ torrent, onClose, onDelete, edges }: PanelProps) {
  const [height, setHeight] = useRemembered('details.height', initialHeight)
  // Once it has a height (measured or dragged), it keeps it until a reload.
  const [heightKept] = useState(() => isRemembered('details.height'))
  // First it opens to just below Export .torrent; a height dragged to lasts until a reload. When
  // the window changes size, the height is kept within it.
  useLayoutEffect(() => {
    const reach = heightKept ? undefined : measureReach(section.current)
    if (reach !== undefined) setHeight(clampHeight(reach))
    const keepInside = () => setHeight(current => clampHeight(current))
    window.addEventListener('resize', keepInside)
    return () => window.removeEventListener('resize', keepInside)
  }, [])
  const drag = useRef<{ y: number; height: number; wasFull: boolean; moved: boolean; raw: number } | null>(null)
  const release = useRef<(() => void) | null>(null)
  // Maximized, the panel covers the whole list, from its top down. As on phones, a click on its
  // pill, or dragging it to the top, maximizes it; a click or a drag down steps back.
  const [full, setFull] = useRemembered('details.full', false)
  const section = useRef<HTMLElement>(null)
  // Dragged below its lowest height, it slides down with the pointer, showing it will close.
  const [sink, setSink] = useState(0)


  const commit = (next: number) => {
    const clamped = clampHeight(next)
    setHeight(clamped)
  }
  const beginDrag = (y: number) => {
    // Maximized, a drag starts from the height it has on screen.
    const start = full ? clampHeight(section.current?.offsetHeight ?? height) : height
    drag.current = { y, height: start, wasFull: full, moved: false, raw: start }
    release.current = holdCursor('row-resize')
  }
  const startDrag = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    beginDrag(e.clientY)
  }
  // On a tablet, a finger moving up or down on the tab row drags the panel as the pill does, as
  // on phones; a tap still picks a tab. Not with a mouse, where pressing a tab picks it.
  const barTouch = useRef<{ x: number; y: number; id: number } | null>(null)
  const barProps: HTMLAttributes<HTMLDivElement> = {
    onPointerDown: (e) => { barTouch.current = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY, id: e.pointerId } },
    onPointerMove: (e) => {
      const touch = barTouch.current
      if (!touch || touch.id !== e.pointerId) return
      if (!drag.current) {
        const dx = e.clientX - touch.x, dy = e.clientY - touch.y
        if (Math.abs(dy) < 6 || Math.abs(dy) < Math.abs(dx)) return
        e.currentTarget.setPointerCapture(e.pointerId)
        beginDrag(touch.y)
      }
      moveDrag(e)
    },
    onPointerUp: () => { if (barTouch.current && drag.current) endDrag(); barTouch.current = null },
    onPointerCancel: () => { if (barTouch.current && drag.current) endDrag(); barTouch.current = null },
  }
  const moveDrag = (e: { clientY: number }) => {
    const current = drag.current
    if (!current) return
    const moved = current.y - e.clientY
    // A few pixels still count as a click.
    if (!current.moved && Math.abs(moved) < 4) return
    current.moved = true
    current.raw = current.height + moved
    if (full) setFull(false)
    setHeight(clampHeight(current.raw))
    setSink(Math.max(0, MIN_HEIGHT - current.raw))
  }
  const endDrag = () => {
    const current = drag.current
    drag.current = null
    release.current?.()
    release.current = null
    if (!current) return
    setSink(0)
    if (!current.moved) return setFull(!current.wasFull)
    // Dragged past the highest it goes, it maximizes, keeping its height for stepping back.
    if (current.raw >= window.innerHeight - LIST_ROOM) return setFull(true)
    // Dragged on down well past the lowest it goes, it closes, as on phones, keeping its height.
    if (current.raw < MIN_HEIGHT - 60) return onClose()
    commit(current.raw)
  }
  const onEdgeKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      return setFull(!full)
    }
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    setFull(false)
    commit(height + (e.key === 'ArrowUp' ? 32 : -32))
  }

  // Maximized, the list behind it is hidden, so nothing of it (like a selected card's ring, just
  // outside the card) shows at the panel's sides. Dragged down, it shows again.
  useLayoutEffect(() => {
    if (!full) return
    const root = document.documentElement
    root.dataset.detailsCover = ''
    return () => { delete root.dataset.detailsCover }
  }, [full])

  // In the frame the table ends 16px above the panel (--details-room), as it does beside the
  // filters; cards go under its top edge only as far as its rounded corners (TorrentsView).
  useLayoutEffect(() => {
    // Maximized, it lies over the list, which keeps its place behind it.
    if (!edges || full) return
    const root = document.documentElement
    // While it slides down to close, the list grows behind it, so no torrents are cut off.
    root.style.setProperty('--details-room', `${Math.max(height + 16 - sink, 0)}px`)
    return () => { root.style.removeProperty('--details-room') }
  }, [edges, height, full, sink])

  return (
    <>
      {/* Room at the end of the page, so the last rows can scroll above the panel. Not in the
          frame, where the list makes room for it (--details-room). */}
      <div aria-hidden className="frame:hidden" style={{ height }} />
      <section
        aria-label={t('Torrent details')}
        data-keeps-swipes
        // Lined up with the list, it also ends 16px above the window's bottom, as the lists and the
        // filters sidebar do.
        ref={section}
        className={cn('fixed z-30 flex flex-col bg-card', edges ? 'bottom-4 overflow-hidden rounded-xl border' : 'bottom-0 border-t')}
        style={{ ...(full ? { top: edges ? `${edges.top}px` : 0 } : { height }), translate: sink ? `0 ${sink}px` : undefined, insetInlineStart: edges ? `${edges.start}px` : 'var(--sidebar-width, 0px)', insetInlineEnd: edges ? `${edges.end}px` : 'var(--page-scrollbar, 0px)' }}
      >
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label={t('Resize details')}
          aria-valuenow={height}
          tabIndex={0}
          title={t('Drag to resize')}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onEdgeKey}
          className="group flex h-3 shrink-0 cursor-row-resize touch-none items-center justify-center outline-hidden"
        >
          <span className="h-1 w-10 rounded-full bg-border group-hover:bg-primary/60 group-focus-visible:bg-primary" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 pb-3">
          {/* The name is in the Details tab's About; the tabs share their row with the close button. */}
          <h2 className="sr-only">{torrent.name}</h2>
          <DetailsTabs
            onDelete={onDelete}
            torrent={torrent}
            barProps={barProps}
            barClassName="touch-none"
            end={(
              <Button variant="ghost" size="icon" className="size-8 rounded-full bg-muted hover:bg-accent" aria-label={t('Close details')} title={t('Close (Esc)')} onClick={onClose}>
                <X className="size-4" />
              </Button>
            )}
          />
        </div>
      </section>
    </>
  )
}

// Phones: a sheet from the bottom, as in iOS. It opens at medium height, as wide as the page;
// dragging its handle up, or tapping it, gives the whole screen, and dragging it down (or the
// details, from their top) steps back or closes it. Esc closes it too. It
// doesn't hold the page: the torrents go on behind it, scroll, and a tap on another one shows
// that one's details. No shadow, the table's corners. Safari clips a fixed panel at its window's bottom edge, so only the maximized sheet,
// which is part of the page, scrolls on behind Safari's toolbar.
type Detent = 'medium' | 'large'
const DISMISS_DISTANCE = 90
// How far the medium sheet is dragged down before it closes: until its top passes the Hash row
// (marked data-details-close), so a pull to make it smaller doesn't close it by accident. Without
// that row on screen, 45% of the sheet's visible height.
function closeDistance(sheet: HTMLElement): number {
  const top = sheet.getBoundingClientRect().top
  const row = [...sheet.querySelectorAll('[data-details-close]')].map(element => element.getBoundingClientRect()).find(rect => rect.height > 0)
  if (row && row.bottom > top && row.bottom < window.innerHeight) return row.bottom - top
  return Math.max(DISMISS_DISTANCE, (window.innerHeight - top) * 0.45)
}
// How far the medium sheet can be dragged up and stay that size: until the Ratio row (marked
// data-details-grow) shows above its bottom edge. Dragged further, it maximizes. Without that row,
// until its top is 15% down the screen.
function growDistance(sheet: HTMLElement): number {
  const top = sheet.getBoundingClientRect().top
  const row = [...sheet.querySelectorAll('[data-details-grow]')].map(element => element.getBoundingClientRect()).find(rect => rect.height > 0)
  if (row) return Math.max(0, row.bottom + 16 - sheetBottomEdge())
  return Math.max(0, top - window.innerHeight * 0.15)
}
const FLICK_SPEED = 0.6 // px per ms

// A tap on the list switches the details; on a notification it leaves them open; elsewhere it
// closes them.
function keepOpenForList(event: { target: EventTarget | null; preventDefault: () => void }) {
  if (event.target instanceof Element && event.target.closest('[data-list-edge]')) event.preventDefault()
  else keepOpenForNotices(event)
}

// Maximized, the details are the page: the list steps aside (index.css hides <main>), so the
// browser scrolls the details as it does the cards, under its own bars. Back at medium height the
// list returns where it was.
let listY = 0
function useDetailsPage(full: boolean) {
  useLayoutEffect(() => {
    if (!full) return
    const root = document.documentElement
    listY = window.scrollY
    root.dataset.detailsFull = ''
    window.scrollTo(0, 0)
    return () => {
      showListBehind(false)
      delete root.dataset.detailsFull
      window.scrollTo(0, listY)
    }
  }, [full])
}

// While the medium sheet is open the list scrolls in its own box (<main>), not the window, where
// the page scrolls the window (phones, narrow windows). Safari hides and shows its toolbar only as
// the window scrolls, growing or shrinking the window; in an iPad window it then drew the cards
// below the sheet for a moment before the fixed sheet caught up. So the toolbar stays as it is.
// The list keeps its place, and the window takes over again when the sheet closes or maximizes.
function useListScrollsInPage(active: boolean) {
  useLayoutEffect(() => {
    const main = document.getElementById(PAGE_SCROLL_ID)
    if (!active || !main || getComputedStyle(main).overflowY === 'auto') return
    const root = document.documentElement
    const y = window.scrollY
    root.dataset.sheetScroll = ''
    main.scrollTop = y
    return () => {
      const top = main.scrollTop
      delete root.dataset.sheetScroll
      window.scrollTo(0, top)
    }
  }, [active])
}

// While the maximized details are dragged down, the list shows again behind them where it was
// left, moved by the window's scroll in the details, so nothing else moves.
function showListBehind(show: boolean) {
  const root = document.documentElement
  const main = document.querySelector('main')
  if (show) root.dataset.detailsPeek = ''
  else delete root.dataset.detailsPeek
  if (main) main.style.translate = show ? `0 ${window.scrollY - listY}px` : ''
}

// A finger pulling the details down where they can't scroll further up moves the sheet, as its
// handle does, from anywhere in it. Touch events, as only a cancelled first move keeps the list
// from scrolling (and, maximized, Safari from reloading the page). Sideways or upward moves scroll.
// At medium height the tab row moves the sheet up and down like the handle, and a move that
// nothing in the sheet can scroll goes nowhere, so the list behind never scrolls through it.
type SwipeCalls = { start: (y: number, time: number) => void; move: (y: number) => void; end: (e: { clientY: number; timeStamp: number }) => void }
function scrolledDown(target: EventTarget | null, sheet: HTMLElement, large: boolean) {
  if (large && window.scrollY > 0) return true
  for (let el = target instanceof Element ? target : null; el && el !== sheet; el = el.parentElement) {
    if (el.scrollTop > 0 && /auto|scroll/.test(getComputedStyle(el).overflowY)) return true
  }
  return false
}
function canScrollDown(target: EventTarget | null, sheet: HTMLElement) {
  for (let el = target instanceof Element ? target : null; el && el !== sheet; el = el.parentElement) {
    if (el.scrollTop + el.clientHeight < el.scrollHeight - 1 && /auto|scroll/.test(getComputedStyle(el).overflowY)) return true
  }
  return false
}
function useSwipeDown(sheet: RefObject<HTMLDivElement | null>, large: boolean, calls: SwipeCalls) {
  const latest = useRef(calls)
  useLayoutEffect(() => { latest.current = calls })
  // On the document: the sheet's portal draws it after this effect first runs.
  useEffect(() => {
    // 'pending' until the first move decides between pulling the sheet, scrolling, and (at
    // medium height) holding still.
    let state: 'off' | 'pending' | 'pulling' | 'held' = 'off'
    let x = 0, y = 0, time = 0
    let target: EventTarget | null = null
    let inBar = false
    const down = (e: TouchEvent) => {
      const touch = e.touches[0]
      const element = sheet.current
      if (!element || !(e.target instanceof Node) || !element.contains(e.target)) { state = 'off'; return }
      // The handle drags by itself; a second finger is a pinch.
      if (e.touches.length > 1 || !touch || (e.target instanceof Element && e.target.closest('[data-sheet-handle]'))) { state = 'off'; return }
      inBar = !large && e.target instanceof Element && !!e.target.closest('[data-sheet-bar]')
      target = e.target
      state = !inBar && large && scrolledDown(e.target, element, large) ? 'off' : 'pending'
      x = touch.clientX; y = touch.clientY; time = e.timeStamp
    }
    const move = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (state === 'off' || !touch) return
      if (state === 'pending') {
        const dx = touch.clientX - x, dy = touch.clientY - y
        if (!dx && !dy) return
        // In the tab row a tap may wobble a little before it lifts: still a tap, not a drag.
        if (inBar && Math.abs(dx) < 6 && Math.abs(dy) < 6) return e.preventDefault()
        const element = sheet.current
        const vertical = Math.abs(dy) >= Math.abs(dx)
        if (!element || !vertical) state = 'off'
        else if (inBar || (dy > 0 && !scrolledDown(target, element, large))) state = 'pulling'
        else if (!large && !(dy > 0 ? scrolledDown(target, element, large) : canScrollDown(target, element))) state = 'held'
        else state = 'off'
        if (state === 'pulling') latest.current.start(y, time)
        if (state === 'off') return
      }
      e.preventDefault()
      if (state === 'pulling') latest.current.move(touch.clientY)
    }
    const up = (e: TouchEvent) => {
      if (state === 'pulling') latest.current.end({ clientY: e.changedTouches[0]?.clientY ?? y, timeStamp: e.timeStamp })
      state = 'off'
    }
    document.addEventListener('touchstart', down, { passive: true })
    document.addEventListener('touchmove', move, { passive: false })
    document.addEventListener('touchend', up)
    document.addEventListener('touchcancel', up)
    return () => {
      document.removeEventListener('touchstart', down)
      document.removeEventListener('touchmove', move)
      document.removeEventListener('touchend', up)
      document.removeEventListener('touchcancel', up)
    }
  }, [sheet, large])
}

// The sheet's place at rest.
// At medium height it reaches down as far as the window can grow (100lvh), not to the window's
// current bottom: Safari in an iPad window grows the window when its toolbar hides, and a sheet
// held to the bottom edge then had to move, showing the cards below it for a moment. Its contents
// end above the window's current bottom (--details-end), so the last of them can still be seen.
function sheetStyle(large: boolean, top: number | undefined): CSSProperties {
  if (large || top === undefined) return { top: '', bottom: '', height: '', translate: '', willChange: '', '--details-end': '' } as CSSProperties
  return { top: `${top}px`, bottom: 'auto', height: `calc(100lvh - ${top}px - var(--sheet-bottom))`, translate: '', willChange: '', '--details-end': 'calc(100lvh - 100dvh)' } as CSSProperties
}

// Where the medium sheet's bottom is in the window as it is now: above the tab bar, if there is one.
function sheetBottomEdge(): number {
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;bottom:var(--sheet-bottom);height:0;visibility:hidden'
  document.body.append(probe)
  const edge = probe.getBoundingClientRect().top
  probe.remove()
  return edge
}

// While a finger drags it, the sheet only moves (translate), which the browser does without
// laying out the details again. For that the medium sheet is made as tall as the screen at the
// start, and moved down to where it was: dragged up, it shows more of itself from its bottom,
// so nothing shows below it. Maximized, it only moves down.
function dragStyle(large: boolean, from: number, offset: number): CSSProperties {
  if (large) return { translate: `0 ${Math.max(offset, 0)}px`, willChange: 'translate' }
  return { top: '0px', bottom: '', height: 'auto', translate: `0 ${Math.max(from + offset, 0)}px`, willChange: 'translate' }
}

// Where the medium sheet's top goes when there's nothing to reach (below): in the gap just above
// the third card, measured from the top of the page, so the first two cards show above it. Kept
// for the table view, which has no cards to measure; without either, the sheet is 62% of the
// screen.
let cardsTop: number | undefined
function measureSheetTop(): number | undefined {
  const third = document.querySelector('ul[data-list-edge] > li:nth-child(3)')
  if (third) cardsTop = third.getBoundingClientRect().top + window.scrollY - 4
  // Never so low that the sheet would be smaller than a third of the screen.
  return cardsTop !== undefined && cardsTop < window.innerHeight * 0.66 ? cardsTop : undefined
}

export function TorrentDetailsDialog({ torrent, onClose, onDelete }: DetailsProps) {
  const [detent, setDetent] = useRemembered<Detent>('details.detent', 'medium')
  const [sheetTop, setSheetTop] = useState(measureSheetTop)
  const drag = useRef<{ y: number; time: number; from: number; closeAt: number; growTo: number } | null>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const large = detent === 'large'
  // It opens to just below Export .torrent, measured before it's first drawn: when the portal
  // puts the sheet in the page, a step after this component's own effects. Its bottom edge is
  // where the window ends now (sheetBottomEdge), as the opening slide moves what the screen
  // shows. A long name may ask for more than there is: a quarter of the screen stays for the list
  // above it.
  // The window can change size while it's open (an iPhone Duo folded or unfolded, a phone turned,
  // Split View), so it measures again then: the old top would leave it too tall or too short.
  const fitToReach = useCallback((element: HTMLDivElement) => {
    const reach = measureReach(element)
    if (reach === undefined) return
    const bottom = sheetBottomEdge()
    setSheetTop(Math.round(Math.max(bottom - reach, window.innerHeight * 0.25)))
  }, [])
  const measured = useRef(false)
  const attachSheet = useCallback((element: HTMLDivElement | null) => {
    sheet.current = element
    if (!element || measured.current) return
    measured.current = true
    fitToReach(element)
  }, [fitToReach])
  useEffect(() => {
    let size = `${window.innerWidth}x${window.innerHeight}`
    const onResize = () => {
      // Safari's toolbar growing or shrinking changes only the height a little: not a new screen.
      const next = `${window.innerWidth}x${window.innerHeight}`
      const [width, height] = size.split('x').map(Number)
      if (window.innerWidth === width && Math.abs(window.innerHeight - height) < 100) return
      size = next
      if (sheet.current && !drag.current) fitToReach(sheet.current)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [fitToReach])


  // Closing slides the medium sheet down before it goes; maximized, it goes at once. It adds no
  // history entry: the browser's back and forward stay for moving between pages.
  const latest = useRef({ onClose, large })
  useLayoutEffect(() => { latest.current = { onClose, large } })
  const close = useCallback(() => {
    const element = sheet.current
    if (!element || latest.current.large) return latest.current.onClose()
    element.style.transition = 'translate 200ms ease-in'
    element.style.translate = '0 100%'
    window.setTimeout(() => latest.current.onClose(), 200)
  }, [])

  // While a finger drags the handle, the sheet follows it directly, without drawing the details
  // again on every move, which made it lag; it's drawn once more when the finger lifts.
  // Moves come faster than the screen draws; only the last one in each frame is applied.
  const frame = useRef(0)
  const follow = (offset?: number, top = sheetTop) => {
    const element = sheet.current
    cancelAnimationFrame(frame.current)
    if (!element) return
    if (offset === undefined) {
      element.style.transition = ''
      Object.assign(element.style, sheetStyle(large, top))
      return
    }
    // At medium height, dragged down past the Hash row, it closes at once, without waiting for
    // the finger to lift.
    if (!large && drag.current && offset > drag.current.closeAt) {
      drag.current = null
      return close()
    }
    const from = drag.current?.from ?? 0
    frame.current = requestAnimationFrame(() => Object.assign(element.style, dragStyle(large, from, offset)))
  }
  const begin = (y: number, time: number) => {
    const element = sheet.current
    if (!element) return
    drag.current = { y, time, from: element.getBoundingClientRect().top, closeAt: closeDistance(element), growTo: growDistance(element) }
    element.style.transition = 'none'
    if (large) showListBehind(true)
    Object.assign(element.style, dragStyle(large, drag.current.from, 0))
  }
  const cancelDrag = () => {
    drag.current = null
    if (large) showListBehind(false)
    follow()
  }
  const startDrag = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    begin(e.clientY, e.timeStamp)
  }
  const moveDrag = (e: PointerEvent<HTMLButtonElement>) => {
    if (drag.current) follow(e.clientY - drag.current.y)
  }
  const endDrag = (e: { clientY: number; timeStamp: number }) => {
    const start = drag.current
    drag.current = null
    if (!start) return
    cancelAnimationFrame(frame.current)
    const distance = e.clientY - start.y
    const speed = distance / Math.max(e.timeStamp - start.time, 1)
    const down = distance > DISMISS_DISTANCE || speed > FLICK_SPEED
    // Let go after a quick flick half way to the Hash row and it slides on down to close;
    // maximized and dragged less than about half the screen, it steps back to medium height.
    const closes = large ? down && distance >= window.innerHeight * 0.45 : distance > start.closeAt || (speed > FLICK_SPEED && distance > start.closeAt / 2)
    if (closes) return close()
    // At medium height it's resized freely between the Hash row (lower, it closed above) and the
    // Ratio row; let go higher than that, or flicked up, it maximizes.
    if (!large && Math.abs(distance) >= 6 && !(distance < 0 && (-distance > start.growTo || speed < -FLICK_SPEED))) {
      const top = Math.round(start.from + distance)
      follow(undefined, top)
      return setSheetTop(top)
    }
    // Staying maximized, the list hides again; going to medium height, the page puts it back.
    if (large && !down) showListBehind(false)
    follow()
    // A tap toggles between the heights, for anyone who doesn't drag.
    if (Math.abs(distance) < 6) setDetent(large ? 'medium' : 'large')
    // Medium, up past the Ratio row (the resizing above returned for less): maximized.
    else if (distance < (large ? -40 : 0) || speed < -FLICK_SPEED) setDetent('large')
    else if (down) setDetent('medium')
  }

  useListScrollsInPage(!large)
  useDetailsPage(large)
  // Back at medium height from the whole screen, the details start again at their top, not
  // where they were scrolled before.
  const wasLarge = useRef(large)
  useLayoutEffect(() => {
    if (wasLarge.current && !large) {
      sheet.current?.querySelectorAll('[role=tabpanel], .overflow-y-auto, .overflow-auto').forEach((box) => { box.scrollTop = 0 })
    }
    wasLarge.current = large
  }, [large])
  useSwipeDown(sheet, large, { start: begin, move: (y) => { if (drag.current) follow(y - drag.current.y) }, end: endDrag })
  // Maximized, the handle and the tabs stay at the top while the page scrolls under them.
  const pinned = large && 'sticky z-10 bg-card'
  return (
    <DialogPrimitive.Root open modal={false} onOpenChange={(open) => !open && close()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          ref={attachSheet}
          aria-describedby={undefined}
          onInteractOutside={keepOpenForList}
          data-keeps-swipes
          data-details-sheet={large ? 'large' : 'medium'}
          className={cn(
            'z-50 flex flex-col border bg-card outline-hidden data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom',
            large
              // Part of the page, as wide as it, from the screen's top edge down, as long as its contents: they
              // scroll with the window to the screen's bottom edge, with room at their end
              // (--details-end). The handle keeps clear of the status bar. Safari paints the strips
              // under its status bar and toolbar in the colour of the pinned handle and tabs, so
              // all of it stays the card's colour, with no border.
              ? 'absolute top-0 left-[env(safe-area-inset-left)] right-[env(safe-area-inset-right)] min-h-dvh rounded-none border-0 [--details-end:calc(env(safe-area-inset-bottom)+0.75rem)] [&_[role=tabpanel]]:overflow-visible [&_[role=tabpanel]_.overflow-y-auto]:overflow-visible'
              // As wide as the page (inside the notch's side held sideways), down to the window's
              // bottom edge (above the tab bar where there is one), with only its top rounded and
              // bordered: Safari paints its toolbar strip below in the sheet's colour, so the two
              // run on as one.
              : cn('fixed left-[env(safe-area-inset-left)] right-[env(safe-area-inset-right)] bottom-(--sheet-bottom) overflow-hidden rounded-t-xl border-x-0 border-b-0', sheetTop === undefined && 'h-[62dvh]'),
            'transition-[height,inset,border-radius,translate] duration-300 ease-out',
          )}
          style={sheetStyle(large, sheetTop)}
        >
          <button
            type="button"
            data-sheet-handle
            aria-label={large ? t('Make the details smaller') : t('Make the details larger')}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={cancelDrag}
            className={cn('flex h-6 w-full shrink-0 cursor-grab touch-none items-center justify-center rounded-t-xl outline-hidden active:cursor-grabbing focus-visible:[&>span]:bg-primary', pinned, large && 'top-0 h-[calc(1.5rem+env(safe-area-inset-top))] rounded-none pt-[env(safe-area-inset-top)]')}
          >
            <span className="h-1.5 w-10 rounded-full bg-muted-foreground/40" />
          </button>
          <div className={cn('flex min-h-0 flex-1 flex-col gap-2 px-4', !large && 'pb-3')}>
            <DialogPrimitive.Title className="sr-only">{torrent.name}</DialogPrimitive.Title>
            <DetailsTabs
              onDelete={onDelete}
              torrent={torrent}
              // Maximized, the pinned row's card-coloured band below the tabs keeps the scrolled details
              // off them; it takes the place of the gap below, so About doesn't move down.
              barClassName={cn(pinned, large && '-mx-4 -mb-2 top-[calc(env(safe-area-inset-top)+1.5rem)] px-4 pb-2')}
              end={(
                <DialogPrimitive.Close asChild>
                  <Button variant="ghost" size="icon" className="size-8 rounded-full bg-muted hover:bg-accent" aria-label={t('Close details')} title={t('Close')}>
                    <X className="size-4" />
                  </Button>
                </DialogPrimitive.Close>
              )}
            />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
