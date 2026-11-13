import { lazy, startTransition, useEffect, useState, type ComponentType } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { HoverLabels } from '@/components/HoverLabels'
import { Layout } from '@/components/Layout'
import { LoginForm } from '@/components/LoginForm'
import { PageBoundary } from '@/components/PageBoundary'
import type { PageId } from '@/components/navigation'
import { TorrentsView } from '@/components/torrents/TorrentsView'
import { AddTorrentView } from '@/components/torrents/AddTorrentView'
import { SessionProvider } from '@/components/SessionProvider'
import { useSession } from '@/hooks/useSession'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { hasIncoming, onIncoming } from '@/lib/incoming'
import { registerServiceWorker } from '@/lib/notify'
import { t } from '@/i18n'

// The torrent list and the Add page (whose form the list's + button opens too) ship in the main
// script. The other pages load in the background once signed in, so they open at once later.
const LOADERS = {
  rss: () => import('@/components/rss/RSSView').then(m => ({ default: m.RSSView })),
  search: () => import('@/components/search/SearchView').then(m => ({ default: m.SearchView })),
  logs: () => import('@/components/logs/LogsView').then(m => ({ default: m.LogsView })),
  statistics: () => import('@/components/torrents/TorrentStats').then(m => ({ default: m.StatisticsView })),
  settings: () => import('@/components/settings/SettingsView').then(m => ({ default: m.SettingsView })),
}
const PAGE_VIEWS: Record<PageId, ComponentType> = {
  torrents: TorrentsView,
  add: AddTorrentView,
  rss: lazy(LOADERS.rss),
  search: lazy(LOADERS.search),
  logs: lazy(LOADERS.logs),
  statistics: lazy(LOADERS.statistics),
  settings: lazy(LOADERS.settings),
}
const preloadPages = () => Object.values(LOADERS).forEach(load => void load())

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 5000, retry: 1 } } })

// Notifications rise just above the bars at the bottom: on phones above the tab bar, or the
// selection bar while torrents are selected, where the tap that caused them was; on wide screens in
// the corner, away from the selection bar and the page's buttons in the header. Swiped down to go.
const PHONE_TOAST_OFFSET = { bottom: 'calc(var(--bottom-nav-height, 0px) + var(--selection-bar-space, 0px) + 0.5rem)' }

function Screens() {
  const { status } = useSession()
  // A magnet link the page was opened for starts on the Add page.
  const [page, setPage] = useState<PageId>(() => (hasIncoming() ? 'add' : 'torrents'))
  const [selected, setSelected] = useState(page)
  // So do torrents dropped on the page or handed over later.
  useEffect(() => onIncoming(() => { setSelected('add'); setPage('add') }), [])

  // Once signed in, the other pages load while the browser is idle.
  useEffect(() => {
    if (status !== 'signedIn') return
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(preloadPages)
      return () => cancelIdleCallback(id)
    }
    const timer = setTimeout(preloadPages, 1000)
    return () => clearTimeout(timer)
  }, [status])

  if (status === 'checking') return <p className="grid min-h-dvh place-items-center text-sm text-muted-foreground">{t('Connecting...')}</p>
  if (status === 'signedOut') return <LoginForm />

  // Pages switch at once, like a phone's tab bar. As a transition, a page that still has to load
  // keeps the current one on screen until it's ready, instead of a loading message.
  // The tapped tab lights up straight away; its page follows once loaded.
  const navigate = (next: PageId) => {
    setSelected(next)
    startTransition(() => setPage(next))
  }
  const View = PAGE_VIEWS[page]
  return (
    <Layout page={selected} onNavigate={navigate}>
      {/* The reset key clears a page's error when switching away from it. */}
      <PageBoundary resetKey={page}>
        <View />
      </PageBoundary>
    </Layout>
  )
}

export default function App() {
  const wide = useMediaQuery('(min-width: 1200px)')
  useEffect(registerServiceWorker, [])
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position={wide ? 'bottom-right' : 'bottom-center'} offset={wide ? undefined : PHONE_TOAST_OFFSET} mobileOffset={PHONE_TOAST_OFFSET} />
      <HoverLabels />
      <SessionProvider>
        <Screens />
      </SessionProvider>
    </QueryClientProvider>
  )
}
