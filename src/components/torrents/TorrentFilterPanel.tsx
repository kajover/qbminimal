import { useState, type FormEvent, type ReactNode } from 'react'
import { Activity, Bookmark, Filter, RefreshCw, CircleOff, Eye, EyeOff, Folder, FolderX, Globe, Pencil, Plus, Tag, Tags, Trash2, type LucideIcon } from 'lucide-react'
import { FilterItem, ItemMenu, NothingMatches, Section, SidebarHeader } from '@/components/FilterSidebarParts'
import { useSidebarSections } from '@/hooks/useSidebarSections'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AddFilterButton, ColumnFilterChips, type FilterTarget } from '@/components/ColumnFilters'
import { activeCount } from '@/lib/columnFilters'
import { useTorrentAction } from '@/hooks/useApi'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import { readStored, writeStored } from '@/lib/storage'
import { renameCategory, renameTag } from '@/lib/renameLabels'
import { choiceState, chosenCount, parseTags, STATUS_FILTERS, TRACKERLESS, UNCATEGORIZED, UNTAGGED, withChoice, type ChoiceState, type FilterList } from '@/lib/torrentFilters'
import { cn } from '@/lib/utils'
import { STATUS_ICONS } from '@/lib/stateIcons'
import type { TorrentList } from '@/hooks/useTorrentList'
import { saveFilterViews, sameFilters, upsertView, type FilterView } from '@/lib/filterViews'
import type { Torrent, TorrentCategory } from '@/types'
import { SaveViewButton } from './FilterViews'
import { t } from '@/i18n'

// The names of the "none" choices, shown first in their sections.
const choiceLabel = (value: string) =>
  value === UNCATEGORIZED ? t('Uncategorized') : value === UNTAGGED ? t('Untagged') : value === TRACKERLESS ? t('No tracker') : value


interface Choice { value: string; label: string; icon: LucideIcon; count: number }

// The choices of one list, in the order the sidebar shows them: the "none" choice first, then
// the names. The table's column titles offer the same ones.
function choicesFor(key: FilterList, list: TorrentList, categories: Record<string, TorrentCategory>, tags: string[]): Choice[] {
  const { counts, trackerHosts } = list
  const named = (value: string, icon: LucideIcon, count: number): Choice => ({ value, label: choiceLabel(value), icon, count })
  const sorted = (names: string[]) => [...names].sort((a, b) => a.localeCompare(b))
  switch (key) {
    case 'statuses': return STATUS_FILTERS.map(({ value, label }) => ({ value, label, icon: STATUS_ICONS[value], count: counts.status[value] }))
    case 'categories': return [named(UNCATEGORIZED, FolderX, counts.category[UNCATEGORIZED] ?? 0), ...sorted(Object.keys(categories)).map(name => named(name, Folder, counts.category[name] ?? 0))]
    case 'tags': return [named(UNTAGGED, CircleOff, counts.tag[UNTAGGED] ?? 0), ...sorted(tags).map(name => named(name, Tag, counts.tag[name] ?? 0))]
    case 'trackers': return [named(TRACKERLESS, CircleOff, counts.trackerless), ...trackerHosts.map(host => named(host, Globe, counts.tracker[host] ?? 0))]
  }
}

function ChoiceItem({ list, listKey, choice, menu }: { list: TorrentList; listKey: FilterList; choice: Choice; menu?: ReactNode }) {
  const state = choiceState(list.filters, listKey, choice.value)
  return (
    <FilterItem
      icon={choice.icon} label={choice.label} muted={choice.value.startsWith('\u0000')} count={choice.count} checked={state === 'in'} excluded={state === 'out'}
      onToggle={(e) => (e.ctrlKey || e.metaKey ? list.excludeFilter(listKey, choice.value) : list.toggleFilter(listKey, choice.value))}
      onExclude={() => list.excludeFilter(listKey, choice.value)}
      menu={menu}
    />
  )
}

// One list's tick boxes on their own, for the popup of a table column the sidebar covers. Ticking
// one here ticks it in the sidebar too: it's the same filter.
export function FilterChoices({ list, listKey, categories, tags }: { list: TorrentList; listKey: FilterList; categories: Record<string, TorrentCategory>; tags: string[] }) {
  return (
    <ul className="max-h-80 space-y-px overflow-y-auto">
      {choicesFor(listKey, list, categories, tags).map(choice => <ChoiceItem key={choice.value} list={list} listKey={listKey} choice={choice} />)}
    </ul>
  )
}

// Sections folded away stay folded on this device. Trackers start folded, as there can be many;
// so do sections folded under the key earlier versions used.
const FOLDED_KEY = 'qbminimal.sidebarFolded'
const OLD_FOLDED_KEY = 'qbminimal.filterSections'
const initialFolded = (): string[] => {
  try {
    const parsed: unknown = JSON.parse(readStored(OLD_FOLDED_KEY) ?? '[]')
    const ids = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
    return ids.includes('trackers') ? ids : [...ids, 'trackers']
  } catch {
    return ['trackers']
  }
}

