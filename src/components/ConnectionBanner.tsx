import { useSyncExternalStore } from 'react'
import { Loader2, WifiOff } from 'lucide-react'
import { useConnectionProblem } from '@/hooks/useApi'
import { t } from '@/i18n'

const subscribeOnline = (onChange: () => void) => {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

// Says so when the numbers on screen have stopped updating, instead of leaving them frozen.
export function ConnectionBanner() {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine)
  const unreachable = useConnectionProblem()
  if (online && !unreachable) return null

  return (
    <div role="status" className="flex items-center justify-center gap-2 border-t bg-amber-500/15 px-4 py-1.5 text-center text-xs text-amber-800 dark:text-amber-200">
      {online ? <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden /> : <WifiOff className="size-3.5 shrink-0" aria-hidden />}
      {online
        ? t('Can\'t reach qBittorrent. Trying again, and what you see may be out of date.')
        : t('You\'re offline. The list updates again when you\'re back online.')}
    </div>
  )
}
