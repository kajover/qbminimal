import { useState, type FormEvent } from 'react'
import { Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { ConfirmAction } from '@/components/ConfirmAction'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTorrentAction, useTorrentTrackers } from '@/hooks/useApi'
import { DetailsHeading } from './DetailsHeading'
import { WebSeedsSection } from './WebSeedsSection'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import type { TorrentTracker } from '@/types'
import { t } from '@/i18n'

function TrackerRow({ hash, tracker }: { hash: string; tracker: TorrentTracker }) {
  const action = useTorrentAction()
  const [editing, setEditing] = useState(false)
  const [url, setUrl] = useState(tracker.url)

  const startEditing = () => {
    setUrl(tracker.url)
    setEditing(true)
  }

  const save = (e: FormEvent) => {
    e.preventDefault()
    const newUrl = url.trim()
    if (!newUrl) {
      toast.error(t('Enter a tracker URL'))
      return
    }
    if (newUrl === tracker.url) {
      setEditing(false)
      return
    }
    action.mutateAsync({
      work: () => qbitClient.editTracker(hash, tracker.url, newUrl),
      failed: t('Failed to change tracker'),
    }).then(() => {
      setEditing(false)
      toast.success(t('Tracker changed'))
    }, () => undefined)
  }

  const remove = () => {
    action.mutateAsync({
      work: () => qbitClient.removeTrackers(hash, [tracker.url]),
      failed: t('Failed to remove tracker'),
    }).then(() => { toast.success(t('Tracker removed')) }, () => undefined)
  }

  const seeds = Math.max(tracker.num_seeds ?? 0, 0)
  const peers = Math.max(tracker.num_leeches ?? 0, 0)

  if (editing) {
    return (
      <tr className="border-b last:border-0">
        <td colSpan={4} className="px-2 py-2">
        <form onSubmit={save} className="space-y-2">
          <Label htmlFor={`tracker-${tracker.url}`} className="text-xs text-muted-foreground">{t('Tracker URL')}</Label>
          <Input id={`tracker-${tracker.url}`} value={url} autoFocus onChange={(e) => setUrl(e.target.value)} className="h-8 font-mono text-xs" dir="ltr" />
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="outline" className="h-8 text-xs" disabled={action.isPending}><Check />{t('Save')}</Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditing(false)}>{t('Cancel')}</Button>
          </div>
        </form>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b align-top last:border-0 hover:bg-muted/50" title={t('Seeds {seeds} · Peers {peers}', { seeds, peers })}>
      <td className="min-w-0 px-2 py-1.5">
        <p className="break-all font-mono" dir="ltr">{tracker.url}</p>
        {tracker.msg && <p className="mt-0.5 text-muted-foreground">{tracker.msg}</p>}
      </td>
      <td className="px-2 py-1.5 tabular-nums">{seeds}</td>
      <td className="px-2 py-1.5 tabular-nums">{peers}</td>
      <td className="px-2 py-0.5">
        <div className="flex justify-end gap-0.5">
          <Button type="button" variant="ghost" size="icon" className="size-6 shrink-0" aria-label={t('Edit {url}', { url: tracker.url })} title={t('Edit tracker')} onClick={startEditing}>
            <Pencil className="size-3" />
          </Button>
          <ConfirmAction
            label={t('Remove {url}', { url: tracker.url })}
            title={t('Remove this tracker?')}
            message={t('{url} will be removed from this torrent. If it\'s a private tracker, you may need this URL to add it back.', { url: tracker.url })}
            confirmLabel={t('Remove')}
            disabled={action.isPending}
            onConfirm={remove}
          >
            <Trash2 className="size-3" />
          </ConfirmAction>
        </div>
      </td>
    </tr>
  )
}

export function TrackersTab({ hash }: { hash: string }) {
  const { data: trackers, isLoading, isError } = useTorrentTrackers(hash)
  const action = useTorrentAction()
  const [newUrls, setNewUrls] = useState('')

  const add = (e: FormEvent) => {
    e.preventDefault()
    const urls = newUrls.trim()
    if (!urls) {
      toast.error(t('Enter at least one tracker URL'))
      return
    }
    action.mutateAsync({
      work: () => qbitClient.addTrackers(hash, urls),
      failed: t('Failed to add trackers'),
    }).then(() => {
      setNewUrls('')
      toast.success(t('Trackers added'))
    }, () => undefined)
  }

  // qBittorrent lists DHT, PeX, and LSD here as pseudo-trackers, with ** around their names.
  const real = (trackers ?? []).filter(tracker => !tracker.url.startsWith('**'))

  const status = (text: string) => <p className="py-6 text-center text-xs text-muted-foreground">{text}</p>
  const headCell = 'truncate px-2 py-1 text-start text-xs font-medium tracking-wide whitespace-nowrap text-muted-foreground uppercase'

  return (
    <div className="space-y-4 px-0 pt-1 pb-3">
      <section>
        <div className="px-2"><DetailsHeading>{t('Trackers')}</DetailsHeading></div>
        {isLoading ? status(t('Loading trackers...'))
          : isError && !trackers ? status(t('Couldn\'t load trackers'))
          : real.length === 0 ? status(t('No trackers'))
          : (
            <table className="w-full table-fixed text-xs">
              <colgroup><col /><col className="w-16" /><col className="w-16" /><col className="w-16" /></colgroup>
              <thead>
                <tr className="border-b">
                  <th className={headCell}>{t('Tracker')}</th>
                  <th className={headCell}>{t('Seeds')}</th>
                  <th className={headCell}>{t('Peers')}</th>
                  <th className={headCell}><span className="sr-only">{t('Edit tracker')}</span></th>
                </tr>
              </thead>
              <tbody>
                {real.map(tracker => <TrackerRow key={tracker.url} hash={hash} tracker={tracker} />)}
              </tbody>
            </table>
          )}
      </section>

      <form onSubmit={add} className="space-y-1 border-t px-2 pt-3">
        <Label htmlFor="new-trackers" className="text-xs text-muted-foreground">{t('Add trackers, one URL per line')}</Label>
        <textarea
          id="new-trackers"
          rows={2}
          value={newUrls}
          onChange={(e) => setNewUrls(e.target.value)}
          placeholder={t('udp://tracker.example.com:6969/announce')}
          className="border-input dark:bg-input/30 w-full rounded-md border bg-transparent px-2 py-1 font-mono text-xs"
          dir="ltr"
        />
        <Button type="submit" size="sm" variant="outline" className="h-8 text-xs" disabled={action.isPending}><Plus />{t('Add trackers')}</Button>
      </form>

      <WebSeedsSection hash={hash} />
    </div>
  )
}
