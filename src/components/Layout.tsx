import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, LogOut, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { HeaderSlot } from '@/components/HeaderSlot'
import { ConnectionBanner } from '@/components/ConnectionBanner'
import { DropOverlay } from '@/components/DropOverlay'
import { GlobalSpeeds } from '@/components/GlobalSpeeds'
import { EXTRA_PAGES, MAIN_PAGES, type PageId } from '@/components/navigation'
import { StatusDots } from '@/components/StatusDots'
import { usePageNotes } from '@/hooks/useStatusNotes'
import { useSession } from '@/hooks/useSession'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useDisplayOption } from '@/lib/displayOptions'
import { checkForUpdatesIfDue } from '@/lib/updateNotice'
import { readStored, writeStored } from '@/lib/storage'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface LayoutProps {
  page: PageId
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

// The menu button: the pages and the way out. Settings can add a sidebar or tab bar beside it.
function PagesMenu({ page, onNavigate }: { page: PageId; onNavigate: (page: PageId) => void }) {
  const { signOut } = useSession()
  // Closing gives focus back to the button, which browsers then ring as if reached by keyboard.
  // That's kept for the keyboard and left out after a click or tap.
  const byPointer = useRef(false)
  // A dot in the colour of the first thing out of the ordinary, as the statistics show it.
  const notes = usePageNotes().all
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative max-md:size-8" aria-label={notes.length ? `${t('Menu')}: ${notes.map(note => note.label).join(', ')}` : t('Menu')} title={t('Menu')} onPointerDown={() => { byPointer.current = true }} onKeyDown={() => { byPointer.current = false }}>
          <Menu className="size-5" />
          {notes[0] && <span aria-hidden className={cn('absolute end-0.5 top-0.5 size-2.5 rounded-full ring-2 ring-background', notes[0].dot)} />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52" onPointerDown={() => { byPointer.current = true }} onKeyDown={() => { byPointer.current = false }} onCloseAutoFocus={(e) => { if (byPointer.current) e.preventDefault() }}>
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

export function Layout({ page, onNavigate, children }: LayoutProps) {
  const { signOut } = useSession()
  const { shown: sidebarShown, width: sidebarWidth, measured: sidebarMeasured, box: sidebarBox, show: showSidebar, startDrag, resetWidth } = useSidebar()
  const { header: headerRef, nav: navRef } = useBarSizes()
  const menuBar = useDisplayOption('menuBar')
  // Signed in now, so look for updates in the background, unless that was done lately.
  useEffect(() => {
    if (!__DEMO__) checkForUpdatesIfDue()
  }, [])
  const wide = useMediaQuery('(min-width: 1200px)')
  // Where each page's title row goes; on phones without the selection bar.
  const [slot, setSlot] = useState<HTMLDivElement | null>(null)

  // A newly opened page starts at its top.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [page])

  const notes = usePageNotes()
  const navButton = ({ id, label, icon: Icon }: (typeof MAIN_PAGES)[number]) => (
    <Button key={id} variant={page === id ? 'secondary' : 'ghost'} className="justify-start gap-2 overflow-hidden" title={label} aria-current={page === id ? 'page' : undefined} onClick={() => onNavigate(id)}>
      {/* 14px labels like the tab bar's, with 16px icons beside them, as on the other buttons. */}
      <Icon className="size-4" />
      <span className="truncate">{label}</span>
      {(id === 'torrents' || id === 'statistics') && <StatusDots notes={notes[id]} />}
    </Button>
  )

  return (
    // Below the md width (1200px) the window scrolls the page, under a glass header and a floating
    // glass tab bar, with room at the end so it can always come clear of the tab bar. Only a scrolling
    // window lets iPhone Safari show the page on behind its address bar; a fixed frame stops at it
    // and leaves a blank strip. Nothing may make the page wider than the screen: iPhone Safari would
    // then widen the whole layout, open it zoomed in, and push the tab bar out of sight.
    <div style={{ '--sidebar-width': `${sidebarMeasured}px` } as CSSProperties} className="min-h-screen bg-background max-md:overflow-x-clip">
      <header ref={headerRef} className="glass-bar sticky top-0 z-40 border-b pt-[env(safe-area-inset-top)]">
        {/* The same side room as the content below, so the menu button lines up with the list's
            start and the last button with its end: on phones the cards and table reach 0.5rem
            past the page's 1rem margin. */}
        <div className="flex h-14 items-center justify-between gap-2 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] sm:pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))]">
          <div className="flex shrink-0 items-center gap-2">
            <PagesMenu page={page} onNavigate={onNavigate} />
            {/* Left out for room; screen readers still hear it. */}
            <h1 className="sr-only">{t('qBittorrent')}</h1>
          </div>
          <div ref={setSlot} className="flex min-w-0 flex-1 items-center md:px-2" />
          <GlobalSpeeds onOpen={() => onNavigate('statistics')} />
        </div>
        <ConnectionBanner />
      </header>

      <div>
        <div className="flex">
          {/* Above the torrent details panel (z-30), so the edge handle is never covered. */}
          <div ref={sidebarBox} className={cn('sticky top-14 z-35 hidden h-[calc(100vh-3.5rem)] shrink-0 self-start', menuBar && 'md:flex')}>
            {sidebarShown && (
              <aside style={sidebarWidth ? { width: sidebarWidth } : undefined} className="flex w-max min-w-38 flex-col overflow-x-hidden overflow-y-auto p-2 pb-4">
                <nav aria-label={t('Pages')} className="flex flex-col gap-1">{MAIN_PAGES.map(navButton)}</nav>
                <div className="mt-2 flex flex-col gap-1 border-t pt-2">
                  {EXTRA_PAGES.map(navButton)}
                </div>
                {/* At the bottom and quieter, apart from the pages. */}
                <Button variant="ghost" className="mt-auto w-full justify-start gap-2 overflow-hidden text-muted-foreground" onClick={() => void signOut()}>
                  <LogOut className="size-4" />
                  <span className="truncate">{t('Logout')}</span>
                </Button>
              </aside>
            )}
            {/* The sidebar's edge: drag it to resize, or past a point to hide; the button in its middle hides and shows it.
                Its background is solid in both themes, so the edge line doesn't show through it. */}
            <div className="group relative w-px bg-border">
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
          <main className="min-w-0 flex-1 pt-4 pb-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] max-md:pb-[calc(var(--bottom-nav-height,5rem)+1rem)]">
            {/* The torrent list takes the whole width; the other pages are easier to read narrower. */}
            <div className={cn(page !== 'torrents' && 'mx-auto w-full max-w-4xl')}>
              <HeaderSlot value={slot ? { element: slot, whole: wide } : null}>{children}</HeaderSlot>
            </div>
          </main>
        </div>
      </div>

      <DropOverlay />

      {/* Phones: a floating glass capsule, clear of the screen's edges and the home indicator. */}
      <nav
        ref={navRef}
        aria-label={t('Pages')}
        style={{ '--bar-bottom': 'var(--bottom-edge)' } as CSSProperties}
        className={cn('glass glass-flat bottom-bar inset-x-[max(0.75rem,env(safe-area-inset-left))] z-30 rounded-full md:hidden', !menuBar && 'hidden')}
      >
        <div className="flex justify-around px-1 py-1.5">
          {MAIN_PAGES.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" aria-current={page === id ? 'page' : undefined} onClick={() => onNavigate(id)} className={cn('flex min-w-0 flex-auto flex-col items-center rounded-full px-1 py-1 transition-colors [:root[data-tab-labels=off]_&]:py-2', page === id ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground')}>
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
