import { useState, type FormEvent, type ReactNode } from 'react'
import { Activity, Bookmark, Filter, RefreshCw, Check, ChevronRight, CircleCheck, CircleOff, Download, Folder, FolderX, Globe, MoreHorizontal, Pause, Pencil, Plus, RotateCcw, Tag, Tags, TriangleAlert, Trash2, Upload, X, type LucideIcon } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AddFilterButton, ColumnFilterChips, type FilterTarget } from '@/components/ColumnFilters'
import { activeCount } from '@/lib/columnFilters'
import { useTorrentAction } from '@/hooks/useApi'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import { readStored, writeStored } from '@/lib/storage'
import { renameCategory, renameTag } from '@/lib/renameLabels'
import { parseTags, STATUS_FILTERS, toggleChoice, TRACKERLESS, UNCATEGORIZED, UNTAGGED, type FilterList, type StatusFilter } from '@/lib/torrentFilters'
import { cn } from '@/lib/utils'
import type { TorrentList } from '@/hooks/useTorrentList'
import { saveFilterViews, sameFilters, upsertView, type FilterView } from '@/lib/filterViews'
import type { Torrent, TorrentCategory } from '@/types'
import { SaveViewButton } from './FilterViews'
import { t } from '@/i18n'

// The names of the "none" choices, shown first in their sections.
const choiceLabel = (value: string) =>
  value === UNCATEGORIZED ? t('Uncategorized') : value === UNTAGGED ? t('Untagged') : value === TRACKERLESS ? t('No tracker') : value

const STATUS_ICONS: Record<StatusFilter, LucideIcon> = {
  downloading: Download, seeding: Upload, completed: CircleCheck, stopped: Pause, active: Activity, errored: TriangleAlert,
}

