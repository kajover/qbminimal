import { useState, type FormEvent } from 'react'
import { Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { ConfirmAction } from '@/components/ConfirmAction'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTorrentAction, useTorrentTrackers } from '@/hooks/useApi'
import { SearchInput } from '@/components/SearchInput'
import { nextSort, SortMenu, SortTitle, type ListSort } from './DetailsSort'
import { cn } from '@/lib/utils'
import { AddButtonLabel, WebSeedsSection } from './WebSeedsSection'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import type { TorrentTracker } from '@/types'
import { t } from '@/i18n'

// qBittorrent's tracker states, as its own Trackers list names them, with a color for each.
const STATUS: Record<number, [label: string, className: string]> = {
  0: [t('Disabled'), 'text-muted-foreground'],
  1: [t('Not contacted yet'), 'text-muted-foreground'],
  2: [t('Working'), 'tint text-green-600 dark:text-green-400'],
  3: [t('Updating'), 'tint text-blue-600 dark:text-blue-400'],
  4: [t('Not working'), 'tint text-red-600 dark:text-red-400'],
}
const statusOf = (tracker: TorrentTracker) => STATUS[tracker.status] ?? [String(tracker.status), 'text-muted-foreground']
const count = (value: number | undefined) => Math.max(value ?? 0, 0)

type SortField = 'url' | 'status' | 'tier' | 'seeds' | 'peers' | 'downloaded'
const SORT_FIELDS: [SortField, string][] = [
  ['url', t('Tracker')], ['status', t('Status')], ['tier', t('Tier')], ['seeds', t('Seeds')], ['peers', t('Peers')], ['downloaded', t('Downloaded')],
]
const sortValue = (tracker: TorrentTracker, field: SortField): number | string => {
  switch (field) {
    case 'url': return tracker.url
    case 'status': return tracker.status
    case 'tier': return Number(tracker.tier) || 0
    case 'seeds': return count(tracker.num_seeds)
    case 'peers': return count(tracker.num_leeches)
    case 'downloaded': return count(tracker.num_downloaded)
  }
}