// Statuses no torrent has are left out unless asked for, as there are many.
const EMPTY_STATUSES_KEY = 'qbminimal.showEmptyStatuses'

type Prompt =
  | { kind: 'newCategory' }
  | { kind: 'editCategory'; name: string; savePath: string }
  | { kind: 'deleteCategory'; name: string }
  | { kind: 'newTags' }
  | { kind: 'editTag'; name: string }
  | { kind: 'deleteTag'; name: string }
  | { kind: 'renameView'; name: string }
  | { kind: 'deleteView'; name: string }

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
  onDeleteView: (name: string) => void
}

// Creating, editing, renaming and deleting categories, tags and views, one small dialog at a time.
function PromptDialog({ prompt, onClose, torrents, taken, onDeleted, onRenamed, onRenameView, onDeleteView }: PromptDialogProps) {
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
    } else if (prompt.kind === 'deleteView') {
      onDeleteView(prompt.name)
      onClose()
    } else if (prompt.kind === 'deleteCategory') {
      void run(() => qbitClient.removeCategories([prompt.name]), t('Failed to delete category'), t('Category deleted'), () => onDeleted('categories', prompt.name))
    } else {
      void run(() => qbitClient.deleteTags([prompt.name]), t('Failed to delete tag'), t('Tag deleted'), () => onDeleted('tags', prompt.name))
    }
  }

  const deleting = prompt?.kind === 'deleteCategory' || prompt?.kind === 'deleteTag' || prompt?.kind === 'deleteView'
  const creating = prompt?.kind === 'newCategory' || prompt?.kind === 'newTags'
  const title = !prompt ? '' : prompt.kind === 'newCategory' ? t('New category') : prompt.kind === 'editCategory' ? t('Edit category')
    : prompt.kind === 'newTags' ? t('New tags') : prompt.kind === 'editTag' ? t('Rename tag') : prompt.kind === 'renameView' ? t('Rename view')
    : prompt.kind === 'deleteCategory' ? t('Delete the {name} category?', { name: prompt.name })
    : prompt.kind === 'deleteView' ? t('Delete the {name} view?', { name: prompt.name })
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
                : prompt?.kind === 'deleteView' ? t('Only the saved filters go. Torrents stay as they are.')
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
}

