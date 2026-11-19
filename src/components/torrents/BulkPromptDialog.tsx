import { useState, type FormEvent } from 'react'
import { Check, Folder, Plus, Power, Tag as TagIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { SearchInput } from '@/components/SearchInput'
import { FilterItem } from '@/components/FilterSidebarParts'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/NativeSelect'
import { useCategories, useTags, useTorrentAction, useTorrents } from '@/hooks/useApi'
import { moveToQueuePosition, planQueueMoves, queueLength } from '@/lib/queuePosition'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import { parseShareLimits, type ShareLimitMode } from '@/lib/shareLimits'
import { parseTags } from '@/lib/torrentFilters'
import type { Torrent } from '@/types'
import type { BulkPrompt } from './bulkActions'
import { t } from '@/i18n'

const TITLES: Record<BulkPrompt, string> = {
  category: 'Set category',
  addTags: 'Add tags',
  removeTags: 'Remove tags',
  location: 'Move files',
  limits: 'Speed limits',
  shareLimits: 'Seeding limits',
  autoOn: 'Turn on automatic management?',
  queuePosition: 'Set queue position',
  comment: 'Comment',
}

const same = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0

// A searchable list to pick from: one choice for a category, any number for tags. A name typed
// that isn't there yet can be created from the list's last row.
function PickList({ options, picked, multiple, onPick, query, onQuery, createLabel, counts }: {
  options: { value: string; label: string }[]
  picked: string[]
  multiple?: boolean
  onPick: (value: string) => void
  query: string
  onQuery: (text: string) => void
  // The last row's text for a new name, or nothing where new names can't be made.
  createLabel?: (name: string) => string
  // How many of the torrents have each choice.
  counts?: ReadonlyMap<string, number>
}) {
  const wanted = query.trim()
  const shown = options.filter(option => option.label.toLowerCase().includes(wanted.toLowerCase()))
  const canCreate = createLabel && wanted && !options.some(option => same(option.value, wanted)) && !picked.some(value => same(value, wanted))
  return (
    <div className="space-y-2">
      <SearchInput aria-label={t('Search')} placeholder={createLabel ? t('Search or type a new name') : t('Search')} autoFocus value={query} onValueChange={onQuery} />
      <ul className="max-h-64 space-y-px overflow-y-auto rounded-md border p-1">
        {shown.map(option => (
          <FilterItem key={option.value} single={!multiple} icon={multiple ? TagIcon : Folder} label={option.label} muted={option.value === ''} count={counts?.get(option.value)} checked={picked.includes(option.value)} onToggle={() => onPick(option.value)} />
        ))}
        {canCreate && <FilterItem single icon={Plus} label={createLabel(wanted)} checked={false} onToggle={() => { onPick(wanted); onQuery('') }} />}
        {!shown.length && !canCreate && <li className="px-2 py-1 text-sm text-muted-foreground">{t('Nothing matches')}</li>}
      </ul>
      {/* Picked names, new ones too, stay in sight while the search narrows the list. */}
      {multiple && picked.length > 0 && <p className="text-xs text-muted-foreground wrap-anywhere">{picked.join(', ')}</p>}
    </div>
  )
}

interface BulkPromptDialogProps {
  torrents: Torrent[]
  prompt: BulkPrompt | null
  onClose: () => void
}

// Asks for the value an action needs, then applies it to every torrent it was opened for.
export function BulkPromptDialog({ torrents, prompt, onClose }: BulkPromptDialogProps) {
  return (
    <Dialog open={!!prompt} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {/* Keyed, so each opening starts from the torrents' current values. */}
        {prompt && <PromptForm key={prompt} prompt={prompt} torrents={torrents} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function PromptForm({ prompt, torrents, onClose }: { prompt: BulkPrompt; torrents: Torrent[]; onClose: () => void }) {
  const action = useTorrentAction()
  const { data: categories } = useCategories()
  const { data: allTags } = useTags()
  const [query, setQuery] = useState('')
  // Tags start empty; a category starts from the torrents' own when they share one.
  const [picked, setPicked] = useState<string[]>(() => (prompt === 'category' && torrents.every(t => t.category === torrents[0]?.category) ? [torrents[0]?.category ?? ''] : []))
  const pick = (value: string) => setPicked(prompt === 'category' ? [value] : picked.includes(value) ? picked.filter(v => v !== value) : [...picked, value])
  // How many of the torrents have each tag, for removing them.
  const tagCounts = new Map<string, number>()
  for (const torrent of torrents) for (const tag of parseTags(torrent.tags)) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
  const { data: allTorrents } = useTorrents()
  const queued = torrents.filter(torrent => torrent.priority > 0).sort((a, b) => a.priority - b.priority)
  const length = queueLength(allTorrents ?? [])
  const first = torrents[0]
  const [value, setValue] = useState(() => {
    if (prompt === 'category') return torrents.every(t => t.category === first?.category) ? first?.category ?? '' : ''
    if (prompt === 'location') return first?.save_path ?? ''
    if (prompt === 'queuePosition') return queued[0] ? String(queued[0].priority) : ''
    if (prompt === 'comment') return torrents.every(t => (t.comment ?? '') === (first?.comment ?? '')) ? first?.comment ?? '' : ''
    return ''
  })
  const [second, setSecond] = useState('')
  const [share, setShare] = useState({ mode: 'global' as ShareLimitMode, ratio: '', seedingMinutes: '', inactiveMinutes: '', action: 'Default' })
  const hashes = torrents.map(t => t.hash)
  const count = torrents.length
  const noun = count === 1 ? t('torrent') : t('torrents')

  const apply = (work: () => Promise<unknown>, done: string, failed: string) =>
    action.mutateAsync({ work, failed }).then(() => { toast.success(done); onClose() }, () => undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    switch (prompt) {
      case 'category': {
        // Enter in the search field takes the one match, or the name typed.
        const names = Object.keys(categories ?? {})
        const wanted = query.trim()
        const matches = names.filter(name => name.toLowerCase().includes(wanted.toLowerCase()))
        const category = wanted ? names.find(name => same(name, wanted)) ?? (matches.length === 1 ? matches[0] : wanted) : picked[0] ?? ''
        const isNew = category !== '' && !names.includes(category)
        return apply(async () => {
          if (isNew) await qbitClient.createCategory(category, '')
          await qbitClient.setCategory(hashes, category)
        }, isNew ? t('Category created and set') : t('Category set'), t('Failed to set category'))
      }
      case 'addTags':
      case 'removeTags': {
        // Names typed but not picked from the list count too.
        const typed = prompt === 'addTags' ? parseTags(query) : parseTags(query).filter(tag => tagCounts.has(tag))
        const tags = [...new Set([...picked, ...typed])]
        if (!tags.length) return toast.error(prompt === 'addTags' ? t('Enter at least one tag') : t('Pick at least one tag'))
        return prompt === 'addTags'
          ? apply(() => qbitClient.addTags(hashes, tags), t('Tags added'), t('Failed to add tags'))
          : apply(() => qbitClient.removeTags(hashes, tags), t('Tags removed'), t('Failed to remove tags'))
      }
      case 'comment':
        return apply(() => qbitClient.setComment(hashes, value.trim()), t('Comment saved'), t('Failed to save comment'))
      case 'location':
        if (!value.trim()) return toast.error(t('Enter a folder'))
        return apply(() => qbitClient.setLocation(hashes, value.trim()), t('Move started'), t('Failed to move'))
      case 'limits': {
        const dl = value.trim() === '' ? 0 : Number(value)
        const up = second.trim() === '' ? 0 : Number(second)
        if (!(dl >= 0) || !(up >= 0)) return toast.error(t('Enter 0 or a higher number'))
        return apply(async () => {
          await qbitClient.setDownloadLimit(hashes, Math.round(dl * 1024))
          await qbitClient.setUploadLimit(hashes, Math.round(up * 1024))
        }, t('Speed limits saved'), t('Failed to save speed limits'))
      }
      case 'shareLimits': {
        const limits = parseShareLimits(share)
        if (!limits) return toast.error(t('Check the seeding limits'), { description: t('Use 0 or higher, with whole minutes. Leave a box blank for no limit.') })
        return apply(() => qbitClient.setShareLimits(hashes, limits), t('Seeding limits saved'), t('Failed to save seeding limits'))
      }
      case 'queuePosition': {
        const target = Number(value)
        if (!Number.isInteger(target) || target < 1) return toast.error(t('Enter a whole number from 1'))
        // Torrents outside the queue have no position to change.
        const moves = planQueueMoves(queued.length === 1 ? queued[0].priority : null, target, queued.length, length)
        return apply(() => moveToQueuePosition(queued.map(torrent => torrent.hash), moves), t('Queue order changed'), t('Failed to change queue order'))
      }
      case 'autoOn':
        return apply(() => qbitClient.setAutoManagement(hashes, true), t('Automatic management on'), t('Failed to change automatic management'))
    }
  }

  const description = prompt === 'queuePosition'
    ? t('1 is the top of the queue, {length} its end.', { length })
    : prompt === 'autoOn'
    ? t('qBittorrent will set the location of {count} {noun} from their categories, and may move their files.', { count, noun })
    : prompt === 'location'
      ? t('Moves the files of {count} {noun} to this folder on qBittorrent\'s machine.', { count, noun })
      : t('Applies to {count} {noun}.', { count, noun })

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t(TITLES[prompt])}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        {prompt === 'category' && (
          <PickList
            options={[{ value: '', label: t('No category') }, ...Object.keys(categories ?? {}).sort((a, b) => a.localeCompare(b)).map(name => ({ value: name, label: name }))]}
            picked={picked} onPick={pick} query={query} onQuery={setQuery}
            createLabel={name => t('New category: {name}', { name })}
          />
        )}
        {prompt === 'addTags' && (
          <PickList
            multiple
            options={[...(allTags ?? [])].sort((a, b) => a.localeCompare(b)).map(name => ({ value: name, label: name }))}
            picked={picked} onPick={pick} query={query} onQuery={setQuery} counts={tagCounts}
            createLabel={name => t('New tag: {name}', { name })}
          />
        )}
        {prompt === 'removeTags' && (
          // Only the tags these torrents have, with how many of them have each.
          <PickList
            multiple
            options={[...tagCounts.keys()].sort((a, b) => a.localeCompare(b)).map(name => ({ value: name, label: name }))}
            picked={picked} onPick={pick} query={query} onQuery={setQuery} counts={tagCounts}
          />
        )}
        {prompt === 'comment' && <Textarea aria-label={t('Comment')} rows={6} autoFocus value={value} onChange={(e) => setValue(e.target.value)} className="text-sm" />}
        {prompt === 'location' && <Input aria-label={t('Folder')} autoFocus value={value} onChange={(e) => setValue(e.target.value)} />}
        {prompt === 'queuePosition' && <Input aria-label={t('Queue position')} type="number" inputMode="numeric" min={1} max={length} step={1} autoFocus value={value} onChange={(e) => setValue(e.target.value)} />}
        {prompt === 'limits' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="bulk-dl" className="text-xs text-muted-foreground">{t('Download (KiB/s, 0 = none)')}</Label>
              <Input id="bulk-dl" type="number" min={0} placeholder="0" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bulk-up" className="text-xs text-muted-foreground">{t('Upload (KiB/s, 0 = none)')}</Label>
              <Input id="bulk-up" type="number" min={0} placeholder="0" value={second} onChange={(e) => setSecond(e.target.value)} />
            </div>
          </div>
        )}
        {prompt === 'shareLimits' && (
          <div className="space-y-2">
            <NativeSelect aria-label={t('Seeding limits')} className="w-full" value={share.mode} onChange={(e) => setShare({ ...share, mode: e.target.value as ShareLimitMode })}>
              <option value="global">{t('Use qBittorrent\'s global limits')}</option>
              <option value="none">{t('No limit')}</option>
              <option value="custom">{t('Custom limits')}</option>
            </NativeSelect>
            {share.mode === 'custom' && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Input aria-label={t('Ratio')} type="number" min={0} step="any" placeholder={t('Ratio')} value={share.ratio} onChange={(e) => setShare({ ...share, ratio: e.target.value })} />
                <Input aria-label={t('Seeding time (minutes)')} type="number" min={0} step={1} placeholder={t('Seeding minutes')} value={share.seedingMinutes} onChange={(e) => setShare({ ...share, seedingMinutes: e.target.value })} />
                <Input aria-label={t('Inactive time (minutes)')} type="number" min={0} step={1} placeholder={t('Inactive minutes')} value={share.inactiveMinutes} onChange={(e) => setShare({ ...share, inactiveMinutes: e.target.value })} />
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t('Cancel')}</Button>
          <Button type="submit" disabled={action.isPending}>{prompt === 'autoOn' ? <Power /> : <Check />}
            {prompt === 'autoOn' ? t('Turn on') : t('Apply')}</Button>
        </DialogFooter>
      </form>
    </>
  )
}
