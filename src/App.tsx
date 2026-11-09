import { lazy, startTransition, useEffect, useState, type ComponentType } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { Layout } from '@/components/Layout'
import { LoginForm } from '@/components/LoginForm'
import { PageBoundary } from '@/components/PageBoundary'
import type { PageId } from '@/components/navigation'
import { TorrentsView } from '@/components/torrents/TorrentsView'
import { SessionProvider } from '@/components/SessionProvider'
import { useSession } from '@/hooks/useSession'
import { hasIncoming, onIncoming } from '@/lib/incoming'
import { registerServiceWorker } from '@/lib/notify'
import { t } from '@/i18n'

const named = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) => lazy(() => load().then(module => ({ default: module[name] })))

// The torrent list opens first, so it ships in the main script. The other pages load when opened.
const PAGE_VIEWS: Record<PageId, ComponentType> = {
  torrents: TorrentsView,
  add: named(() => import('@/components/torrents/AddTorrentView'), 'AddTorrentView'),
  rss: named(() => import('@/components/rss/RSSView'), 'RSSView'),
  search: named(() => import('@/components/search/SearchView'), 'SearchView'),
  logs: named(() => import('@/components/logs/LogsView'), 'LogsView'),
  settings: named(() => import('@/components/settings/SettingsView'), 'SettingsView'),
}

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 5000, retry: 1 } } })

// Notifications drop down over the header, clear of a phone's notch.
const TOAST_OFFSET = { top: 'calc(env(safe-area-inset-top) + 0.125rem)' }

function Screens() {
  const { status } = useSession()
  // A magnet link the page was opened for starts on the Add page.
  const [page, setPage] = useState<PageId>(() => (hasIncoming() ? 'add' : 'torrents'))
  const [selected, setSelected] = useState(page)
  // So do torrents dropped on the page or handed over later.
  useEffect(() => onIncoming(() => { setSelected('add'); setPage('add') }), [])

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
  useEffect(registerServiceWorker, [])
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-center" offset={TOAST_OFFSET} mobileOffset={TOAST_OFFSET} />
      <SessionProvider>
        <Screens />
      </SessionProvider>
    </QueryClientProvider>
  )
}
