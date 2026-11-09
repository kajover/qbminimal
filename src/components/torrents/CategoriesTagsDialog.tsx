import { useState, type FormEvent } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { ConfirmAction } from '@/components/ConfirmAction'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCategories, useTags, useTorrentAction } from '@/hooks/useApi'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import { parseTags } from '@/lib/torrentFilters'
import type { TorrentCategory } from '@/types'
import { t } from '@/i18n'

function CategoryRow({ category }: { category: TorrentCategory }) {
  const action = useTorrentAction()
  const [editing, setEditing] = useState(false)
  const [savePath, setSavePath] = useState(category.savePath ?? '')

  const save = (e: FormEvent) => {
    e.preventDefault()
    action.mutateAsync({ work: () => qbitClient.editCategory(category.name, savePath.trim()), failed: t('Failed to change category') })
      .then(() => { setEditing(false); toast.success(t('Category saved')) }, () => undefined)
  }

  if (editing) {
    return (
      <li className="py-2">
        <form onSubmit={save} className="space-y-2">
          <Label htmlFor={`category-path-${category.name}`} className="text-xs text-muted-foreground">{t('Save path for {name} (blank = default)', { name: category.name })}</Label>
          <Input id={`category-path-${category.name}`} value={savePath} autoFocus onChange={(e) => setSavePath(e.target.value)} className="h-8 text-sm" />
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="outline" disabled={action.isPending}>{t('Save')}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>{t('Cancel')}</Button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className="flex items-start gap-1 py-2">
      <div className="min-w-0 flex-1">
        <p className="break-words">{category.name}</p>
        <p className="break-all text-xs text-muted-foreground">{category.savePath || t('Default save path')}</p>
      </div>
      <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" aria-label={t('Edit {name}', { name: category.name })} title={t('Edit category')} onClick={() => { setSavePath(category.savePath ?? ''); setEditing(true) }}>
        <Pencil className="size-3.5" />
      </Button>
      <ConfirmAction
        label={t('Delete {name}', { name: category.name })}
        title={t('Delete the {name} category?', { name: category.name })}
        message={t('Torrents in it will have no category. Their files stay where they are.')}
        confirmLabel={t('Delete')}
        disabled={action.isPending}
        onConfirm={() => action.mutateAsync({ work: () => qbitClient.removeCategories([category.name]), failed: t('Failed to delete category') })
          .then(() => { toast.success(t('Category deleted')) }, () => undefined)}
      >
        <Trash2 className="size-3.5" />
      </ConfirmAction>
    </li>
  )
}

export function CategoriesTagsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: categories } = useCategories()
  const { data: tags } = useTags()
  const action = useTorrentAction()
  const [newCategory, setNewCategory] = useState('')
  const [newCategoryPath, setNewCategoryPath] = useState('')
  const [newTags, setNewTags] = useState('')

  const addCategory = (e: FormEvent) => {
    e.preventDefault()
    const name = newCategory.trim()
    if (!name) {
      toast.error(t('Enter a category name'))
      return
    }
    action.mutateAsync({ work: () => qbitClient.createCategory(name, newCategoryPath.trim()), failed: t('Failed to create category') })
      .then(() => { setNewCategory(''); setNewCategoryPath(''); toast.success(t('Category created')) }, () => undefined)
  }

  const addTags = (e: FormEvent) => {
    e.preventDefault()
    const list = parseTags(newTags)
    if (list.length === 0) {
      toast.error(t('Enter at least one tag'))
      return
    }
    action.mutateAsync({ work: () => qbitClient.createTags(list), failed: t('Failed to create tags') })
      .then(() => { setNewTags(''); toast.success(list.length === 1 ? t('Tag created') : t('Tags created')) }, () => undefined)
  }

  const categoryList = Object.values(categories ?? {}).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-lg flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t('Categories and tags')}</DialogTitle>
          <DialogDescription>{t('Changes apply to every torrent.')}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto text-sm">
          <section className="space-y-2">
            <h3 className="font-medium">{t('Categories')}</h3>
            {categoryList.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('No categories')}</p>
            ) : (
              <ul className="divide-y">{categoryList.map(category => <CategoryRow key={category.name} category={category} />)}</ul>
            )}
            <form onSubmit={addCategory} className="space-y-2 border-t pt-3">
              <Input aria-label={t('New category name')} placeholder={t('New category name')} value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="h-8 text-sm" />
              <Input aria-label={t('Save path for the new category')} placeholder={t('Save path (blank = default)')} value={newCategoryPath} onChange={(e) => setNewCategoryPath(e.target.value)} className="h-8 text-sm" />
              <Button type="submit" size="sm" variant="outline" disabled={action.isPending}>{t('Create category')}</Button>
            </form>
          </section>

          <section className="space-y-2">
            <h3 className="font-medium">{t('Tags')}</h3>
            {!tags?.length ? (
              <p className="text-xs text-muted-foreground">{t('No tags')}</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <li key={tag} className="flex items-center gap-0.5 rounded-md border ps-2">
                    <span className="break-all">{tag}</span>
                    <ConfirmAction
                      label={t('Delete tag {tag}', { tag })}
                      title={t('Delete the {tag} tag?', { tag })}
                      message={t('It will be removed from every torrent.')}
                      confirmLabel={t('Delete')}
                      disabled={action.isPending}
                      onConfirm={() => action.mutateAsync({ work: () => qbitClient.deleteTags([tag]), failed: t('Failed to delete tag') })
                        .then(() => { toast.success(t('Tag deleted')) }, () => undefined)}
                    >
                      <Trash2 className="size-3.5" />
                    </ConfirmAction>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={addTags} className="flex gap-2 border-t pt-3">
              <Input aria-label={t('New tags, separated by commas')} placeholder={t('New tags, separated by commas')} value={newTags} onChange={(e) => setNewTags(e.target.value)} className="h-8 text-sm" />
              <Button type="submit" size="sm" variant="outline" disabled={action.isPending}>{t('Create')}</Button>
            </form>
          </section>
        </div>

        <div className="flex justify-end border-t pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('Close')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
