import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import { getSearchEngineError } from '@/lib/searchErrors'
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
  // The newest log warning before the search, to spot the plugin errors it causes. null when
  // the log couldn't be read, or when reopening an older search.
  logMark: number | null
}

// Runs a qBittorrent search: starts it, polls its results every second until it finishes or
// times out, and reports plugin errors qBittorrent only writes to its log.
export function useSearchJob() {
  const queryClient = useQueryClient()
  const [job, setJob] = useState<Job | null>(null)
  const endedAt = useRef(0)

  const finish = async (current: Job, found: number) => {
    endedAt.current = Date.now()
    setJob({ ...current, running: false })
    void queryClient.invalidateQueries({ queryKey: ['search', 'status'] })
    if (current.logMark === null) return
    // qBittorrent logs one error per failed search, without naming the plugin.
    const warnings = await qbitClient.getLogWarnings(current.logMark).catch(() => [])
    const problem = warnings.map(entry => getSearchEngineError(entry.message)).find(Boolean)
    if (!problem) return
    if (found > 0) toast.warning(t('A search plugin failed, so results may be incomplete.'), { description: problem })
    else toast.error(t('Search failed.'), { description: problem })
  }

  const results = useQuery({
    queryKey: ['search', 'results', job?.id],
    enabled: !!job,
    refetchInterval: job?.running ? 1000 : false,
    queryFn: async () => {
      const current = job!
      const data = await qbitClient.getSearchResults(current.id)
      const found = data.results?.length ?? 0
      if (current.running) {
        if (data.status === 'Stopped' || data.status === 'Completed') {
          void finish(current, found)
        } else if (Date.now() - current.startedAt > TIME_LIMIT_MS) {
          await qbitClient.stopSearch(current.id).catch(() => undefined)
          toast.warning(t('The search ran for a minute, so it was stopped. These are the results so far.'))
          void finish({ ...current, logMark: null }, found)
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
      const warnings = await qbitClient.getLogWarnings().catch(() => null)
      const { id } = await qbitClient.startSearch(pattern, plugins, category)
      rememberSearch(id, { pattern, plugins, category })
      setJob({ id, running: true, startedAt: Date.now(), logMark: warnings ? warnings.at(-1)?.id ?? -1 : null })
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
  const open = (id: number) => setJob({ id, running: false, startedAt: Date.now(), logMark: null })
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