// Saved views, then status, categories, tags and trackers, each with tick boxes for any number of
// choices and a count of the torrents each would show. A choice can also be excluded, hiding what it matches. Views, categories and tags can be added,
// renamed, changed and deleted right here.
export function FilterSidebar({ list, torrents, categories, tags, views, onViewsChange, columnTargets }: FilterSidebarProps) {
  const { filters } = list
  const { folded, fold, searchProps, matching } = useSidebarSections(FOLDED_KEY, initialFolded)
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [showEmpty, setShowEmpty] = useState(() => readStored(EMPTY_STATUSES_KEY) === 'true')
  const items = (key: FilterList, id: string, menu?: (name: string) => ReactNode) => {
    let choices = choicesFor(key, list, categories, tags)
    // A picked or excluded status stays in sight, so it can be let go.
    if (key === 'statuses' && !showEmpty) choices = choices.filter(choice => choice.count > 0 || choiceState(filters, key, choice.value))
    const shown = matching(id, choices, choice => choice.label)
    if (!shown.length) return <NothingMatches />
    return shown.map(choice => <ChoiceItem key={choice.value} list={list} listKey={key} choice={choice} menu={menu && !choice.value.startsWith('\u0000') ? menu(choice.value) : undefined} />)
  }
  // A deleted category or tag can't stay chosen, or it would hide every torrent.
  const forget = (key: FilterList, value: string) => { if (choiceState(filters, key, value)) list.applyFilters(withChoice(filters, key, value, null)) }
  // The quick search narrows the views by name too.
  const query = list.query.trim().toLowerCase()
  const shownViews = matching('views', query ? views.filter(view => view.name.toLowerCase().includes(query)) : views, view => view.name)
  const changeViews = (next: FilterView[]) => {
    saveFilterViews(next)
    onViewsChange(next)
  }
  // A renamed category or tag stays picked, or excluded, under its new name.
  const renamed = (key: FilterList, from: string, to: string) => {
    const state: ChoiceState = choiceState(filters, key, from)
    if (state) list.applyFilters(withChoice(withChoice(filters, key, from, null), key, to, state))
  }
  const renameView = (from: string, to: string) => changeViews(views.map(view => (view.name === from ? { ...view, name: to } : view)))
  const updateView = (name: string) => {
    changeViews(upsertView(views, { name, filters: { ...filters, name: filters.name.trim() } }))
    toast.success(t('View updated'))
  }
  const removeView = (name: string) => changeViews(views.filter(view => view.name !== name))
  const categoryNames = Object.keys(categories).sort((a, b) => a.localeCompare(b))
  const tagNames = [...tags].sort((a, b) => a.localeCompare(b))
  // Clears one section's choices, from its count.
  const clearList = (key: FilterList) => () => list.applyFilters({ ...filters, [key]: [], excluded: { ...filters.excluded, [key]: [] } })
  const toggleEmpty = () => {
    writeStored(EMPTY_STATUSES_KEY, showEmpty ? null : 'true')
    setShowEmpty(!showEmpty)
  }

  return (
    <div id="torrent-filters" className="space-y-3">
      {/* The funnel adds a filter on any table column. */}
      <SidebarHeader
        title={t('Filters')}
        filterButton={<AddFilterButton targets={columnTargets} onChange={list.setColumnFilter} active={list.columnFiltered} />}
        sidebarFiltered={list.sidebarFiltered}
        columnFiltered={list.columnFiltered}
        onClearSidebar={list.clearSidebarFilters}
        onClearColumns={list.clearColumnFilters}
      />

      <Section id="views" title={t('Views')} icon={Bookmark} chosen={0} folded={folded.includes('views')} onFold={fold} action={<SaveViewButton list={list} views={views} onViewsChange={onViewsChange} />} {...(views.length > 0 ? searchProps('views') : {})}>
        {views.length === 0 ? <li className="px-2 py-1 text-sm text-muted-foreground">{t('No saved views yet. Pick some filters, then save them here.')}</li>
          : shownViews.length === 0 ? <NothingMatches />
          : shownViews.map(view => {
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
                    <DropdownMenuItem variant="destructive" onClick={() => setPrompt({ kind: 'deleteView', name: view.name })}><Trash2 />{t('Remove this view')}</DropdownMenuItem>
                  </ItemMenu>
                )}
              />
            )
          })}
      </Section>

      {/* Filters set from the table's column titles or the funnel above, each opening its editor. */}
      {activeCount(filters.columns) > 0 && (
        <Section id="columns" title={t('Column filters')} icon={Filter} chosen={activeCount(filters.columns)} onClear={list.clearColumnFilters} folded={folded.includes('columns')} onFold={fold}>
          <li><ColumnFilterChips targets={columnTargets} filters={filters.columns ?? {}} onChange={list.setColumnFilter} className="gap-1.5" /></li>
        </Section>
      )}

      <Section
        id="status" title={t('Status')} icon={Activity} chosen={chosenCount(filters, 'statuses')} onClear={clearList('statuses')} folded={folded.includes('status')} onFold={fold} {...searchProps('status')}
        action={(
          <Button type="button" variant="ghost" size="icon" className="size-7" aria-pressed={showEmpty} aria-label={showEmpty ? t('Hide empty statuses') : t('Show empty statuses')} title={showEmpty ? t('Hide empty statuses') : t('Show empty statuses')} onClick={toggleEmpty}>
            {showEmpty ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
        )}
      >
        {items('statuses', 'status')}
      </Section>

      <Section id="categories" title={t('Categories')} icon={Folder} chosen={chosenCount(filters, 'categories')} onClear={clearList('categories')} folded={folded.includes('categories')} onFold={fold} onAdd={() => setPrompt({ kind: 'newCategory' })} addLabel={t('New category')} {...searchProps('categories')}>
        {items('categories', 'categories', name => (
          <ItemMenu name={name}>
            <DropdownMenuItem onClick={() => setPrompt({ kind: 'editCategory', name, savePath: categories[name]?.savePath ?? '' })}><Pencil />{t('Edit category')}</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setPrompt({ kind: 'deleteCategory', name })}><Trash2 />{t('Delete')}</DropdownMenuItem>
          </ItemMenu>
        ))}
      </Section>

      <Section id="tags" title={t('Tags')} icon={Tags} chosen={chosenCount(filters, 'tags')} onClear={clearList('tags')} folded={folded.includes('tags')} onFold={fold} onAdd={() => setPrompt({ kind: 'newTags' })} addLabel={t('New tags')} {...searchProps('tags')}>
        {items('tags', 'tags', name => (
          <ItemMenu name={name}>
            <DropdownMenuItem onClick={() => setPrompt({ kind: 'editTag', name })}><Pencil />{t('Rename')}</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setPrompt({ kind: 'deleteTag', name })}><Trash2 />{t('Delete')}</DropdownMenuItem>
          </ItemMenu>
        ))}
      </Section>

      <Section id="trackers" title={t('Trackers')} icon={Globe} chosen={chosenCount(filters, 'trackers')} onClear={clearList('trackers')} folded={folded.includes('trackers')} onFold={fold} {...searchProps('trackers')}>
        {items('trackers', 'trackers')}
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
        onDeleteView={removeView}
      />
    </div>
  )
}
