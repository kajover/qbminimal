import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Ban, ChevronDown } from 'lucide-react'
import { NativeSelect } from '@/components/NativeSelect'
import { BannedPeers } from '@/components/BannedPeers'
import { ConfirmAction } from '@/components/ConfirmAction'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTorrentAction, useTorrentPeers } from '@/hooks/useApi'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import { parsePeerAddresses } from '@/lib/peers'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'
import { DOWN_SPEED_COLOR, UP_SPEED_COLOR } from '@/lib/torrentState'
import type { TorrentPeer } from '@/types'
import { PeerFlag } from './PeerFlag'
import { t } from '@/i18n'

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
      className="rounded-sm underline decoration-dotted underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
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
    <dl className="mt-1 grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs min-[400px]:grid-cols-2">
      {facts.map(([label, value, title, wide]) => (
        <div key={label} className={cn('flex min-w-0 justify-between gap-2', wide && 'col-span-full')}>
          <dt className="shrink-0 text-muted-foreground">{label}</dt>
          <dd className="min-w-0 truncate text-end tabular-nums" title={title || (typeof value === 'string' || typeof value === 'number' ? String(value) : undefined)}>{value}</dd>
        </div>
      ))}
      {flagsShown && (
        <div className="col-span-full rounded-md bg-muted/60 px-2 py-1 text-muted-foreground">
          {meanings.map(line => <p key={line}>{line}</p>)}
        </div>
      )}
      {files.length > 0 && (
        <div className="col-span-full flex min-w-0 gap-2">
          <dt className="shrink-0 text-muted-foreground">{t('Files')}</dt>
          <dd className="min-w-0 flex-1 text-end">
            {files.map(file => <p key={file} className="truncate" dir="auto" title={file}>{file}</p>)}
          </dd>
        </div>
      )}
    </dl>
  )
}

// One peer, compact: its address, client, progress and speeds on two short lines. The arrow
// beside it opens everything else qBittorrent knows about it.
function PeerRow({ id, peer, children }: { id: string; peer: TorrentPeer; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false)
  const label = expanded ? t('Show less') : t('Show more')
  return (
    <li className="flex items-start gap-2 px-2 py-1.5">
      <PeerFlag code={peer.country_code} country={peer.country} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="min-w-0 truncate font-medium text-foreground tabular-nums" dir="ltr" title={peer.ip ?? id}>{peer.ip ?? id}</p>
          <p className="ms-auto shrink-0 text-xs text-muted-foreground tabular-nums">{percent(peer.progress)}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
          <span className="min-w-0 truncate" title={peer.client || undefined}>{peer.client || t('Unknown client')}</span>
          <span className="ms-auto shrink-0">↓ {speed(peer.dl_speed, DOWN_SPEED_COLOR)}</span>
          <span className="shrink-0">↑ {speed(peer.up_speed, UP_SPEED_COLOR)}</span>
        </div>
        {expanded && (
          <>
            {(peer.host_name || peer.country) && (
              <p className="mt-1 break-all text-xs text-muted-foreground">{[peer.host_name, peer.country].filter(Boolean).join(' · ')}</p>
            )}
            <PeerFacts peer={peer} />
          </>
        )}
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" aria-expanded={expanded} aria-label={label} title={label} onClick={() => setExpanded(!expanded)}>
        <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
      </Button>
      {children}
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

  const [sortField, setSortField] = useState<SortField>('dl_speed')
  const [descending, setDescending] = useState(true)
  const entries = useMemo(() => {
    const list = Object.entries(peers ?? {})
    return list.sort((a, b) => (descending ? -1 : 1) * comparePeers(sortField, a, b))
  }, [peers, sortField, descending])
  const sortLabel = t('Sort: {column}', { column: sortFields.find(([f]) => f === sortField)![1]() })

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">{t('Loading peers...')}</div>
      ) : isError && !peers ? (
        <div className="py-8 text-center text-sm text-muted-foreground">{t('Couldn\'t load peers')}</div>
      ) : entries.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">{t('No peers connected')}</div>
      ) : (
        <>
        <div className="flex items-center gap-2 px-2">
          <NativeSelect aria-label={sortLabel} className="h-8 flex-1" value={sortField} onChange={(e) => setSortField(e.target.value as SortField)}>
            {sortFields.map(([field, label]) => <option key={field} value={field}>{label()}</option>)}
          </NativeSelect>
          <Button type="button" variant="outline" size="icon" className="h-8 w-8 flex-shrink-0" aria-label={sortLabel} title={sortLabel} onClick={() => setDescending(d => !d)}>
            {descending ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
          </Button>
        </div>
        <ul className="divide-y text-sm">
          {entries.map(([id, peer]) => (
            <PeerRow key={id} id={id} peer={peer}>
              <ConfirmAction
                label={t('Ban {value}', { value: peer.ip ?? id })}
                title={t('Ban this peer?')}
                message={t('{value} will be banned from every torrent, not only this one. You can undo this with Unban, below the peer list.', { value: peer.ip ?? id })}
                confirmLabel={t('Ban')}
                disabled={action.isPending}
                onConfirm={() => ban(id)}
              >
                <Ban className="h-3.5 w-3.5" />
              </ConfirmAction>
            </PeerRow>
          ))}
        </ul>
        </>
      )}

      {data && !data.showFlags && entries.length > 0 && (
        <p className="px-2 text-xs text-muted-foreground">{t('To see each peer\'s country, turn on Resolve peer countries in Settings, Advanced.')}</p>
      )}

      <form onSubmit={add} className="space-y-1 border-t px-2 pb-2 pt-3">
        <Label htmlFor="new-peers" className="text-xs text-muted-foreground">{t('Add peers, as IP:port')}</Label>
        <div className="flex gap-2">
          <Input id="new-peers" value={newPeers} placeholder="203.0.113.5:6881" onChange={(e) => setNewPeers(e.target.value)} className="h-8 text-sm" />
          <Button type="submit" size="sm" variant="outline" disabled={action.isPending}>{t('Add')}</Button>
        </div>
      </form>

      <div className="space-y-1 border-t px-2 pb-2 pt-3">
        <h3 className="text-xs text-muted-foreground">{t('Banned peers, across all torrents')}</h3>
        <BannedPeers />
      </div>
    </div>
  )
}
