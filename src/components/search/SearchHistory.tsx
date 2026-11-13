import { RefreshCw, Trash2, X } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { ConfirmAction } from '@/components/ConfirmAction'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import { forgetSearches, keepSearchesOn, readSavedSearches, type SavedSearch } from '@/lib/searchPatterns'
import { t } from '@/i18n'

interface SearchHistoryProps {
  activeId: number | null
  // A search is running, so another can't start.
  busy: boolean
  onOpen: (id: number) => void
  // Starts the same search again and says whether it started.
  onRun: (search: SavedSearch) => Promise<boolean>
  onCleared: () => void
}

// Searches qBittorrent still holds. Each can be reopened, run again for fresh results, or deleted.
export function SearchHistory({ activeId, busy, onOpen, onRun, onCleared }: SearchHistoryProps) {
  const queryClient = useQueryClient()
  const { data: searches } = useQuery({ queryKey: ['search', 'status'], queryFn: () => qbitClient.getSearchStatus(), refetchInterval: 5000 })
  if (!searches?.length || !keepSearchesOn()) return null
  const saved = readSavedSearches()
  const name = (id: number) => saved[id]?.pattern ?? t('Search {id}', { id })

  const remove = async (id: number) => {
    try {
      await qbitClient.deleteSearch(id)
      forgetSearches([id])
      void queryClient.invalidateQueries({ queryKey: ['search', 'status'] })
    } catch (e) {
      toast.error(t('Couldn\'t delete the search'), { description: e instanceof Error ? e.message : undefined })
    }
  }

  // The new search replaces the old one, so the list doesn't fill up with the same text.
  const runAgain = async (id: number, search: SavedSearch) => {
    if (await onRun(search)) await remove(id)
  }

  const clear = async () => {
    const ids = searches.map(search => search.id)
    const outcomes = await Promise.allSettled(ids.map(id => qbitClient.deleteSearch(id)))
    forgetSearches(ids.filter((_, i) => outcomes[i].status === 'fulfilled'))
    void queryClient.invalidateQueries({ queryKey: ['search', 'status'] })
    onCleared()
    if (outcomes.some(outcome => outcome.status === 'rejected')) toast.error(t('Couldn\'t delete every search'))
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs text-muted-foreground">{t('Searches in qBittorrent')}</h3>
        <ConfirmAction
          label={t('Delete every search')}
          title={t('Delete every search?')}
          message={t('qBittorrent forgets these searches and their results.')}
          confirmLabel={t('Delete all')}
          buttonLabel={t('Clear all')}
          buttonIcon={Trash2}
          onConfirm={() => void clear()}
        />
      </div>
      <ul className="flex flex-wrap gap-2">
        {[...searches].reverse().map(search => (
          <li key={search.id} className={`flex items-center rounded-md border text-xs ${activeId === search.id ? 'border-primary' : ''}`}>
            <button type="button" className="px-2 py-1 text-start" onClick={() => onOpen(search.id)}>
              {name(search.id)} · {search.total} {search.status === 'Running' ? t('(running)') : ''}
            </button>
            {saved[search.id] && (
              <Button type="button" variant="ghost" size="icon" className="size-6" disabled={busy} aria-label={t('Run {value} again', { value: name(search.id) })} title={t('Run again')} onClick={() => void runAgain(search.id, saved[search.id])}>
                <RefreshCw className="size-3" />
              </Button>
            )}
            <Button type="button" variant="ghost" size="icon" className="size-6" aria-label={t('Delete search {value}', { value: name(search.id) })} title={t('Delete')} onClick={() => remove(search.id)}>
              <X className="size-3" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
