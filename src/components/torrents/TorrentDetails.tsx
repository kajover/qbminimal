import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type HTMLAttributes, type PointerEvent, type ReactNode } from 'react'
import { FolderTree, Info, RadioTower, SlidersHorizontal, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePrefetchDetails } from '@/hooks/useApi'
import { holdCursor, swallowClick } from '@/lib/dragCursor'
import { isRemembered, useRemembered } from '@/hooks/useRemembered'
import { watchTorrentSpeeds } from '@/lib/speedHistory'
import { cn } from '@/lib/utils'
import { textWidth } from '@/components/TableColumns'
import { textScale } from '@/lib/textSize'
import { knownReach, measureReach } from '@/lib/detailsReach'
import type { Torrent } from '@/types'
import { PeersTab } from './PeersTab'
import { TorrentActions } from './TorrentActions'
import { TorrentContentTab } from './TorrentContentTab'
import { TorrentInfoTab } from './TorrentInfoTab'
import { TrackersTab } from './TrackersTab'
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

// Whether the details fill the screen: kept while another page shows, forgotten when they close
// (TorrentsView), so they never open maximized. Their tab and height are kept until a reload.
export const DETAILS_MEMORY = ['details.full', 'details.detent']

const initialHeight = () => clampHeight(knownReach() ?? window.innerHeight * 0.4)

// Everything about one torrent. The open tab is remembered, also for the next time details open,
// and each tab's key is the hash, so its content starts fresh for another torrent.
// `end` sits at the end of the tabs' row, for the close button.
// On phones the open tab is as wide as the longest tab name needs (12px text, the 14px icon and its
// 4px gap, 8px padding each side, a margin), so the others share the rest of the bar evenly and keep
// their width whichever tab is open.
const openTabWidth = () => Math.ceil(Math.max(...TABS.map(tab => textWidth(tab.label, 12 * textScale()))) + 14 + 4 + 16 + 4)

export function DetailsTabs({ torrent, listClassName, barClassName, barProps, end, onDelete }: { torrent: Torrent; listClassName?: string; barClassName?: string; barProps?: HTMLAttributes<HTMLDivElement>; end?: ReactNode; onDelete?: () => void }) {
  // Its speeds are recorded while the details are open, whichever tab shows, for the Details graph.
  useEffect(() => watchTorrentSpeeds(torrent.hash), [torrent.hash])
  usePrefetchDetails(torrent.hash)
  // On the Details tab when the app is first opened; after that the tab last picked, until a reload.
  const [tab, setTab] = useRemembered<TabId>('details.tab', 'details')
  // Drawn until the first measure (see measureReach); the panel or sheet draws again with the
  // measured height, which lets it go.
  const probe = knownReach() === undefined
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

export interface DetailsProps {
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
    swallowClick()
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
        style={{ ...(full ? { top: edges ? `${edges.top}px` : 0 } : { height }), translate: sink ? `0 ${sink}px` : undefined, insetInlineStart: edges ? `${edges.start}px` : 'var(--sidebar-width, 0px)', insetInlineEnd: edges ? `${edges.end}px` : 0 }}
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