// One tracker: a table row on wide screens, a card on phones like the Peers tab's, with its address
// and message, then its status and counts on a line below.
function TrackerRow({ hash, tracker, card }: { hash: string; tracker: TorrentTracker; card?: boolean }) {
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

  const seeds = count(tracker.num_seeds)
  const peers = count(tracker.num_leeches)
  const [statusLabel, statusClass] = statusOf(tracker)

  const editForm = (
    <form onSubmit={save} className="space-y-2">
          <Label htmlFor={`tracker-${tracker.url}`} className="text-xs text-muted-foreground">{t('Tracker URL')}</Label>
          <Input id={`tracker-${tracker.url}`} value={url} autoFocus onChange={(e) => setUrl(e.target.value)} className="h-8 font-mono text-xs" dir="ltr" />
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="outline" className="h-8 text-xs" disabled={action.isPending}><Check />{t('Save')}</Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditing(false)}>{t('Cancel')}</Button>
          </div>
        </form>
  )
  if (editing) {
    return card ? <li className="px-2 py-2">{editForm}</li> : (
      <tr>
        <td colSpan={7} className="px-2 py-2">{editForm}</td>
      </tr>
    )
  }

  const buttons = (
    <div className="flex shrink-0 justify-end gap-0.5">
      <Button type="button" variant="ghost" size="icon" className="size-6 shrink-0" aria-label={t('Edit {url}', { url: tracker.url })} title={t('Edit tracker')} onClick={startEditing}>
        <Pencil className="size-3" />
      </Button>
      <ConfirmAction
        small
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
  )
  if (card) {
    return (
      <li className="px-2 py-1.5 text-xs">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="break-all font-mono" dir="ltr">{tracker.url}</p>
            {tracker.msg && <p className="mt-0.5 text-muted-foreground">{tracker.msg}</p>}
            <p className="mt-0.5 text-muted-foreground tabular-nums">
              <span className={statusClass}>{statusLabel}</span>
              {' · '}{t('Seeds {seeds} · Peers {peers}', { seeds, peers })}
              {' · '}{t('Tier {tier}', { tier: tracker.tier })}
            </p>
          </div>
          {/* On the first line, pulled up so they center on it. */}
          <div className="-my-1">{buttons}</div>
        </div>
      </li>
    )
  }

  return (
    <tr className="align-top hover:bg-muted/50" title={t('Seeds {seeds} · Peers {peers}', { seeds, peers })}>
      {/* The tracker's own message, such as an error, under its address. */}
      <td className="min-w-0 px-2 py-1.5">
        <p className="break-all font-mono" dir="ltr">{tracker.url}</p>
        {tracker.msg && <p className="mt-0.5 text-muted-foreground">{tracker.msg}</p>}
      </td>
      <td className={cn('truncate px-2 py-1.5 whitespace-nowrap', statusClass)} title={statusLabel}>{statusLabel}</td>
      <td className="px-2 py-1.5 tabular-nums max-sm:hidden">{tracker.tier}</td>
      <td className="px-2 py-1.5 tabular-nums">{seeds}</td>
      <td className="px-2 py-1.5 tabular-nums">{peers}</td>
      <td className="px-2 py-1.5 tabular-nums max-sm:hidden">{count(tracker.num_downloaded)}</td>
      <td className="px-2 py-0.5">
        {buttons}
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
  // Sorted from the arrows' menu or by clicking a column title; in qBittorrent's order at first.
  const [sort, setSort] = useState<ListSort<SortField> | null>(null)
  const sortBy = (field: SortField) => setSort(nextSort(sort ?? { field: 'tier', descending: false }, field, field !== 'url' && field !== 'tier' && field !== 'status'))
  const [search, setSearch] = useState('')
  const all = (trackers ?? []).filter(tracker => !tracker.url.startsWith('**'))
  // The search matches the address and the tracker's message.
  const wanted = search.trim().toLowerCase()
  const real = wanted ? all.filter(tracker => `${tracker.url} ${tracker.msg}`.toLowerCase().includes(wanted)) : all
  if (sort) real.sort((a, b) => {
    const x = sortValue(a, sort.field)
    const y = sortValue(b, sort.field)
    const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
    return sort.descending ? -order : order
  })
  const shownSort: ListSort<SortField> = sort ?? { field: 'tier', descending: false }
  const title = (field: SortField, label: string) => <SortTitle field={field} sort={sort ?? { field: '' as SortField, descending: false }} onSort={sortBy}>{label}</SortTitle>

  const status = (text: string) => <p className="py-6 text-center text-xs text-muted-foreground">{text}</p>
  const headCell = 'truncate px-2 py-1 text-start text-xs font-medium tracking-wide whitespace-nowrap text-muted-foreground uppercase'

  return (
    <div className="space-y-4 px-0 pt-1 pb-3">
      <section>
        {/* The search, how many trackers there are, and the sorting, on one row, as in Content. */}
        <div className="flex items-center gap-2 px-2 pb-1.5">
          <SearchInput aria-label={t('Search')} placeholder={t('Search')} value={search} onValueChange={setSearch} className="w-40 min-w-0 shrink sm:w-64" inputClassName="h-7 text-xs" />
          <span className="ms-auto shrink-0 text-xs text-muted-foreground tabular-nums">{all.length === 1 ? t('1 tracker') : t('{count} trackers', { count: all.length })}</span>
          <SortMenu fields={SORT_FIELDS} sort={shownSort} onSort={sortBy} onReset={() => setSort(null)} isDefault={!sort} />
        </div>
        {isLoading ? status(t('Loading trackers...'))
          : isError && !trackers ? status(t('Couldn\'t load trackers'))
          : all.length === 0 ? status(t('No trackers'))
          : real.length === 0 ? status(t('Nothing matches'))
          : (
            <>
            {/* Phones: a title over the cards, as Content has over its rows. */}
            <div className="flex items-center gap-2 border-b px-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase sm:hidden">
              <span className="min-w-0 flex-1 truncate">{t('Tracker')}</span>
            </div>
            <ul className="sm:hidden">
              {real.map(tracker => <TrackerRow key={tracker.url} hash={hash} tracker={tracker} card />)}
            </ul>
            {/* Widths are set on the titles, so a column hidden on phones takes no room. */}
            <table className="w-full table-fixed text-xs max-sm:hidden">
              <thead>
                <tr className="border-b">
                  <th className={headCell}>{title('url', t('Tracker'))}</th>
                  <th className={cn(headCell, 'w-34')}>{title('status', t('Status'))}</th>
                  <th className={cn(headCell, 'w-14 max-sm:hidden')}>{title('tier', t('Tier'))}</th>
                  <th className={cn(headCell, 'w-18')}>{title('seeds', t('Seeds'))}</th>
                  <th className={cn(headCell, 'w-18')}>{title('peers', t('Peers'))}</th>
                  <th className={cn(headCell, 'w-28 max-sm:hidden')} title={t('How many have downloaded it in full, as the tracker says')}>{title('downloaded', t('Downloaded'))}</th>
                  <th className={cn(headCell, 'w-16')}><span className="sr-only">{t('Edit tracker')}</span></th>
                </tr>
              </thead>
              <tbody>
                {real.map(tracker => <TrackerRow key={tracker.url} hash={hash} tracker={tracker} />)}
              </tbody>
            </table>
            </>
          )}
      </section>

      <form onSubmit={add} className="space-y-1 border-t px-2 pt-3">
        <Label htmlFor="new-trackers" className="text-xs text-muted-foreground">{t('Add trackers, one URL per line')}</Label>
        {/* Laid out like the Comment field under Actions: the box with its button beside it. */}
        <div className="flex max-w-3xl items-start gap-2">
          <Textarea
            id="new-trackers"
            rows={2}
            wrapperClassName="min-w-0 flex-1"
            value={newUrls}
            onChange={(e) => setNewUrls(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.currentTarget.form?.requestSubmit() } }}
            placeholder={t('udp://tracker.example.com:6969/announce')}
            className="min-h-14 px-2 py-1 font-mono text-xs"
            dir="ltr"
          />
          <Button type="submit" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs [&_svg:not([class*=size-])]:size-3.5" disabled={action.isPending} title={t('Ctrl or ⌘ and Enter')}><Plus /><AddButtonLabel /></Button>
        </div>
      </form>

      <WebSeedsSection hash={hash} />
    </div>
  )
}
