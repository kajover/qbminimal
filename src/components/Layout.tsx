import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConnectionBanner } from '@/components/ConnectionBanner'
import { DropOverlay } from '@/components/DropOverlay'
import { GlobalSpeeds } from '@/components/GlobalSpeeds'
import { SpeedLimitToggle } from '@/components/SpeedLimitToggle'
import { PAGES, type PageId } from '@/components/navigation'
import { useSession } from '@/hooks/useSession'
import { readStored, writeStored } from '@/lib/storage'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface LayoutProps {
  page: PageId
  onNavigate: (page: PageId) => void
  children: ReactNode
}

function LogoutButton() {
  const { signOut } = useSession()
  const [busy, setBusy] = useState(false)
  const label = busy ? t('Logging out...') : t('Logout')
  return (
    <Button variant="ghost" size="icon" disabled={busy} aria-label={label} title={label} onClick={() => { setBusy(true); void signOut() }}>
      <LogOut className="size-5" />
    </Button>
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

// Wide screens only. The sidebar reaches the title's first "r" (150px at the default text size), or is as wide as its labels if they need more, until it's dragged by its edge, which also
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
  const { shown: sidebarShown, width: sidebarWidth, measured: sidebarMeasured, box: sidebarBox, show: showSidebar, startDrag, resetWidth } = useSidebar()
  const { header: headerRef, nav: navRef } = useBarSizes()

  // A newly opened page starts at its top.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [page])

  const navButtons = PAGES.map(({ id, label, icon: Icon }) => (
    <Button key={id} variant={page === id ? 'secondary' : 'ghost'} className="justify-start gap-2 overflow-hidden text-base" title={label} aria-current={page === id ? 'page' : undefined} onClick={() => onNavigate(id)}>
      <Icon className="size-5" />
      <span className="truncate">{label}</span>
    </Button>
  ))

  return (
    // Below the md width (1200px) the window scrolls the page, under a glass header and a floating
    // glass tab bar, with room at the end so it can always come clear of the tab bar. Only a scrolling
    // window lets iPhone Safari show the page on behind its address bar; a fixed frame stops at it
    // and leaves a blank strip. Nothing may make the page wider than the screen: iPhone Safari would
    // then widen the whole layout, open it zoomed in, and push the tab bar out of sight.
    <div style={{ '--sidebar-width': `${sidebarMeasured}px` } as CSSProperties} className="min-h-screen bg-background max-md:overflow-x-clip">
      <header ref={headerRef} className="glass-bar sticky top-0 z-40 border-b pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 items-center justify-between gap-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
          <div className="flex min-w-0 items-center gap-2">
            {/* The tab bar holds the pages on phones, so this corner only needs a way out. */}
            <LogoutButton />
            {/* Its size follows the chosen text size and the screen's width; index.css sets it. */}
            <h1 className="brand-title">{t('qBittorrent')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <GlobalSpeeds />
            {/* Last, so it stays put at the right edge whatever the speeds read. */}
            <SpeedLimitToggle />
          </div>
        </div>
        <ConnectionBanner />
      </header>

      <div>
        <div className="flex">
          {/* Above the torrent details panel (z-30), so the edge handle is never covered. */}
          <div ref={sidebarBox} className="sticky top-14 z-35 hidden h-[calc(100vh-3.5rem)] shrink-0 self-start md:flex">
            {sidebarShown && (
              <aside style={sidebarWidth ? { width: sidebarWidth } : undefined} className="w-max min-w-(--sidebar-start) overflow-x-hidden overflow-y-auto p-2 pb-4">
                <nav aria-label={t('Pages')} className="flex flex-col gap-1">{navButtons}</nav>
              </aside>
            )}
            {/* The sidebar's edge: drag it to resize, or past a point to hide; the button in its middle hides and shows it. */}
            <div className="group relative w-px bg-border">
              <div aria-hidden className="absolute inset-y-0 -inset-x-1.5 z-10 cursor-col-resize" onPointerDown={startDrag} onDoubleClick={resetWidth} />
              <Button
                variant="outline"
                size="icon"
                className="absolute top-1/2 left-1/2 z-20 h-8 w-3 min-w-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background p-0 text-muted-foreground shadow-none hover:text-foreground"
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
            {children}
          </main>
        </div>
      </div>

      <DropOverlay />

      {/* Phones: a floating glass capsule, clear of the screen's edges and the home indicator. */}
      <nav
        ref={navRef}
        aria-label={t('Pages')}
        className="glass glass-flat fixed inset-x-[max(0.75rem,env(safe-area-inset-left))] bottom-[max(var(--nav-gap),env(safe-area-inset-bottom))] z-30 rounded-full md:hidden"
      >
        <div className="flex justify-around px-1 py-1.5">
          {PAGES.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" aria-current={page === id ? 'page' : undefined} onClick={() => onNavigate(id)} className={cn('flex min-w-0 flex-auto flex-col items-center rounded-full px-1 py-1 transition-colors [:root[data-tab-labels=off]_&]:py-2', page === id ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground')}>
              <Icon className="size-5" />
              {/* Hidden in Settings, the names stay for screen readers. */}
              <span className="max-w-full truncate text-sm [:root[data-tab-labels=off]_&]:sr-only">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
