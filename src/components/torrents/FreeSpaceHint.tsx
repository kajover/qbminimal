import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useApiFeature, usePreferences } from '@/hooks/useApi'
import { qbitClient } from '@/lib/api'
import { formatBytes } from '@/lib/format'
import { t } from '@/i18n'

// How much room the chosen save path has. Needs Web API 2.15.2, so it shows nothing on older versions.
export function FreeSpaceHint({ path }: { path: string }) {
  const supported = useApiFeature('freeSpaceAtPath')
  const { data: prefs } = usePreferences()
  const target = path.trim() || (typeof prefs?.save_path === 'string' ? prefs.save_path : '')
  // Waits for typing to pause before asking.
  const [settled, setSettled] = useState(target)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(target), 500)
    return () => clearTimeout(timer)
  }, [target])

  const { data: free } = useQuery({
    queryKey: ['app', 'freeSpace', settled],
    queryFn: () => qbitClient.getFreeSpaceAtPath(settled),
    enabled: supported && !!settled,
    staleTime: 30_000,
    retry: false,
  })

  if (!supported || free === undefined || !Number.isFinite(free) || free < 0) return null
  return <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{t('{size} free', { size: formatBytes(free) })}</span>
}
