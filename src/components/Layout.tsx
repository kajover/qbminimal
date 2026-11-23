import { KEY_TAKING_LAYERS } from '@/hooks/useListShortcuts'
import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, LogOut, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { HeaderSlot } from '@/components/HeaderSlot'
import { ConnectionBanner } from '@/components/ConnectionBanner'
import { DropOverlay } from '@/components/DropOverlay'
import { GlobalSpeeds } from '@/components/GlobalSpeeds'
import { EXTRA_PAGES, MAIN_PAGES, MENU_PAGES, type PageId } from '@/components/navigation'
import { StatusDots } from '@/components/StatusDots'
import { usePageNotes } from '@/hooks/useStatusNotes'
import { useSession } from '@/hooks/useSession'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useDisplayOption } from '@/lib/displayOptions'
import { checkForUpdatesIfDue } from '@/lib/updateNotice'
import { sendPendingCounts } from '@/lib/updates'
import { readStored, writeStored } from '@/lib/storage'
import { cn } from '@/lib/utils'
import { PAGE_SCROLL_ID, pageScroller, WIDE } from '@/lib/pageScroll'
import { pageKeys, withKeys } from '@/lib/shortcutKeys'
import { t } from '@/i18n'

interface LayoutProps {
  // The tab that's lit, and the page on screen, which can follow it a few frames later.
  page: PageId
  shownPage?: PageId
  onNavigate: (page: PageId) => void
  children: ReactNode
}

function PageItem({ id, label, icon: Icon, page, onNavigate }: (typeof MAIN_PAGES)[number] & { page: PageId; onNavigate: (page: PageId) => void }) {
  const notes = usePageNotes()
  return (
    <DropdownMenuItem aria-current={page === id ? 'page' : undefined} className={cn(page === id && 'bg-accent text-accent-foreground')} onSelect={() => onNavigate(id)}>
      <Icon />
      {label}
      {(id === 'torrents' || id === 'statistics') && <StatusDots notes={notes[id]} />}
    </DropdownMenuItem>
  )
}

