import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Ban, ChevronDown, Plus } from 'lucide-react'
import { ConfirmAction } from '@/components/ConfirmAction'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useTorrentAction, useTorrentPeers } from '@/hooks/useApi'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import { parsePeerAddresses } from '@/lib/peers'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'
import { DOWN_SPEED_COLOR, UP_SPEED_COLOR } from '@/lib/torrentState'
import type { TorrentPeer } from '@/types'
import { SearchInput } from '@/components/SearchInput'
import { nextSort, SortMenu, SortTitle, type ListSort } from './DetailsSort'
import { PeerFlag } from './PeerFlag'
import { t } from '@/i18n'
import { Textarea } from '@/components/ui/input'

type SortField = 'ip' | 'client' | 'progress' | 'dl_speed' | 'up_speed' | 'downloaded' | 'uploaded' | 'relevance'

const sortFields: [SortField, () => string][] = [
  ['ip', () => t('IP address')],
  ['client', () => t('Client')],
  ['progress', () => t('Progress')],
  ['dl_speed', () => t('Down speed')],
  ['up_speed', () => t('Up speed')],
  ['downloaded', () => t('Downloaded')],
  ['uploaded', () => t('Uploaded')],
  ['relevance', () => t('Relevance')],
]

// The fastest downloads first, until another order is picked.
const DEFAULT_SORT: ListSort<SortField> = { field: 'dl_speed', descending: true }

// IPv4 by octets, so 10.0.0.9 comes before 10.0.0.10. Anything else (IPv6) sorts after, as text.
function compareIp(a: string, b: string) {
  const octets = (ip: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) ? ip.split('.').map(Number) : null
  const x = octets(a), y = octets(b)
  if (x && y) return x[0] - y[0] || x[1] - y[1] || x[2] - y[2] || x[3] - y[3]
  if (x) return -1
  if (y) return 1
  return a.localeCompare(b)
}

function comparePeers(field: SortField, [idA, a]: [string, TorrentPeer], [idB, b]: [string, TorrentPeer]) {
  if (field === 'ip') return compareIp(a.ip ?? idA, b.ip ?? idB)
  if (field === 'client') return (a.client ?? '').localeCompare(b.client ?? '')
  return (a[field] ?? 0) - (b[field] ?? 0)
}

const percent = (fraction: number | undefined) => `${Math.round((fraction ?? 0) * 1000) / 10}%`
const speed = (bytes: number | undefined, color: string) =>
  bytes && bytes > 0 ? <span className={color}>{formatBytes(bytes)}/s</span> : <span className="text-muted-foreground/60">-</span>

// The rest of what qBittorrent's peer list shows, as labelled values. Tapping the flags explains them,
// one per line, as hovering doesn't work on phones.
function PeerFacts({ peer }: { peer: TorrentPeer }) {
  const [flagsShown, setFlagsShown] = useState(false)
  const flags = peer.flags?.trim()
  const meanings = (peer.flags_desc ?? '').split('\n').map(line => line.trim()).filter(Boolean)
  const flagsValue = flags && meanings.length > 0 ? (
    <button
      type="button"
      aria-expanded={flagsShown}
      onClick={() => setFlagsShown(shown => !shown)}
      className="rounded-sm underline decoration-dotted underline-offset-2 outline-hidden hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      {flags}
    </button>
  ) : flags || '-'
  // Label, value, an optional tooltip, and whether it takes a whole line (long names do).
  const facts: [string, ReactNode, string?, boolean?][] = [
    [t('Port'), peer.port ?? '-'],
    [t('Connection'), peer.connection || '-'],
    [t('Flags'), flagsValue, peer.flags_desc],
    [t('Downloaded'), formatBytes(peer.downloaded ?? 0)],
    [t('Uploaded'), formatBytes(peer.uploaded ?? 0)],
    [t('Relevance'), percent(peer.relevance)],
    [t('Peer ID client'), peer.peer_id_client || '-', undefined, true],
  ]
  const files = (peer.files ?? '').split('\n').filter(Boolean)
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-0.5 text-xs min-[400px]:grid-cols-2">
      {facts.map(([label, value, title, wide]) => (
        <div key={label} className={cn('flex min-w-0 gap-3', wide && 'col-span-full')}>
          <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
          <dd className="min-w-0 truncate font-medium tabular-nums" title={title || (typeof value === 'string' || typeof value === 'number' ? String(value) : undefined)}>{value}</dd>
        </div>
      ))}
      {flagsShown && (
        <div className="col-span-full rounded-md bg-muted/60 px-2 py-1 text-muted-foreground">
          {meanings.map(line => <p key={line}>{line}</p>)}
        </div>
      )}
      {files.length > 0 && (
        <div className="col-span-full flex min-w-0 gap-2">
          <dt className="w-24 shrink-0 text-muted-foreground">{t('Files')}</dt>
          <dd className="min-w-0 flex-1 font-mono">
            {files.map(file => <p key={file} className="truncate" dir="auto" title={file}>{file}</p>)}
          </dd>
        </div>
      )}
    </dl>
  )
}

