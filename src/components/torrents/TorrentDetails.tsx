import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { FolderTree, Info, RadioTower, SlidersHorizontal, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useBackButtonClose } from '@/hooks/useBackButtonClose'
import { readStored, writeStored } from '@/lib/storage'
import { watchTorrentSpeeds } from '@/lib/speedHistory'
import { cn } from '@/lib/utils'
import type { Torrent } from '@/types'
import { PeersTab } from './PeersTab'
import { TorrentActions } from './TorrentActions'
import { TorrentContentTab } from './TorrentContentTab'
import { TorrentInfoTab } from './TorrentInfoTab'
import { TrackersTab } from './TrackersTab'
import { t } from '@/i18n'

const TABS = [
  { id: 'details', label: t('Details'), icon: Info },
  { id: 'content', label: t('Content'), icon: FolderTree },
  { id: 'actions', label: t('Actions'), icon: SlidersHorizontal },
  { id: 'trackers', label: t('Trackers'), icon: RadioTower },
  { id: 'peers', label: t('Peers'), icon: Users },
] as const

const HEIGHT_KEY = 'qbminimal.detailsHeight'
const TAB_KEY = 'qbminimal.detailsTab'
type TabId = (typeof TABS)[number]['id']
const isTabId = (value: string | null): value is TabId => TABS.some(tab => tab.id === value)
const MIN_HEIGHT = 160
// The list keeps at least this much of the window.
const LIST_ROOM = 200

const clampHeight = (height: number) => Math.round(Math.max(MIN_HEIGHT, Math.min(height, window.innerHeight - LIST_ROOM)))

function initialHeight() {
  const stored = Number(readStored(HEIGHT_KEY))
  return clampHeight(stored > 0 ? stored : window.innerHeight * 0.4)
}

// Everything about one torrent. The open tab is remembered, also for the next time details open,
// and each tab's key is the hash, so its content starts fresh for another torrent.
// `end` sits at the end of the tabs' row, for the close button.
function DetailsTabs({ torrent, listClassName, end }: { torrent: Torrent; listClassName?: string; end?: ReactNode }) {
  // Its speeds are recorded while the details are open, whichever tab shows, for the Details graph.
  useEffect(() => watchTorrentSpeeds(torrent.hash), [torrent.hash])
  const [tab, setTab] = useState<TabId>(() => {
    const stored = readStored(TAB_KEY)
    return isTabId(stored) ? stored : 'details'
  })
  const choose = (value: string) => {
    if (!isTabId(value)) return
    setTab(value)
    writeStored(TAB_KEY, value)
  }
  return (
    <Tabs value={tab} onValueChange={choose} className="min-h-0 flex-1">
      <div className="flex items-center gap-2">
        <TabsList className={cn('grid min-w-0 flex-1 grid-cols-5', listClassName)}>
          {/* Icons where there's room beside the names. */}
          {TABS.map(({ id, label, icon: Icon }) => <TabsTrigger key={id} value={id} className="gap-1 px-0.5 text-xs sm:px-3"><Icon className="size-3.5 max-sm:hidden" />{label}</TabsTrigger>)}
        </TabsList>
        {end && <div className="ms-auto shrink-0">{end}</div>}
      </div>
      <TabsContent value="details" className="overflow-y-auto"><TorrentInfoTab torrent={torrent} /></TabsContent>
      <TabsContent value="content" className="flex min-h-0 flex-col overflow-hidden"><TorrentContentTab key={torrent.hash} hash={torrent.hash} /></TabsContent>
      <TabsContent value="actions" className="overflow-y-auto"><TorrentActions key={torrent.hash} torrent={torrent} /></TabsContent>
      <TabsContent value="trackers" className="overflow-y-auto"><TrackersTab key={torrent.hash} hash={torrent.hash} /></TabsContent>
      <TabsContent value="peers" className="overflow-y-auto"><PeersTab key={torrent.hash} hash={torrent.hash} /></TabsContent>
    </Tabs>
  )
}

interface DetailsProps {
  torrent: Torrent
  onClose: () => void
}

