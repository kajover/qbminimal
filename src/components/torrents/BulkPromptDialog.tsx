import { useState, type FormEvent } from 'react'
import { Check, Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/NativeSelect'
import { useCategories, useTorrentAction, useTorrents } from '@/hooks/useApi'
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
  const { data: allTorrents } = useTorrents()
  const queued = torrents.filter(torrent => torrent.priority > 0).sort((a, b) => a.priority - b.priority)
  const length = queueLength(allTorrents ?? [])
  const first = torrents[0]
  const [value, setValue] = useState(() => {
    if (prompt === 'category') return torrents.every(t => t.category === first?.category) ? first?.category ?? '' : ''
    if (prompt === 'location') return first?.save_path ?? ''
    if (prompt === 'queuePosition') return queued[0] ? String(queued[0].priority) : ''
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
      case 'category':
        return apply(() => qbitClient.setCategory(hashes, value), t('Category set'), t('Failed to set category'))
      case 'addTags':
      case 'removeTags': {
        const tags = parseTags(value)
        if (!tags.length) return toast.error(t('Enter at least one tag'))
        return prompt === 'addTags'
          ? apply(() => qbitClient.addTags(hashes, tags), t('Tags added'), t('Failed to add tags'))
          : apply(() => qbitClient.removeTags(hashes, tags), t('Tags removed'), t('Failed to remove tags'))
      }
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
          <NativeSelect aria-label={t('Category')} className="w-full" value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">{t('No category')}</option>
            {Object.keys(categories ?? {}).sort().map(name => <option key={name} value={name}>{name}</option>)}
          </NativeSelect>
        )}
        {(prompt === 'addTags' || prompt === 'removeTags') && (
          <Input aria-label={t('Tags, separated by commas')} placeholder={t('Tags, separated by commas')} autoFocus value={value} onChange={(e) => setValue(e.target.value)} />
        )}
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
