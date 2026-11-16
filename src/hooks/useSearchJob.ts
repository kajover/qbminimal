import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import { forgetSearches, keepSearchesOn, readSavedSearches, rememberSearch } from '@/lib/searchPatterns'
import { t } from '@/i18n'

// Searches longer than this are stopped, keeping what they found.
const TIME_LIMIT_MS = 60_000
// A click this soon after a search ends was meant to stop it, not to search again.
const STOP_GRACE_MS = 800

interface Job {
  id: number
  running: boolean
  startedAt: number
}

// Runs a qBittorrent search: starts it and polls its results every second until it finishes or
// times out. Plugin errors aren't repeated here: qBittorrent writes them to its log.
export function useSearchJob() {
  const queryClient = useQueryClient()
  const [job, setJob] = useState<Job | null>(null)
  const endedAt = useRef(0)

  const finish = (current: Job) => {
    endedAt.current = Date.now()
    setJob({ ...current, running: false })
    void queryClient.invalidateQueries({ queryKey: ['search', 'status'] })
  }

  const results = useQuery({
    queryKey: ['search', 'results', job?.id],
    enabled: !!job,
    refetchInterval: job?.running ? 1000 : false,
    queryFn: async () => {
      const current = job!
      const data = await qbitClient.getSearchResults(current.id)
      if (current.running) {
        if (data.status === 'Stopped' || data.status === 'Completed') {
          finish(current)
        } else if (Date.now() - current.startedAt > TIME_LIMIT_MS) {
          await qbitClient.stopSearch(current.id).catch(() => undefined)
          toast.warning(t('The search ran for a minute, so it was stopped. These are the results so far.'))
          finish(current)
        }
      }
      return data.results ?? []
    },
  })

  // With saved searches turned off, only the newest search stays in qBittorrent.
  const deleteOthers = async (keep: number) => {
    const others = (await qbitClient.getSearchStatus().catch(() => [])).map(search => search.id).filter(id => id !== keep)
    await Promise.allSettled(others.map(id => qbitClient.deleteSearch(id)))
    // Also drops texts kept from searches qBittorrent no longer has.
    forgetSearches(Object.keys(readSavedSearches()).map(Number).filter(id => id !== keep))
    void queryClient.invalidateQueries({ queryKey: ['search', 'status'] })
  }

  // Says whether the search started.
  const start = async (pattern: string, plugins: string, category: string) => {
    // Checked first only to explain a search that can't find anything.
    const installed = await qbitClient.searchPlugins().catch(() => null)
    if (installed && !installed.some(plugin => plugin.enabled)) {
      toast.error(installed.length ? t('Every search plugin is turned off. Turn one on under Manage plugins.') : t('No search plugins are installed. Add one under Manage plugins.'))
      return false
    }
    try {
      const { id } = await qbitClient.startSearch(pattern, plugins, category)
      rememberSearch(id, { pattern, plugins, category })
      setJob({ id, running: true, startedAt: Date.now() })
      if (!keepSearchesOn()) void deleteOthers(id)
      void queryClient.invalidateQueries({ queryKey: ['search', 'status'] })
      return true
    } catch (error) {
      toast.error(t('Search failed.'), { description: error instanceof Error ? error.message : undefined })
      return false
    }
  }

  const cancel = async () => {
    if (!job?.running) return
    endedAt.current = Date.now()
    setJob({ ...job, running: false })
    try {
      await qbitClient.stopSearch(job.id)
      void queryClient.invalidateQueries({ queryKey: ['search', 'status'] })
      toast.info(t('Search stopped'))
    } catch {
      toast.error(t('Couldn\'t stop the search in qBittorrent'))
    }
  }

  // Shows the results of a search qBittorrent still holds.
  const open = (id: number) => setJob({ id, running: false, startedAt: Date.now() })
  // Clears the results, for when their search was deleted.
  const close = () => setJob(null)

  return {
    jobId: job?.id ?? null,
    running: !!job?.running,
    searched: !!job,
    results: results.data ?? [],
    start,
    cancel,
    open,
    close,
    justEnded: () => Date.now() - endedAt.current < STOP_GRACE_MS,
  }
}