// The menu button: the pages and the way out. A little room between the items keeps the open
// page's background apart from the one hovered next to it. Settings can add a sidebar or tab bar beside it.
function PagesMenu({ page, onNavigate }: { page: PageId; onNavigate: (page: PageId) => void }) {
  const { signOut } = useSession()
  // Closing gives focus back to the button, which browsers then ring as if reached by keyboard.
  // That's kept for the keyboard and left out after a click or tap.
  const byPointer = useRef(false)
  // A dot in the colour of the first thing out of the ordinary, as the statistics show it.
  const notes = usePageNotes().all
  return (
    <DropdownMenu>
      {/* The button sits a pixel lower: its middle line then meets the middle of the title's
          lowercase letters, not of its capitals, so the two read as one line. The lines stay
          centred in the highlight behind them. */}
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-8 translate-y-px" aria-label={notes.length ? `${t('Menu')}: ${notes.map(note => note.label).join(', ')}` : t('Menu')} title={t('Menu')} onPointerDown={() => { byPointer.current = true }} onKeyDown={() => { byPointer.current = false }}>
          <Menu className="size-5" />
          {notes[0] && <span aria-hidden className={cn('absolute end-0.5 top-0.5 size-2.5 rounded-full ring-2 ring-background', notes[0].dot)} />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="flex w-52 flex-col gap-0.5" onPointerDown={() => { byPointer.current = true }} onKeyDown={() => { byPointer.current = false }} onCloseAutoFocus={(e) => { if (byPointer.current) e.preventDefault() }}>
        {MAIN_PAGES.map(item => <PageItem key={item.id} {...item} page={page} onNavigate={onNavigate} />)}
        <DropdownMenuSeparator />
        {EXTRA_PAGES.map(item => <PageItem key={item.id} {...item} page={page} onNavigate={onNavigate} />)}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut />
          {t('Logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Pages that fill the frame's height, so only their lists scroll, not the page.
const FILLS_FRAME = new Set<string>(['torrents', 'search', 'statistics', 'rss'])

// The phone tab bar's own height, as --nav-bar-height (index.css adds its gap above the home
// indicator to make --bottom-nav-height), and the header's, as --header-height. The page scrolls
// under both, with that much room at each end. Only the bars' own sizes are measured: Safari's
// window height changes with zooming and its toolbar, so it can't place them.
function useBarSizes() {
  const header = useRef<HTMLElement>(null)
  const nav = useRef<HTMLElement>(null)
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const root = document.documentElement.style
    const observer = new ResizeObserver(() => {
      if (nav.current?.offsetHeight) root.setProperty('--nav-bar-height', `${nav.current.offsetHeight}px`)
      if (header.current) root.setProperty('--header-height', `${header.current.offsetHeight}px`)
    })
    if (nav.current) observer.observe(nav.current)
    if (header.current) observer.observe(header.current)
    return () => {
      observer.disconnect()
      root.removeProperty('--nav-bar-height')
      root.removeProperty('--header-height')
    }
  }, [])
  return { header, nav }
}

// The frame scrolls the area below the header, which the keys only reach while focus is in it.
// So with focus on nothing, or on the header or sidebar, the arrows, Page Up and Down, Home, End
// and Space scroll it all the same. Space on a button still presses it.
function usePageScrollKeys() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      const area = document.getElementById(PAGE_SCROLL_ID)
      const target = event.target as HTMLElement
      if (!area || pageScroller() !== area || area.contains(target) || document.querySelector('[role="dialog"], [role="menu"]')) return
      if (target.closest('input, textarea, select, [contenteditable="true"], [role="tablist"], [role="radiogroup"], [role="slider"], [role="listbox"]')) return
      const onNothing = target === document.body
      const page = area.clientHeight * 0.875
      const by: Record<string, number> = { ArrowDown: 40, ArrowUp: -40, PageDown: page, PageUp: -page }
      if (onNothing && event.key === ' ') by[' '] = event.shiftKey ? -page : page
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault()
        area.scrollTo({ top: event.key === 'Home' ? 0 : area.scrollHeight, behavior: 'smooth' })
      } else if (event.key in by) {
        event.preventDefault()
        area.scrollBy({ top: by[event.key], behavior: event.key.startsWith('Arrow') ? 'instant' : 'smooth' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

const SIDEBAR_KEY = 'qbminimal.sidebar'
const SIDEBAR_WIDTH_KEY = 'qbminimal.sidebarWidth'
// Dragged narrower than SIDEBAR_COLLAPSE, the sidebar hides; between that and SIDEBAR_MIN it stays at SIDEBAR_MIN.
const SIDEBAR_MIN = 120
const SIDEBAR_MAX = 320
const SIDEBAR_COLLAPSE = 72

const storedWidth = () => {
  const width = Number(readStored(SIDEBAR_WIDTH_KEY))
  return width >= SIDEBAR_MIN && width <= SIDEBAR_MAX ? width : null
}

// Wide screens only. The sidebar is 9.5rem wide, or as wide as its labels if they need more, until it's dragged by its edge, which also
// holds the button that hides and shows it. --sidebar-width lets panels fixed to the window line up
// with the main column.
function useSidebar() {
  const [shown, setShown] = useState(() => readStored(SIDEBAR_KEY) !== 'hidden')
  const [width, setWidth] = useState<number | null>(storedWidth)
  const [measured, setMeasured] = useState(0)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || !box.current) return
    const observer = new ResizeObserver(([entry]) => setMeasured(entry.contentRect.width))
    observer.observe(box.current)
    return () => observer.disconnect()
  }, [])

  const show = (on: boolean) => {
    writeStored(SIDEBAR_KEY, on ? null : 'hidden')
    setShown(on)
  }

  const startDrag = (event: ReactPointerEvent) => {
    if (event.button !== 0 || (event.target as Element).closest('button') || !box.current) return
    event.preventDefault()
    const rect = box.current.getBoundingClientRect()
    const rtl = getComputedStyle(box.current).direction === 'rtl'
    let latest = { shown, width }
    const move = (e: PointerEvent) => {
      const dragged = rtl ? rect.right - e.clientX : e.clientX - rect.left
      latest = dragged < SIDEBAR_COLLAPSE
        ? { shown: false, width: latest.width }
        : { shown: true, width: Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, dragged))) }
      setShown(latest.shown)
      if (latest.shown) setWidth(latest.width)
    }
    const end = () => {
      window.removeEventListener('pointermove', move)
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
      writeStored(SIDEBAR_KEY, latest.shown ? null : 'hidden')
      writeStored(SIDEBAR_WIDTH_KEY, latest.width ? String(latest.width) : null)
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end, { once: true })
    window.addEventListener('pointercancel', end, { once: true })
  }

  // A double click on the edge goes back to fitting the labels.
  const resetWidth = () => {
    writeStored(SIDEBAR_WIDTH_KEY, null)
    setWidth(null)
  }

  return { shown, width, measured, box, show, startDrag, resetWidth }
}