// One peer as a table row for wide screens: its address, client, progress and speeds. The arrow at its end opens
// a second row with everything else qBittorrent knows about it.
function PeerRow({ id, peer, children }: { id: string; peer: TorrentPeer; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false)
  const label = expanded ? t('Show less') : t('Show more')
  const cell = 'px-2 py-1.5'
  return (
    <>
      <tr className="align-middle hover:bg-muted/50">
        <td className={cell}>
          <div className="flex min-w-0 items-center gap-2">
            <PeerFlag code={peer.country_code} country={peer.country} />
            <span className="min-w-0 truncate font-mono tabular-nums" dir="ltr" title={peer.ip ?? id}>{peer.ip ?? id}</span>
          </div>
        </td>
        <td className={cell}><span className="block truncate text-muted-foreground" title={peer.client || undefined}>{peer.client || t('Unknown client')}</span></td>
        <td className={cn(cell, 'tabular-nums')}>{percent(peer.progress)}</td>
        <td className={cn(cell, 'truncate tabular-nums')}>{speed(peer.dl_speed, DOWN_SPEED_COLOR)}</td>
        <td className={cn(cell, 'truncate tabular-nums')}>{speed(peer.up_speed, UP_SPEED_COLOR)}</td>
        <td className="px-1 py-0.5">
          <div className="flex justify-end gap-0.5">
            <Button variant="ghost" size="icon" className="size-6" aria-expanded={expanded} aria-label={label} title={label} onClick={() => setExpanded(!expanded)}>
              <ChevronDown className={cn('size-3.5 transition-transform', expanded && 'rotate-180')} />
            </Button>
            {children}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/30">
          <td colSpan={6} className="space-y-1 px-2 py-2">
            {(peer.host_name || peer.country) && (
              <p className="break-all text-muted-foreground">{[peer.host_name, peer.country].filter(Boolean).join(' · ')}</p>
            )}
            <PeerFacts peer={peer} />
          </td>
        </tr>
      )}
    </>
  )
}

