import { useState, type FormEvent } from 'react'
import { Bookmark, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { TorrentList } from '@/hooks/useTorrentList'
import { saveFilterViews, upsertView, type FilterView } from '@/lib/filterViews'
import { t } from '@/i18n'

interface FilterViewsProps {
  list: TorrentList
  views: FilterView[]
  onViewsChange: (views: FilterView[]) => void
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
      <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 rounded-full px-2.5 has-[>svg]:pe-1.5" disabled={!list.filtered} title={list.filtered ? t('Save these filters as a view') : t('Choose some filters first')} onClick={() => { setName(''); setOpen(true) }}>
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