// The statistics open over the page from the speeds in the header, loaded when first asked for.
const StatisticsDialog = lazy(() => import('@/components/torrents/TorrentStats').then(m => ({ default: m.StatisticsDialog })))

// G and then a page's number, 1 to 7 in the menu's order, goes to that page. Not while typing or
// with a window or menu open.
// The same letters on every page: S goes to the page's search field, N adds, F shows or hides the
// filters, V switches the view. A page marks what each letter works with `data-key`, and the first
// one in view is used. The torrent list handles its own, with more to do.
function pressPageKey(key: string, event: KeyboardEvent) {
  if (!/^[snfv]$/.test(key)) return
  const target = [...document.querySelectorAll<HTMLElement>(`[data-key="${key}"]`)].find(element => element.getClientRects().length > 0)
  if (!target) return
  event.preventDefault()
  if (target.matches('input, textarea')) target.focus()
  else target.click()
}

function usePageKeys(onNavigate: (page: PageId) => void) {
  const navigate = useRef(onNavigate)
  useEffect(() => { navigate.current = onNavigate })
  useEffect(() => {
    let armed = 0
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.metaKey || event.ctrlKey || event.altKey || target.closest?.('input, textarea, select, [contenteditable="true"]') || document.querySelector(KEY_TAKING_LAYERS)) return
      const key = event.key.toLowerCase()
      if (armed && Date.now() - armed < 1500 && /^[1-9]$/.test(key)) {
        const next = MENU_PAGES[Number(key) - 1]
        armed = 0
        if (next) {
          event.preventDefault()
          navigate.current(next.id)
        }
      } else {
        armed = key === 'g' && !event.shiftKey ? Date.now() : 0
        if (!armed && !event.shiftKey && !event.defaultPrevented) pressPageKey(key, event)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export function Layout({ page, shownPage = page, onNavigate, children }: LayoutProps) {
  const { signOut } = useSession()
  const { shown: sidebarShown, width: sidebarWidth, measured: sidebarMeasured, box: sidebarBox, show: showSidebar, startDrag, resetWidth } = useSidebar()
  const { header: headerRef, nav: navRef } = useBarSizes()
  const menuBar = useDisplayOption('menuBar')
  // Signed in now, so look for updates in the background, unless that was done lately.
  useEffect(() => {
    if (__DEMO__) return
    checkForUpdatesIfDue()
    sendPendingCounts()
  }, [])
  const wide = useMediaQuery(WIDE)
  const [statsOpen, setStatsOpen] = useState(false)
  usePageKeys(onNavigate)
  usePageScrollKeys()
  // Where each page's title row goes; on phones without the selection bar.
  const [slot, setSlot] = useState<HTMLDivElement | null>(null)

  const notes = usePageNotes()
  const navButton = ({ id, label, icon: Icon }: (typeof MAIN_PAGES)[number]) => (
    <Button key={id} variant={page === id ? 'secondary' : 'ghost'} className="justify-start gap-2 overflow-hidden" title={withKeys(label, pageKeys(MENU_PAGES.findIndex(item => item.id === id) + 1))} aria-current={page === id ? 'page' : undefined} onClick={() => onNavigate(id)}>
      {/* 14px labels like the tab bar's, with 16px icons beside them, as on the other buttons. */}
      <Icon className="size-4" />
      <span className="truncate">{label}</span>
      {(id === 'torrents' || id === 'statistics') && <StatusDots notes={notes[id]} />}
    </Button>
  )

  return (
    // Below the wide layout (WIDE in pageScroll.ts) the window scrolls the page, under a glass header and a floating
    // glass tab bar, with room at the end so it can always come clear of the tab bar. Only a scrolling
    // window lets iPhone Safari show the page on behind its address bar; a fixed frame stops at it
    // and leaves a blank strip. Nothing may make the page wider than the screen: iPhone Safari would
    // then widen the whole layout, open it zoomed in, and push the tab bar out of sight.
    // In the frame (the wide layout) the window holds still: the header spans it on top and only
    // the area below scrolls.
    <div style={{ '--sidebar-width': `${sidebarMeasured}px` } as CSSProperties} className="min-h-dvh bg-background narrow:overflow-x-clip frame:flex frame:h-dvh frame:min-h-0 frame:flex-col frame:overflow-hidden">
      {/* Fixed where the window scrolls: iPhone Safari stops drawing a sticky header while the page
          is pulled past its end, leaving an empty strip. The page leaves its height free at the
          top instead. Not a transform, which would hold the selection bar fixed inside it. */}
      <header ref={headerRef} className="glass-bar sticky top-0 z-40 border-b pt-[env(safe-area-inset-top)] window-scroll:fixed window-scroll:inset-x-0 frame:shrink-0">
        {/* The same side room as the content below, so the menu button lines up with the list's
            start and the last button with its end: on phones the cards and table reach 0.5rem
            past the page's 1rem margin. */}
        <div className="flex h-12 items-center justify-between gap-2 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] sm:pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))]">
          <div className="flex shrink-0 items-center gap-2">
            <PagesMenu page={page} onNavigate={onNavigate} />
            {/* Left out for room; screen readers still hear it. */}
            <h1 className="sr-only">{t('qBittorrent')}</h1>
          </div>
          {/* The title sits as far from the menu icon at every width. */}
          <div ref={setSlot} className="flex min-w-0 flex-1 items-center" />
          <GlobalSpeeds onOpen={() => setStatsOpen(true)} />
        </div>
        <ConnectionBanner />
      </header>

      <div className="frame:min-h-0 frame:flex-1">
        <div className="flex frame:h-full">
          {/* Above the torrent details panel (z-30), so the edge handle is never covered. */}
          <div ref={sidebarBox} className={cn('relative z-35 hidden h-full shrink-0', menuBar && 'wide:flex')}>
            {/* The header's room at the start, so the pages line up under the menu button. */}
            {sidebarShown && (
              <aside style={sidebarWidth ? { width: sidebarWidth } : undefined} className="flex w-max min-w-38 flex-col overflow-x-hidden overflow-y-auto pt-2 pe-2 pb-4 ps-4">
                <nav aria-label={t('Pages')} className="flex flex-col gap-1">{MAIN_PAGES.map(navButton)}</nav>
                <div className="mt-2 flex flex-col gap-1 border-t pt-2">
                  {EXTRA_PAGES.map(navButton)}
                </div>
                {/* At the bottom and quieter, apart from the pages. The sidebar's bottom room, the page's,
                    puts its bottom edge level with the end of the lists on Torrents and Search. */}
                <Button variant="ghost" className="mt-auto w-full justify-start gap-2 overflow-hidden text-muted-foreground" onClick={() => void signOut()}>
                  <LogOut className="size-4" />
                  <span className="truncate">{t('Logout')}</span>
                </Button>
              </aside>
            )}
            {/* The sidebar's edge: drag it to resize, or past a point to hide; the button in its middle hides and shows it.
                With the sidebar hidden it takes no room, so the content starts where the menu button does.
                Its background is solid in both themes, so the edge line doesn't show through it. */}
            <div className={cn('group relative w-px bg-border', !sidebarShown && '-me-px')}>
              <div aria-hidden className="absolute inset-y-0 -inset-x-1.5 z-10 cursor-col-resize" onPointerDown={startDrag} onDoubleClick={resetWidth} />
              <Button
                variant="outline"
                size="icon"
                className="absolute top-1/2 left-1/2 z-20 h-8 w-3 min-w-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background p-0 text-muted-foreground shadow-none hover:bg-accent hover:text-foreground dark:bg-background dark:hover:bg-accent"
                aria-label={sidebarShown ? t('Hide sidebar') : t('Show sidebar')}
                aria-expanded={sidebarShown}
                title={sidebarShown ? t('Hide sidebar') : t('Show sidebar')}
                onClick={() => showSidebar(!sidebarShown)}
              >
                {sidebarShown ? <ChevronLeft className="size-2.5 rtl:rotate-180" /> : <ChevronRight className="size-2.5 rtl:rotate-180" />}
              </Button>
            </div>
          </div>
          <main id={PAGE_SCROLL_ID} className={cn('min-w-0 flex-1 frame:h-full frame:overflow-y-auto pt-4 window-scroll:pt-[calc(var(--header-height,calc(3rem+1px+env(safe-area-inset-top)))+1rem)] pb-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] narrow:pb-[calc(var(--bottom-nav-height,5rem)+1rem)]')}>
            {/* The torrent list and search results take the whole width; the other pages are easier to read narrower. */}
            {/* Sized for the page on screen, which can trail the tapped tab by a few frames. Some fill
                the frame's height, so only their lists scroll. */}
            <div className={cn(shownPage !== 'torrents' && shownPage !== 'search' && 'mx-auto w-full max-w-4xl', FILLS_FRAME.has(shownPage) && 'frame:h-full')}>
              <HeaderSlot value={slot ? { element: slot, whole: wide } : null}>{children}</HeaderSlot>
            </div>
          </main>
        </div>
      </div>

      <DropOverlay />
      {statsOpen && <Suspense fallback={null}><StatisticsDialog open onOpenChange={setStatsOpen} /></Suspense>}

      {/* Phones: a floating glass capsule, clear of the screen's edges and the home indicator. */}
      <nav
        ref={navRef}
        aria-label={t('Pages')}
        style={{ '--bar-bottom': 'var(--bottom-edge)' } as CSSProperties}
        // Centred and no wider than a phone's on tablets, where the full width is far to reach across.
        className={cn('glass bottom-bar inset-x-[max(0.75rem,env(safe-area-inset-left))] z-30 mx-auto max-w-lg rounded-full wide:hidden', !menuBar && 'hidden')}
      >
        <div className="flex justify-around px-1 py-1.5">
          {MAIN_PAGES.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" aria-current={page === id ? 'page' : undefined} onClick={() => onNavigate(id)} className={cn('flex min-w-0 flex-auto flex-col items-center rounded-full px-1 py-1 [:root[data-tab-labels=off]_&]:py-2', page === id ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground')}>
              {/* 18px icons over 12px names; with the names hidden in Settings, 20px icons on their own. */}
              <span className="relative">
                <Icon className="size-4.5 [:root[data-tab-labels=off]_&]:size-5" />
                {id === 'torrents' && notes.torrents[0] && <span aria-hidden className={cn('absolute -end-1 -top-0.5 size-2 rounded-full ring-2 ring-background', notes.torrents[0].dot)} />}
              </span>
              {/* Hidden in Settings, the names stay for screen readers. */}
              <span className="max-w-full truncate text-xs [:root[data-tab-labels=off]_&]:sr-only">{label}</span>
              {id === 'torrents' && notes.torrents[0] && <span className="sr-only">{notes.torrents[0].label}</span>}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