// Wide screens: a panel along the bottom of the window, below the list, with an edge to drag
// for its height. Picking another torrent in the list shows that one instead.
export function TorrentDetailsPanel({ torrent, onClose }: DetailsProps) {
  const [height, setHeight] = useState(initialHeight)
  const drag = useRef<{ y: number; height: number } | null>(null)

  // Shared, so the table's scrollbar can sit just above the panel.
  useEffect(() => {
    document.documentElement.style.setProperty('--details-height', `${height}px`)
  }, [height])
  useEffect(() => () => { document.documentElement.style.removeProperty('--details-height') }, [])

  const commit = (next: number) => {
    const clamped = clampHeight(next)
    setHeight(clamped)
    writeStored(HEIGHT_KEY, String(clamped))
  }
  const startDrag = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { y: e.clientY, height }
  }
  const moveDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current) setHeight(clampHeight(drag.current.height + drag.current.y - e.clientY))
  }
  const endDrag = () => {
    if (drag.current) commit(height)
    drag.current = null
  }
  const onEdgeKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    commit(height + (e.key === 'ArrowUp' ? 32 : -32))
  }

  return (
    <>
      {/* Room at the end of the page, so the last rows can scroll above the panel. */}
      <div aria-hidden style={{ height }} />
      <section
        aria-label={t('Torrent details')}
        data-keeps-swipes
        className="fixed end-0 bottom-0 z-30 flex flex-col border-t bg-card shadow-[0_-6px_16px_-8px_rgb(0_0_0/0.15)]"
        style={{ height, insetInlineStart: 'var(--sidebar-width, 0px)' }}
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
            torrent={torrent}
            listClassName="max-w-xl"
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

// Phones: a sheet from the bottom, as in iOS. It opens at medium height, floating clear of the
// screen's edges; dragging its handle up, or tapping it, gives the whole screen, and dragging down
// steps back or closes it. The back button and Esc close it too.
type Detent = 'medium' | 'large'
const DISMISS_DISTANCE = 90
const FLICK_SPEED = 0.6 // px per ms

export function TorrentDetailsDialog({ torrent, onClose }: DetailsProps) {
  useBackButtonClose(onClose)
  const [detent, setDetent] = useState<Detent>('medium')
  const [offset, setOffset] = useState<number | null>(null)
  const drag = useRef<{ y: number; time: number } | null>(null)

  const startDrag = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { y: e.clientY, time: e.timeStamp }
    setOffset(0)
  }
  const moveDrag = (e: PointerEvent<HTMLButtonElement>) => {
    if (drag.current) setOffset(e.clientY - drag.current.y)
  }
  const endDrag = (e: PointerEvent<HTMLButtonElement>) => {
    const start = drag.current
    drag.current = null
    setOffset(null)
    if (!start) return
    const distance = e.clientY - start.y
    const speed = distance / Math.max(e.timeStamp - start.time, 1)
    // A tap toggles between the heights, for anyone who doesn't drag.
    if (Math.abs(distance) < 6) setDetent(detent === 'medium' ? 'large' : 'medium')
    else if (distance < -40 || speed < -FLICK_SPEED) setDetent('large')
    else if (distance > DISMISS_DISTANCE || speed > FLICK_SPEED) {
      if (detent === 'large' && distance < window.innerHeight * 0.45) setDetent('medium')
      else onClose()
    }
  }

  const large = detent === 'large'
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          data-keeps-swipes
          className={cn(
            'fixed z-50 flex flex-col overflow-hidden border bg-card shadow-2xl outline-hidden data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom',
            large
              ? 'inset-x-0 bottom-0 h-[calc(100dvh-env(safe-area-inset-top)-0.5rem)] rounded-t-[1.75rem] border-b-0 pb-[env(safe-area-inset-bottom)]'
              : 'inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] h-[62dvh] rounded-[2rem]',
            offset === null && 'transition-[height,inset,border-radius,translate] duration-300 ease-out',
          )}
          // Following the finger, a little stiffer upwards.
          style={offset === null ? undefined : { translate: `0 ${offset > 0 ? offset : offset / 3}px` }}
        >
          <button
            type="button"
            aria-label={large ? t('Make the details smaller') : t('Make the details larger')}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={() => { drag.current = null; setOffset(null) }}
            className="flex h-6 w-full shrink-0 cursor-grab touch-none items-center justify-center outline-hidden active:cursor-grabbing focus-visible:[&>span]:bg-primary"
          >
            <span className="h-1.5 w-10 rounded-full bg-muted-foreground/40" />
          </button>
          <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 pb-3">
            <DialogPrimitive.Title className="sr-only">{torrent.name}</DialogPrimitive.Title>
            <DetailsTabs
              torrent={torrent}
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
