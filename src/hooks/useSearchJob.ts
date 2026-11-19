import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import { forgetSearches, keepSearchesOn, readSavedSearches, rememberSearch } from '@/lib/searchPatterns'
import { t } from '@/i18n'

// Searches longer than this are stopped, keeping what they found.
const TIME_LIMIT_MS = 60_000
// A click this soon after a search ends was meant to stop it, not to search again: as long as a
// double click, so a new search can start right after stopping one.
const STOP_GRACE_MS = 400

interface Job {
  id: number
  running: boolean
  startedAt: number
}

// The search shown, with its text and category, kept while the app is open so it's still there
// after going to another page and back. When each search began, so one opened again while running
// keeps its time limit.
let shown: { job: Job; pattern: string; category: string } | null = null
const startTimes = new Map<number, number>()
// For tests, which each start without a search shown.
export const forgetShownSearch = () => { shown = null }

// Runs a qBittorrent search: starts it and polls its results every second until it finishes or
// times out. Plugin errors aren't repeated here: qBittorrent writes them to its log.
export function useSearchJob() {
  const queryClient = useQueryClient()
  const [job, setJobState] = useState<Job | null>(() => shown?.job ?? null)
  const setJob = (next: Job | null, text?: { pattern: string; category: string }) => {
    shown = next ? { job: next, pattern: text?.pattern ?? shown?.pattern ?? '', category: text?.category ?? shown?.category ?? 'all' } : null
    setJobState(next)
  }
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
      startTimes.set(id, Date.now())
      setJob({ id, running: true, startedAt: Date.now() }, { pattern, category })
      if (!keepSearchesOn()) void deleteOthers(id)
      void queryClient.invalidateQueries({ queryKey: ['search', 'status'] })
      return true
    } catch (error) {
      toast.error(t('Search failed.'), { description: error instanceof Error ? error.message : undefined })
      return false
    }
  }

  // Stopping shows at once on the button, so there's no notification, and a new search can start
  // right away.
  const cancel = async () => {
    if (!job?.running) return
    endedAt.current = Date.now()
    setJob({ ...job, running: false })
    try {
      await qbitClient.stopSearch(job.id)
      void queryClient.invalidateQueries({ queryKey: ['search', 'status'] })
    } catch {
      toast.error(t('Couldn\'t stop the search in qBittorrent'))
    }
  }

  // Shows the results of a search qBittorrent still holds. One still running is followed again until
  // it ends; another search left running carries on in qBittorrent meanwhile.
  const open = (id: number, running = false) => {
    const saved = readSavedSearches()[id]
    setJob({ id, running, startedAt: startTimes.get(id) ?? Date.now() }, saved && { pattern: saved.pattern, category: saved.category })
  }
  // Clears the results, for when their search was deleted or the Clear button was used.
  const close = () => setJob(null)

  return {
    jobId: job?.id ?? null,
    // The text and category of the search shown when the page opened, for its form.
    pattern: shown?.pattern ?? '',
    category: shown?.category ?? 'all',
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
