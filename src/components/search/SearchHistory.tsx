import { X } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import { readSearchPatterns } from '@/lib/searchPatterns'
import { t } from '@/i18n'

// Searches qBittorrent still holds. Each can be reopened or deleted.
export function SearchHistory({ activeId, onOpen }: { activeId: number | null; onOpen: (id: number) => void }) {
  const queryClient = useQueryClient()
  const { data: searches } = useQuery({ queryKey: ['search', 'status'], queryFn: () => qbitClient.getSearchStatus(), refetchInterval: 5000 })
  if (!searches?.length) return null
  const patterns = readSearchPatterns()

  const remove = async (id: number) => {
    try {
      await qbitClient.deleteSearch(id)
      queryClient.invalidateQueries({ queryKey: ['search', 'status'] })
    } catch (e) {
      toast.error(t('Couldn\'t delete the search'), { description: e instanceof Error ? e.message : undefined })
    }
  }

  return (
    <div className="space-y-1">
      <h3 className="text-xs text-muted-foreground">{t('Searches in qBittorrent')}</h3>
      <ul className="flex flex-wrap gap-2">
        {[...searches].reverse().map(search => (
          <li key={search.id} className={`flex items-center rounded-md border text-xs ${activeId === search.id ? 'border-primary' : ''}`}>
            <button type="button" className="px-2 py-1 text-start" onClick={() => onOpen(search.id)}>
              {patterns[search.id] ?? t('Search {id}', { id: search.id })} · {search.total} {search.status === 'Running' ? t('(running)') : ''}
            </button>
            <Button type="button" variant="ghost" size="icon" className="size-6" aria-label={t('Delete search {value}', { value: patterns[search.id] ?? search.id })} title={t('Delete')} onClick={() => remove(search.id)}>
              <X className="size-3" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