// Sections folded away stay folded on this device.
const FOLDED_KEY = 'qbminimal.filterSections'
const loadFolded = (): string[] => {
  try {
    const parsed: unknown = JSON.parse(readStored(FOLDED_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

// One choice: a tick box, its name and how many torrents it has, and for categories and tags a menu
// to change or delete it. The menu shows on hover with a mouse, and always on touch screens.
function FilterItem({ label, icon: Icon, count, checked, onToggle, muted, menu, single }: {
  label: string; icon: LucideIcon; count?: number; checked: boolean; onToggle: () => void; muted?: boolean; menu?: ReactNode
  // A saved view is one choice at a time: no tick box, just marked while it's in force.
  single?: boolean
}) {
  return (
    <li className={cn('group flex items-center rounded-md hover:bg-accent/60', single && checked && 'bg-secondary')}>
      <button type="button" role={single ? undefined : 'checkbox'} aria-checked={single ? undefined : checked} aria-pressed={single ? checked : undefined} onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-start text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
        {!single && (
          <span aria-hidden className={cn('flex size-4 shrink-0 items-center justify-center rounded-[4px] border', checked && 'border-primary bg-primary text-primary-foreground')}>
            {checked && <Check className="size-3" />}
          </span>
        )}
        <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className={cn('min-w-0 flex-1 truncate', muted && 'text-muted-foreground')} title={label}>{label}</span>
        {count !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{count}</span>}
      </button>
      {menu}
    </li>
  )
}

function ItemMenu({ name, children }: { name: string; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100" aria-label={t('More actions for {name}', { name })}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  )
}

function Section({ id, title, icon: Icon, chosen, folded, onFold, onAdd, addLabel, children }: {
  id: string; title: string; icon: LucideIcon; chosen: number; folded: boolean; onFold: (id: string) => void; onAdd?: () => void; addLabel?: string; children: ReactNode
}) {
  return (
    <section className="space-y-1">
      <div className="flex items-center gap-1">
        <button type="button" aria-expanded={!folded} onClick={() => onFold(id)} className="flex min-w-0 flex-1 items-center gap-1 rounded-md py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase hover:text-foreground">
          <ChevronRight className={cn('size-3.5 shrink-0 transition-transform', !folded && 'rotate-90')} />
          <Icon aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">{title}</span>
          {chosen > 0 && <span className="rounded-full bg-primary px-1.5 text-[0.7rem] leading-4 text-primary-foreground normal-case">{chosen}</span>}
        </button>
        {onAdd && (
          <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={addLabel} title={addLabel} onClick={onAdd}>
            <Plus className="size-4" />
          </Button>
        )}
      </div>
      {!folded && <ul className="space-y-px">{children}</ul>}
    </section>
  )
}

type Prompt =
  | { kind: 'newCategory' }
  | { kind: 'editCategory'; name: string; savePath: string }
  | { kind: 'deleteCategory'; name: string }
  | { kind: 'newTags' }
  | { kind: 'editTag'; name: string }
  | { kind: 'deleteTag'; name: string }
  | { kind: 'renameView'; name: string }

interface PromptDialogProps {
  prompt: Prompt | null
  onClose: () => void
  // Every torrent, to move them when a category or tag is renamed.
  torrents: readonly Torrent[]
  // The names already taken, which a new or renamed one can't use.
  taken: { categories: string[]; tags: string[]; views: string[] }
  onDeleted: (list: FilterList, value: string) => void
  onRenamed: (list: FilterList, from: string, to: string) => void
  onRenameView: (from: string, to: string) => void
}

// Creating, editing, renaming and deleting categories, tags and views, one small dialog at a time.
function PromptDialog({ prompt, onClose, torrents, taken, onDeleted, onRenamed, onRenameView }: PromptDialogProps) {
  const action = useTorrentAction()
  const [name, setName] = useState(prompt && 'name' in prompt ? prompt.name : '')
  const [path, setPath] = useState(prompt?.kind === 'editCategory' ? prompt.savePath : '')
  const run = (work: () => Promise<unknown>, failed: string, done: string, after?: () => void) =>
    action.mutateAsync({ work, failed }).then(() => { toast.success(done); after?.(); onClose() }, () => undefined)
  const clash = (list: string[], from?: string) => {
    const wanted = name.trim()
    return wanted !== from && list.some(existing => existing.toLowerCase() === wanted.toLowerCase())
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!prompt) return
    const wanted = name.trim()
    if (prompt.kind === 'newCategory' || prompt.kind === 'editCategory') {
      if (!wanted) return void toast.error(t('Enter a category name'))
      const from = prompt.kind === 'editCategory' ? prompt.name : undefined
      if (clash(taken.categories, from)) return void toast.error(t('There is already a category called {name}', { name: wanted }))
      if (!from) void run(() => qbitClient.createCategory(wanted, path.trim()), t('Failed to create category'), t('Category created'))
      else if (wanted === from) void run(() => qbitClient.editCategory(from, path.trim()), t('Failed to change category'), t('Category saved'))
      else void run(() => renameCategory(qbitClient, torrents, from, wanted, path.trim()), t('Failed to change category'), t('Category saved'), () => onRenamed('categories', from, wanted))
    } else if (prompt.kind === 'newTags') {
      const tags = parseTags(name)
      if (!tags.length) return void toast.error(t('Enter at least one tag'))
      void run(() => qbitClient.createTags(tags), t('Failed to create tags'), tags.length === 1 ? t('Tag created') : t('Tags created'))
    } else if (prompt.kind === 'editTag') {
      if (!wanted || wanted.includes(',')) return void toast.error(t('Enter at least one tag'))
      if (wanted === prompt.name) return onClose()
      if (clash(taken.tags, prompt.name)) return void toast.error(t('There is already a tag called {name}', { name: wanted }))
      void run(() => renameTag(qbitClient, torrents, prompt.name, wanted), t('Failed to rename tag'), t('Tag renamed'), () => onRenamed('tags', prompt.name, wanted))
    } else if (prompt.kind === 'renameView') {
      if (!wanted) return
      if (clash(taken.views, prompt.name)) return void toast.error(t('There is already a view called {name}', { name: wanted }))
      onRenameView(prompt.name, wanted)
      onClose()
    } else if (prompt.kind === 'deleteCategory') {
      void run(() => qbitClient.removeCategories([prompt.name]), t('Failed to delete category'), t('Category deleted'), () => onDeleted('categories', prompt.name))
    } else {
      void run(() => qbitClient.deleteTags([prompt.name]), t('Failed to delete tag'), t('Tag deleted'), () => onDeleted('tags', prompt.name))
    }
  }

  const deleting = prompt?.kind === 'deleteCategory' || prompt?.kind === 'deleteTag'
  const creating = prompt?.kind === 'newCategory' || prompt?.kind === 'newTags'
  const title = !prompt ? '' : prompt.kind === 'newCategory' ? t('New category') : prompt.kind === 'editCategory' ? t('Edit category')
    : prompt.kind === 'newTags' ? t('New tags') : prompt.kind === 'editTag' ? t('Rename tag') : prompt.kind === 'renameView' ? t('Rename view')
    : prompt.kind === 'deleteCategory' ? t('Delete the {name} category?', { name: prompt.name })
    : t('Delete the {tag} tag?', { tag: prompt.name })
  const nameLabel = prompt?.kind === 'newCategory' ? t('New category name') : prompt?.kind === 'newTags' ? t('New tags, separated by commas') : t('Name')
  return (
    <Dialog open={!!prompt} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className={cn(!deleting && prompt?.kind !== 'editTag' && 'sr-only')}>
              {prompt?.kind === 'deleteCategory' ? t('Torrents in it will have no category. Their files stay where they are.')
                : prompt?.kind === 'deleteTag' ? t('It will be removed from every torrent.')
                : prompt?.kind === 'editTag' ? t('Every torrent with this tag gets the new name.')
                : title}
            </DialogDescription>
          </DialogHeader>
          {!deleting && (
            <div className="grid gap-1.5">
              <Label htmlFor="prompt-name" className="text-xs text-muted-foreground">{nameLabel}</Label>
              <Input id="prompt-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          {(prompt?.kind === 'newCategory' || prompt?.kind === 'editCategory') && (
            <div className="grid gap-1.5">
              <Label htmlFor="category-save-path" className="text-xs text-muted-foreground">{t('Save path (blank = default)')}</Label>
              <Input id="category-save-path" value={path} onChange={(e) => setPath(e.target.value)} />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('Cancel')}</Button>
            <Button type="submit" variant={deleting ? 'destructive' : 'default'} disabled={action.isPending}>
              {deleting ? <Trash2 /> : creating ? <Plus /> : <Pencil />}
              {deleting ? t('Delete') : creating ? t('Create') : t('Save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface FilterSidebarProps {
  list: TorrentList
  torrents: readonly Torrent[]
  categories: Record<string, TorrentCategory>
  tags: string[]
  views: FilterView[]
  onViewsChange: (views: FilterView[]) => void
  columnTargets: FilterTarget[]
  onClose: () => void
}

// Saved views, then status, categories, tags and trackers, each with tick boxes for any number of
// choices and a count of the torrents each would show. Views, categories and tags can be added,
// renamed, changed and deleted right here.
export function FilterSidebar({ list, torrents, categories, tags, views, onViewsChange, columnTargets, onClose }: FilterSidebarProps) {
  const { filters, counts, trackerHosts } = list
  const [folded, setFolded] = useState(loadFolded)
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const fold = (id: string) => setFolded(current => {
    const next = toggleChoice(current, id)
    writeStored(FOLDED_KEY, next.length ? JSON.stringify(next) : null)
    return next
  })
  const chosen = (key: FilterList, value: string) => (filters[key] as string[]).includes(value)
  const item = (key: FilterList, value: string, icon: LucideIcon, count: number, menu?: ReactNode, label = choiceLabel(value)) => (
    <FilterItem key={value} icon={icon} label={label} muted={value.startsWith('\u0000')} count={count} checked={chosen(key, value)} onToggle={() => list.toggleFilter(key, value)} menu={menu} />
  )
  // A deleted category or tag can't stay chosen, or it would hide every torrent.
  const forget = (key: FilterList, value: string) => { if (chosen(key, value)) list.toggleFilter(key, value) }
  // The quick search narrows the views by name too.
  const query = list.query.trim().toLowerCase()
  const shownViews = query ? views.filter(view => view.name.toLowerCase().includes(query)) : views
  const changeViews = (next: FilterView[]) => {
    saveFilterViews(next)
    onViewsChange(next)
  }
  // A renamed category or tag stays chosen under its new name.
  const renamed = (key: FilterList, from: string, to: string) => {
    if (chosen(key, from)) list.applyFilters({ ...filters, [key]: (filters[key] as string[]).map(value => (value === from ? to : value)) })
  }
  const renameView = (from: string, to: string) => changeViews(views.map(view => (view.name === from ? { ...view, name: to } : view)))
  const updateView = (name: string) => {
    changeViews(upsertView(views, { name, filters: { ...filters, name: filters.name.trim() } }))
    toast.success(t('View updated'))
  }
  const removeView = (name: string) => changeViews(views.filter(view => view.name !== name))
  const categoryNames = Object.keys(categories).sort((a, b) => a.localeCompare(b))
  const tagNames = [...tags].sort((a, b) => a.localeCompare(b))

  return (
    <div id="torrent-filters" className="space-y-3">
      <div className="flex items-center gap-1">
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium">{t('Filters')}</h3>
        <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0 rounded-full bg-muted hover:bg-accent" aria-label={t('Close filters')} title={t('Close filters')} onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <SaveViewButton list={list} views={views} onViewsChange={onViewsChange} />
        {/* Clears every filter, the column filters included. */}
        <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 rounded-full px-2.5" disabled={!list.filtered} onClick={list.clearFilters}>
          <RotateCcw className="size-4" />
          {t('Reset filters')}
        </Button>
        <span className="ms-auto"><AddFilterButton targets={columnTargets} onChange={list.setColumnFilter} /></span>
      </div>

      {shownViews.length > 0 && (
        <Section id="views" title={t('Views')} icon={Bookmark} chosen={0} folded={folded.includes('views')} onFold={fold}>
          {shownViews.map(view => {
            const active = sameFilters(view.filters, filters)
            return (
              <FilterItem
                key={view.name}
                single
                icon={Bookmark}
                label={view.name}
                checked={active}
                // Picking the view in force again goes back to every torrent.
                onToggle={() => (active ? list.clearFilters() : list.applyFilters(view.filters))}
                menu={(
                  <ItemMenu name={view.name}>
                    <DropdownMenuItem onClick={() => setPrompt({ kind: 'renameView', name: view.name })}><Pencil />{t('Rename')}</DropdownMenuItem>
                    <DropdownMenuItem disabled={active} onClick={() => updateView(view.name)}><RefreshCw />{t('Save the current filters in it')}</DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => removeView(view.name)}><Trash2 />{t('Remove this view')}</DropdownMenuItem>
                  </ItemMenu>
                )}
              />
            )
          })}
        </Section>
      )}

      {/* Filters set from the table's column titles or the funnel above, each opening its editor. */}
      {activeCount(filters.columns) > 0 && (
        <Section id="columns" title={t('Column filters')} icon={Filter} chosen={activeCount(filters.columns)} folded={folded.includes('columns')} onFold={fold}>
          <li><ColumnFilterChips targets={columnTargets} filters={filters.columns ?? {}} onChange={list.setColumnFilter} className="gap-1.5" /></li>
        </Section>
      )}

      <Section id="status" title={t('Status')} icon={Activity} chosen={filters.statuses.length} folded={folded.includes('status')} onFold={fold}>
        {STATUS_FILTERS.map(({ value, label }) => item('statuses', value, STATUS_ICONS[value], counts.status[value], undefined, label))}
      </Section>

      <Section id="categories" title={t('Categories')} icon={Folder} chosen={filters.categories.length} folded={folded.includes('categories')} onFold={fold} onAdd={() => setPrompt({ kind: 'newCategory' })} addLabel={t('New category')}>
        {item('categories', UNCATEGORIZED, FolderX, counts.category[UNCATEGORIZED] ?? 0)}
        {categoryNames.map(name => item('categories', name, Folder, counts.category[name] ?? 0, (
          <ItemMenu name={name}>
            <DropdownMenuItem onClick={() => setPrompt({ kind: 'editCategory', name, savePath: categories[name]?.savePath ?? '' })}><Pencil />{t('Edit category')}</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setPrompt({ kind: 'deleteCategory', name })}><Trash2 />{t('Delete')}</DropdownMenuItem>
          </ItemMenu>
        )))}
      </Section>

      <Section id="tags" title={t('Tags')} icon={Tags} chosen={filters.tags.length} folded={folded.includes('tags')} onFold={fold} onAdd={() => setPrompt({ kind: 'newTags' })} addLabel={t('New tags')}>
        {item('tags', UNTAGGED, CircleOff, counts.tag[UNTAGGED] ?? 0)}
        {tagNames.map(name => item('tags', name, Tag, counts.tag[name] ?? 0, (
          <ItemMenu name={name}>
            <DropdownMenuItem onClick={() => setPrompt({ kind: 'editTag', name })}><Pencil />{t('Rename')}</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setPrompt({ kind: 'deleteTag', name })}><Trash2 />{t('Delete')}</DropdownMenuItem>
          </ItemMenu>
        )))}
      </Section>

      <Section id="trackers" title={t('Trackers')} icon={Globe} chosen={filters.trackers.length} folded={folded.includes('trackers')} onFold={fold}>
        {item('trackers', TRACKERLESS, CircleOff, counts.trackerless)}
        {trackerHosts.map(host => item('trackers', host, Globe, counts.tracker[host] ?? 0))}
      </Section>

      {/* Keyed so each prompt starts with empty fields, or the category's own save path. */}
      <PromptDialog
        key={prompt ? JSON.stringify(prompt) : 'none'}
        prompt={prompt}
        onClose={() => setPrompt(null)}
        torrents={torrents}
        taken={{ categories: categoryNames, tags: tagNames, views: views.map(view => view.name) }}
        onDeleted={forget}
        onRenamed={renamed}
        onRenameView={renameView}
      />
    </div>
  )
}

// On phones the sidebar slides in from the end edge, under the filter button, over the list.
export function FilterSheet({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          // The search field takes focus only where there's a keyboard.
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed inset-y-0 end-0 z-50 w-80 max-w-[85vw] overflow-y-auto border-s bg-background p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg outline-hidden data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right rtl:data-[state=open]:slide-in-from-left rtl:data-[state=closed]:slide-out-to-left"
        >
          <DialogPrimitive.Title className="sr-only">{t('Filters')}</DialogPrimitive.Title>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