// Phones get each peer as two lines instead of a table row, as four columns don't fit in 390px.
function PeerCard({ id, peer, children }: { id: string; peer: TorrentPeer; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false)
  const label = expanded ? t('Show less') : t('Show more')
  return (
    <li className="px-2 py-1.5 text-xs">
      {/* The buttons sit on the first line, beside the address, pulled up so they center on it. */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <PeerFlag code={peer.country_code} country={peer.country} />
            <span className="min-w-0 flex-1 truncate font-mono tabular-nums" dir="ltr" title={peer.ip ?? id}>{peer.ip ?? id}</span>
            <span className="flex shrink-0 gap-2 tabular-nums">{speed(peer.dl_speed, DOWN_SPEED_COLOR)}{speed(peer.up_speed, UP_SPEED_COLOR)}</span>
          </div>
          <p className="truncate text-muted-foreground">{peer.client || t('Unknown client')} · {percent(peer.progress)}</p>
        </div>
        <div className="-my-1 flex shrink-0 gap-0.5">
          <Button variant="ghost" size="icon" className="size-6" aria-expanded={expanded} aria-label={label} title={label} onClick={() => setExpanded(!expanded)}>
            <ChevronDown className={cn('size-3.5 transition-transform', expanded && 'rotate-180')} />
          </Button>
          {children}
        </div>
      </div>
      {expanded && (
        <div className="mt-1.5 space-y-1 rounded-md bg-muted/30 p-2">
          {(peer.host_name || peer.country) && (
            <p className="break-all text-muted-foreground">{[peer.host_name, peer.country].filter(Boolean).join(' · ')}</p>
          )}
          <PeerFacts peer={peer} />
        </div>
      )}
    </li>
  )
}

export function PeersTab({ hash }: { hash: string }) {
  const { data, isLoading, isError } = useTorrentPeers(hash)
  const peers = data?.peers
  const action = useTorrentAction()
  const [newPeers, setNewPeers] = useState('')

  const add = async (e: FormEvent) => {
    e.preventDefault()
    const { valid, invalid } = parsePeerAddresses(newPeers)
    if (invalid.length > 0 || valid.length === 0) {
      toast.error(t('Enter peers as IP:port'), { description: invalid.length > 0 ? t('Can\'t use: {value}', { value: invalid.join(', ') }) : undefined })
      return
    }

    try {
      const results = await action.mutateAsync({
        work: () => qbitClient.addPeers([hash], valid),
        failed: t('Failed to add peers'),
      }) as Awaited<ReturnType<typeof qbitClient.addPeers>>
      setNewPeers('')
      const { added = 0, failed = 0 } = results[hash] ?? {}
      if (failed > 0) toast.warning(t('Added {added}, couldn\'t add {failed}', { added, failed }), { description: t('The Logs page may say why.') })
      else toast.success(added === 1 ? t('Peer added') : t('Added {added} peers', { added }))
    } catch {
      // The action already showed the error.
    }
  }

  const ban = (address: string) => {
    action.mutateAsync({
      work: () => qbitClient.banPeers([address]),
      failed: t('Failed to ban peer'),
    }).then(() => { toast.success(t('Peer banned')) }, () => undefined)
  }

  // Fastest downloads first until a column is picked; the titles mark only an order picked.
  const [picked, setPicked] = useState<ListSort<SortField> | null>(null)
  const sort = picked ?? DEFAULT_SORT
  // The search matches the address, client, country and host name.
  const [search, setSearch] = useState('')
  const total = Object.keys(peers ?? {}).length
  const entries = useMemo(() => {
    const wanted = search.trim().toLowerCase()
    const list = Object.entries(peers ?? {}).filter(([id, peer]) => !wanted || [peer.ip ?? id, peer.client, peer.country, peer.host_name].some(value => value?.toLowerCase().includes(wanted)))
    return list.sort((a, b) => (sort.descending ? -1 : 1) * comparePeers(sort.field, a, b))
  }, [peers, sort, search])
  const noSort = { field: '' as SortField, descending: false }
  const sortBy = (field: SortField) => setPicked(nextSort(picked ?? noSort, field))

  const status = (text: string) => <p className="py-6 text-center text-xs text-muted-foreground">{text}</p>
  const headCell = 'truncate px-2 py-1 text-start text-xs font-medium tracking-wide whitespace-nowrap text-muted-foreground uppercase'

  // Sorted from the arrows' menu, or by clicking a column title.
  const sortControls = <SortMenu fields={sortFields.map(([field, label]) => [field, label()])} sort={sort} onSort={sortBy} onReset={() => setPicked(null)} isDefault={!picked} />

  const banButton = (id: string, peer: TorrentPeer) => (
    <ConfirmAction
      small
      label={t('Ban {value}', { value: peer.ip ?? id })}
      title={t('Ban this peer?')}
      message={t('{value} will be banned from every torrent, not only this one. You can undo this under Settings > Connection > Banned peers.', { value: peer.ip ?? id })}
      confirmLabel={t('Ban')}
      disabled={action.isPending}
      onConfirm={() => ban(id)}
    >
      <Ban className="size-3" />
    </ConfirmAction>
  )


  return (
    <div className="space-y-4 pt-1 pb-3">
      <section>
        {/* The search, how many peers there are, and the sorting, on one row, as in Content. */}
        <div className="flex items-center gap-2 px-2 pb-1.5">
          <SearchInput aria-label={t('Search')} placeholder={t('Search')} value={search} onValueChange={setSearch} className="w-40 min-w-0 shrink sm:w-64" inputClassName="h-7 text-xs" />
          <span className="ms-auto shrink-0 text-xs text-muted-foreground tabular-nums">{total === 1 ? t('1 peer') : t('{count} peers', { count: total })}</span>
          {sortControls}
        </div>
        {isLoading ? status(t('Loading peers...'))
          : isError && !peers ? status(t('Couldn\'t load peers'))
          : total === 0 ? status(t('No peers connected'))
          : entries.length === 0 ? status(t('Nothing matches'))
          : (
            <>
              {/* Phones: titles over the cards, as Content has over its rows. */}
              <div className="flex items-center gap-2 border-b px-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase sm:hidden">
                <span className="min-w-0 flex-1 truncate">{t('IP address')}</span>
                <span className="shrink-0">{t('Speed')}</span>
                <span aria-hidden className="w-[3.25rem] shrink-0" />
              </div>
              <ul className="sm:hidden">
                {entries.map(([id, peer]) => <PeerCard key={id} id={id} peer={peer}>{banButton(id, peer)}</PeerCard>)}
              </ul>
              <div className="overflow-x-auto max-sm:hidden">
                {/* Widths are set on the titles, so a column hidden on phones takes no room. */}
                <table className="w-full table-fixed text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className={headCell}><SortTitle field="ip" sort={picked ?? noSort} onSort={sortBy}>{t('IP address')}</SortTitle></th>
                      <th className={cn(headCell, 'w-34')}><SortTitle field="client" sort={picked ?? noSort} onSort={sortBy}>{t('Client')}</SortTitle></th>
                      <th className={cn(headCell, 'w-24')}><SortTitle field="progress" sort={picked ?? noSort} onSort={sortBy}>{t('Progress')}</SortTitle></th>
                      <th className={cn(headCell, 'w-28')}><SortTitle field="dl_speed" sort={picked ?? noSort} onSort={sortBy}>{t('Down speed')}</SortTitle></th>
                      <th className={cn(headCell, 'w-28')}><SortTitle field="up_speed" sort={picked ?? noSort} onSort={sortBy}>{t('Up speed')}</SortTitle></th>
                      <th className={cn(headCell, 'w-14')}><span className="sr-only">{t('Show more')}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(([id, peer]) => (
                      <PeerRow key={id} id={id} peer={peer}>{banButton(id, peer)}</PeerRow>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
      </section>

      {data && !data.showFlags && entries.length > 0 && (
        <p className="px-2 text-xs text-muted-foreground">{t('To see each peer\'s country, turn on Resolve peer countries in Settings, Advanced.')}</p>
      )}

      {/* Below the list, as Trackers adds trackers. */}
      <form onSubmit={add} className="space-y-1 border-t px-2 pt-3">
        <Label htmlFor="new-peers" className="text-xs text-muted-foreground">{t('Add peers, as IP:port, one per line')}</Label>
        {/* Laid out like the Comment field under Actions: the box with its button beside it. */}
        <div className="flex max-w-3xl items-start gap-2">
          <Textarea
            id="new-peers"
            rows={2}
            wrapperClassName="min-w-0 flex-1"
            value={newPeers}
            onChange={(e) => setNewPeers(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.currentTarget.form?.requestSubmit() } }}
            placeholder={'203.0.113.5:6881\n[2001:db8::1]:6881'}
            className="min-h-14 px-2 py-1 font-mono text-xs"
            dir="ltr"
          />
          <Button type="submit" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs [&_svg:not([class*=size-])]:size-3.5" disabled={action.isPending} title={t('Ctrl or ⌘ and Enter')}><Plus />{t('Add peers')}</Button>
        </div>
      </form>
    </div>
  )
}
