import { useState, type FormEvent } from 'react'
import { Bookmark, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { TorrentList } from '@/hooks/useTorrentList'
import { saveFilterViews, sameFilters, upsertView, type FilterView } from '@/lib/filterViews'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface FilterViewsProps {
  list: TorrentList
  views: FilterView[]
  onViewsChange: (views: FilterView[]) => void
}

// Saved filters as buttons above the list. The one matching the current filters is marked.
export function FilterViewChips({ list, views, onViewsChange }: FilterViewsProps) {
  if (!views.length) return null
  const remove = (name: string) => {
    const next = views.filter(view => view.name !== name)
    saveFilterViews(next)
    onViewsChange(next)
  }
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('Saved views')}>
      <Button variant={list.filtered ? 'outline' : 'secondary'} size="sm" className="h-7 rounded-full px-3" aria-pressed={!list.filtered} onClick={list.clearFilters}>{t('All')}</Button>
      {views.map(view => {
        const active = sameFilters(view.filters, list.filters)
        return (
          <span key={view.name} className={cn('group inline-flex h-7 items-center rounded-full border text-sm', active ? 'border-transparent bg-secondary' : 'bg-background')}>
            <button type="button" className="pe-1 ps-3" aria-pressed={active} onClick={() => list.applyFilters(view.filters)}>{view.name}</button>
            <button type="button" className="me-1 rounded-full p-0.5 text-muted-foreground opacity-60 hover:bg-muted hover:opacity-100" aria-label={t('Remove the view {name}', { name: view.name })} title={t('Remove this view')} onClick={() => remove(view.name)}>
              <X className="size-3" />
            </button>
          </span>
        )
      })}
    </div>
  )
}

// Saves the current filters under a name, from the filter panel.
export function SaveViewButton({ list, views, onViewsChange }: FilterViewsProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const replacing = views.some(view => view.name.toLowerCase() === name.trim().toLowerCase())

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const next = upsertView(views, { name: name.trim(), filters: { ...list.filters, name: list.filters.name.trim() } })
    saveFilterViews(next)
    onViewsChange(next)
    setOpen(false)
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 rounded-full px-2.5" disabled={!list.filtered} title={list.filtered ? t('Save these filters as a view') : t('Choose some filters first')} onClick={() => { setName(''); setOpen(true) }}>
        <Bookmark className="size-4" />{t('Save as view')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('Save as view')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <Input aria-label={t('View name')} placeholder={t('For example: Downloading movies')} autoFocus maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
            {replacing && <p className="text-sm text-muted-foreground">{t('A view with this name exists. Saving replaces it.')}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('Cancel')}</Button>
              <Button type="submit" disabled={!name.trim()}><Save />{replacing ? t('Replace') : t('Save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
