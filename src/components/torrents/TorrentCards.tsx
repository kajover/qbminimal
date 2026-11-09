import type { ComponentType, ReactElement, ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Clock, HardDrive, Users } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { formatBytes } from '@/lib/format'
import { DOWN_SPEED_COLOR, formatEta, getStateColor, getStateLabel, ratioColor, UP_SPEED_COLOR, peerPair as pair } from '@/lib/torrentState'
import { cn } from '@/lib/utils'
import type { RowProps } from '@/hooks/useRowPress'
import type { Torrent } from '@/types'
import { t } from '@/i18n'

interface TorrentCardsProps {
  torrents: Torrent[]
  selected: ReadonlySet<string>
  // Checkboxes show while selecting, and always where there's a mouse.
  showCheckboxes: boolean
  onToggle: (hash: string, range: boolean) => void
  openHash: string | null
  rowProps: (torrent: Torrent) => RowProps
  wrapList: (list: ReactElement) => ReactNode
}

// A number with an icon in place of its name, which the tooltip and screen readers give. Each
// sits at the end of a slot with room for its longest usual value, so the gaps between facts are
// all the same and none moves when a number changes.
// A fact in a slot as wide as its placeholder, like the speeds' "999.9 KB/s": the icon at the
// slot's start and the value at its end, so a changing value never moves what follows.
function Fact({ icon: Icon, label, placeholder, className, children }: { icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>; label: string; placeholder: string; className?: string; children: ReactNode }) {
  const row = (content: ReactNode, hidden?: boolean) => (
    <span className={cn('col-start-1 row-start-1 flex items-center justify-between gap-0.5', hidden && 'invisible')} aria-hidden>
      {Icon && <Icon className="size-3" aria-hidden />}
      <span className="ms-auto">{content}</span>
    </span>
  )
  return (
    <span className={cn('grid shrink-0', className)} title={label}>
      {row(placeholder, true)}
      {row(children)}
      <span className="sr-only">{label}</span>
    </span>
  )
}

// A speed in the list's colors. The arrow starts a slot with room for "999.9 KB/s" and the number
// ends it; the rare longer speed widens it. At zero the slot stays, empty, so nothing after it moves.
function Speed({ icon: Icon, bytes, color, label }: { icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>; bytes: number; color: string; label: string }) {
  // Idle speeds read "0 B/s" like the header's, faded instead of colored.
  return (
    <span className={cn('flex min-w-[6.4em] shrink-0 items-center justify-between gap-0.5', bytes > 0 ? color : 'text-muted-foreground/60')} title={label}>
      <Icon className="size-3" aria-hidden />
      {formatBytes(bytes)}/s
    </span>
  )
}

// The phone layout: one card per torrent. A tap opens its details, and holding a card starts
// selecting, after which taps add or remove cards. Wide screens get a grid. On phones the cards
// reach 8px from the screen's edges, which gives a card's line of facts room at 12px.
export function TorrentCards({ torrents, selected, showCheckboxes, onToggle, openHash, rowProps, wrapList }: TorrentCardsProps) {
  return wrapList(
    <ul className="grid items-start gap-2 max-sm:-mx-2 lg:grid-cols-2 2xl:grid-cols-3">
      {torrents.map(torrent => {
        const isSelected = selected.has(torrent.hash)
        return (
          <li
            key={torrent.hash}
            {...rowProps(torrent)}
            aria-selected={isSelected}
            aria-current={openHash === torrent.hash ? 'true' : undefined}
            className={cn(
              'flex cursor-default items-start gap-2 rounded-xl border bg-card px-2.5 py-2.5 shadow-sm transition-[transform,border-color] outline-hidden select-none focus-visible:ring-2 focus-visible:ring-ring [-webkit-touch-callout:none] active:scale-[0.99]',
              isSelected && 'border-primary ring-1 ring-primary',
              openHash === torrent.hash && 'bg-primary/10 shadow-[inset_3px_0_0_var(--color-primary)] rtl:shadow-[inset_-3px_0_0_var(--color-primary)]',
              openHash === torrent.hash && !isSelected && 'border-primary/50',
            )}
          >
            {showCheckboxes && (
              <Checkbox
                className="mt-0.5"
                aria-label={t('Select {name}', { name: torrent.name })}
                checked={isSelected}
                onClick={(e) => { e.preventDefault(); onToggle(torrent.hash, e.shiftKey) }}
              />
            )}
            <div className="min-w-0 flex-1">
              {/* The status has room for the usual ones ("Downloading", "Missing Files"), so the
                  percentage beside it stays put as the status changes. */}
              <div className="flex items-center gap-x-3 text-xs whitespace-nowrap">
                <span className={cn('min-w-[6.6em] shrink-0', getStateColor(torrent.state, torrent.completion_on))} title={torrent.error || undefined}>{getStateLabel(torrent.state, torrent.completion_on)}</span>
                <span className="text-muted-foreground tabular-nums">{Math.round(torrent.progress * 100)}%</span>
              </div>
              <p className="text-sm font-medium wrap-anywhere">{torrent.name}</p>
              {/* One line of facts, each with an icon. Hovering or a screen reader gives the words. */}
              {/* Packed from the start with one even gap, 12px where there's room and down to 4px on
                  narrow phones, so the five facts (about 20rem) stay on one line. Every fact sits in a
                  slot sized for a typical largest value, so nothing moves when values change and the
                  cards line up. */}
              <div className="mt-0.5 flex items-center gap-x-[clamp(0.25rem,calc((100%-20rem)/4),0.75rem)] gap-y-0.5 overflow-hidden text-xs [:root[data-text-size]_&]:flex-wrap whitespace-nowrap text-muted-foreground tabular-nums">
                <Fact icon={HardDrive} label={t('Size')} placeholder="999.9 MB">{formatBytes(torrent.size)}</Fact>
                <Speed icon={ArrowDown} bytes={torrent.dlspeed} color={DOWN_SPEED_COLOR} label={t('Down speed')} />
                <Speed icon={ArrowUp} bytes={torrent.upspeed} color={UP_SPEED_COLOR} label={t('Up speed')} />
                {torrent.progress < 1 ? (
                  <Fact icon={Clock} label={t('ETA {eta}', { eta: formatEta(torrent.eta) })} placeholder="99.99">{formatEta(torrent.eta)}</Fact>
                ) : (
                  <Fact icon={ArrowUpDown} label={t('Ratio {value}', { value: torrent.ratio.toFixed(2) })} placeholder="99.99" className={ratioColor(torrent.ratio)}>{torrent.ratio.toFixed(2)}</Fact>
                )}
                {/* Connected seeds and peers; the title adds how many are in the swarm. */}
                <Fact icon={Users} label={t('Seeds {seeds} · Peers {peers}', { seeds: pair(torrent.num_seeds, torrent.num_complete), peers: pair(torrent.num_leechs, torrent.num_incomplete) })} placeholder="99/99">
                  {Math.max(torrent.num_seeds, 0)}/{Math.max(torrent.num_leechs, 0)}
                </Fact>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-primary transition-[width]" style={{ width: `${torrent.progress * 100}%` }} />
              </div>
            </div>
          </li>
        )
      })}
    </ul>,
  )
}
