import { useState, type FormEvent } from 'react'
import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine } from 'lucide-react'
import { ConfirmAction } from '@/components/ConfirmAction'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCategories, useTorrentAction } from '@/hooks/useApi'
import { qbitClient, type QueueMove } from '@/lib/api'
import { parseTags } from '@/lib/torrentFilters'
import { toast } from '@/hooks/use-toast'
import { ShareLimitsForm } from './ShareLimitsForm'
import { SSLParametersForm } from './SSLParametersForm'
import type { Torrent } from '@/types'
import { t } from '@/i18n'

const toKiB = (bytes: number) => (bytes > 0 ? String(Math.round(bytes / 1024)) : '0')

function FieldForm({ id, label, value, onChange, onSave, type = 'text', placeholder, pending }: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  onSave: () => Promise<void>
  type?: string
  placeholder?: string
  pending: boolean
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault()
    void onSave()
  }

  return (
    <form onSubmit={submit} className="space-y-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-2">
        <Input id={id} type={type} min={type === 'number' ? 0 : undefined} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="h-8 text-sm" />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>{t('Save')}</Button>
      </div>
    </form>
  )
}

// Field values start from the torrent and don't follow refreshes, so typing isn't overwritten.
export function TorrentActions({ torrent }: { torrent: Torrent }) {
  const hashes = [torrent.hash]
  const stopped = /^(stopped|paused)/.test(torrent.state)
  const action = useTorrentAction()
  const { data: categories } = useCategories()
  const [name, setName] = useState(torrent.name)
  const [location, setLocation] = useState(torrent.save_path)
  const [tags, setTags] = useState(parseTags(torrent.tags).join(', '))
  const [dlLimit, setDlLimit] = useState(toKiB(torrent.dl_limit))
  const [upLimit, setUpLimit] = useState(toKiB(torrent.up_limit))
  const [comment, setComment] = useState(torrent.comment ?? '')
  const [downloadPath, setDownloadPath] = useState(torrent.download_path ?? '')
  const complete = torrent.progress >= 1
  // qBittorrent reports 0 for torrents outside the queue, including all of them when queueing is off.
  const queued = torrent.priority > 0

  const run = (work: () => Promise<unknown>, done: string, failed: string) =>
    action.mutateAsync({ work, failed }).then(() => { toast.success(done) }, () => undefined)

  const saveLimit = (value: string, set: typeof qbitClient.setDownloadLimit, done: string, failed: string) => {
    const kib = Number(value)
    if (!Number.isFinite(kib) || kib < 0) {
      toast.error(t('Enter 0 or a higher number'))
      return Promise.resolve()
    }
    return run(() => set.call(qbitClient, hashes, Math.round(kib * 1024)), done, failed)
  }

  const saveTags = () => {
    const current = parseTags(torrent.tags)
    const next = parseTags(tags)
    const added = next.filter(tag => !current.includes(tag))
    const removed = current.filter(tag => !next.includes(tag))
    return run(async () => {
      if (added.length) await qbitClient.addTags(hashes, added)
      if (removed.length) await qbitClient.removeTags(hashes, removed)
    }, t('Tags saved'), t('Failed to save tags'))
  }

  return (
    <div className="space-y-3 px-2 pb-2 pt-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={action.isPending} onClick={() => run(() => qbitClient.recheckTorrents(hashes), t('Recheck started'), t('Failed to start recheck'))}>
          {t('Recheck')}
        </Button>
        <Button type="button" size="sm" variant={torrent.force_start ? 'secondary' : 'outline'} aria-pressed={!!torrent.force_start} disabled={action.isPending} onClick={() => run(() => qbitClient.setForceStart(hashes, !torrent.force_start), torrent.force_start ? t('Force start off') : t('Force start on'), t('Failed to change force start'))}>
          {t('Force start')}
        </Button>
        {/* A disabled button shows no tooltip, so the wrapper carries it. */}
        <span className={stopped ? 'cursor-not-allowed' : undefined} title={stopped ? t('Start the torrent first: stopped torrents don\'t contact trackers') : t('Ask the trackers for more peers now')}>
          <Button type="button" size="sm" variant="outline" disabled={action.isPending || stopped} onClick={() => run(() => qbitClient.reannounceTorrents(hashes), t('Reannounce sent'), t('Failed to reannounce'))}>
            {t('Reannounce')}
          </Button>
        </span>
      </div>

      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">{t('Download options')}</div>
        <div className="flex flex-wrap gap-2">
          {!complete && (
            <>
              <Button type="button" size="sm" variant={torrent.seq_dl ? 'secondary' : 'outline'} aria-pressed={!!torrent.seq_dl} disabled={action.isPending} onClick={() => run(() => qbitClient.toggleSequentialDownload(hashes), torrent.seq_dl ? t('Sequential download off') : t('Sequential download on'), t('Failed to change sequential download'))}>
                {t('Sequential download')}
              </Button>
              <Button type="button" size="sm" variant={torrent.f_l_piece_prio ? 'secondary' : 'outline'} aria-pressed={!!torrent.f_l_piece_prio} disabled={action.isPending} onClick={() => run(() => qbitClient.toggleFirstLastPiecePrio(hashes), torrent.f_l_piece_prio ? t('First and last pieces first off') : t('First and last pieces first on'), t('Failed to change piece order'))}>
                {t('First and last pieces first')}
              </Button>
            </>
          )}
          {complete && (
            <Button type="button" size="sm" variant={torrent.super_seeding ? 'secondary' : 'outline'} aria-pressed={!!torrent.super_seeding} title={t('Sends each peer different pieces, to spread a new torrent faster')} disabled={action.isPending} onClick={() => run(() => qbitClient.setSuperSeeding(hashes, !torrent.super_seeding), torrent.super_seeding ? t('Super seeding off') : t('Super seeding on'), t('Failed to change super seeding'))}>
              {t('Super seeding')}
            </Button>
          )}
          {torrent.auto_tmm ? (
            <Button type="button" size="sm" variant="secondary" aria-pressed title={t('qBittorrent sets this torrent\'s location from its category')} disabled={action.isPending} onClick={() => run(() => qbitClient.setAutoManagement(hashes, false), t('Automatic management off'), t('Failed to change automatic management'))}>
              {t('Automatic management')}
            </Button>
          ) : (
            <ConfirmAction
              buttonLabel={t('Automatic management')}
              pressed={false}
              label={t('qBittorrent sets this torrent\'s location from its category')}
              title={t('Turn on automatic management?')}
              message={t('qBittorrent will set this torrent\'s location from its category, and may move its files to the category\'s save path.')}
              confirmLabel={t('Turn on')}
              disabled={action.isPending}
              onConfirm={() => run(() => qbitClient.setAutoManagement(hashes, true), t('Automatic management on'), t('Failed to change automatic management'))}
            />
          )}
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">
          {queued ? t('Queue position: {position}', { position: torrent.priority }) : t('Queue position: not queued')}
        </div>
        <div className="flex gap-2" title={queued ? undefined : t('Only queued torrents can be moved. Queueing must be on in Settings > Queueing.')}>
          {([
            ['top', 'Move to top', ArrowUpToLine],
            ['up', 'Move up', ArrowUp],
            ['down', 'Move down', ArrowDown],
            ['bottom', 'Move to bottom', ArrowDownToLine],
          ] as [QueueMove, string, typeof ArrowUp][]).map(([direction, label, Icon]) => (
            <Button key={direction} type="button" size="icon" variant="outline" className="size-8" aria-label={t(label)} title={queued ? t(label) : undefined} disabled={action.isPending || !queued} onClick={() => run(() => qbitClient.moveInQueue(hashes, direction), t('Queue order changed'), t('Failed to change queue order'))}>
              <Icon className="size-4" />
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="torrent-category" className="text-xs text-muted-foreground">{t('Category')}</Label>
        <select
          id="torrent-category"
          value={torrent.category}
          disabled={action.isPending}
          onChange={(e) => {
            // Read now: the controlled select goes back to the current category until the refresh.
            const category = e.target.value
            run(() => qbitClient.setCategory(hashes, category), t('Category saved'), t('Failed to save category'))
          }}
          className="border-input dark:bg-input/30 h-8 w-full rounded-md border bg-transparent px-2 text-sm"
        >
          <option value="">{t('No category')}</option>
          {torrent.category && !categories?.[torrent.category] && <option value={torrent.category}>{torrent.category}</option>}
          {Object.keys(categories ?? {}).map(category => <option key={category} value={category}>{category}</option>)}
        </select>
      </div>

      <FieldForm id="torrent-tags" label={t('Tags, separated by commas')} value={tags} onChange={setTags} onSave={saveTags} pending={action.isPending} />
      <FieldForm id="torrent-name" label={t('Name')} value={name} onChange={setName} pending={action.isPending} onSave={() => run(() => qbitClient.renameTorrent(torrent.hash, name.trim()), 'Renamed', t('Failed to rename'))} />
      <FieldForm id="torrent-location" label={t('Save location (moves the files)')} value={location} onChange={setLocation} pending={action.isPending} onSave={() => run(() => qbitClient.setLocation(hashes, location.trim()), t('Move started'), t('Failed to move'))} />
      <FieldForm id="torrent-download-path" label={t('Folder for incomplete files (blank = save location)')} value={downloadPath} onChange={setDownloadPath} pending={action.isPending} onSave={() => run(() => qbitClient.setDownloadPath(hashes, downloadPath.trim()), t('Incomplete files folder saved'), t('Failed to save incomplete files folder'))} />
      {torrent.comment !== undefined && (
        <FieldForm id="torrent-comment" label={t('Comment')} value={comment} onChange={setComment} pending={action.isPending} onSave={() => run(() => qbitClient.setComment(hashes, comment.trim()), t('Comment saved'), t('Failed to save comment'))} />
      )}
      <FieldForm id="torrent-dl-limit" label={t('Download limit (KiB/s, 0 = unlimited)')} type="number" value={dlLimit} onChange={setDlLimit} pending={action.isPending} onSave={() => saveLimit(dlLimit, qbitClient.setDownloadLimit, t('Download limit saved'), t('Failed to save download limit'))} />
      <FieldForm id="torrent-up-limit" label={t('Upload limit (KiB/s, 0 = unlimited)')} type="number" value={upLimit} onChange={setUpLimit} pending={action.isPending} onSave={() => saveLimit(upLimit, qbitClient.setUploadLimit, t('Upload limit saved'), t('Failed to save upload limit'))} />
      <ShareLimitsForm torrent={torrent} />
      <SSLParametersForm hash={torrent.hash} />
    </div>
  )
}
