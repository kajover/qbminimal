import { createElement } from 'react'
import type { ComponentType, ReactElement, ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Clock, HardDrive, Users } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { formatBytes } from '@/lib/format'
import { getStateIcon } from '@/lib/stateIcons'
import { DOWN_SPEED_COLOR, formatEta, getStateColor, getStateLabel, UP_SPEED_COLOR, peerPair as pair } from '@/lib/torrentState'
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
// fact sits in a slot as wide as its placeholder, a typical largest value: the value follows its
// icon closely, and the slot's fixed width keeps the gaps between facts even and stops a changing
// value from moving what follows.
function Fact({ icon: Icon, label, placeholder, className, children }: { icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>; label: string; placeholder: string; className?: string; children: ReactNode }) {
  const row = (content: ReactNode, hidden?: boolean) => (
    <span className={cn('col-start-1 row-start-1 flex items-center gap-0.5', hidden && 'invisible')} aria-hidden>
      {Icon && <Icon className="size-3 shrink-0" aria-hidden />}
      <span>{content}</span>
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

// A speed in the list's colors, in a slot that fits "999.9 KB/s", so a changing speed never moves
// the facts after it; only the rare longer one widens it. Idle speeds read "0 B/s" like the
// header's, faded instead of colored.
function Speed({ icon, bytes, color, label }: { icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>; bytes: number; color: string; label: string }) {
  return <Fact icon={icon} label={label} placeholder="999.9 KB/s" className={bytes > 0 ? color : 'text-muted-foreground/60'}>{formatBytes(bytes)}/s</Fact>
}

// The phone layout: one card per torrent. A tap opens its details, and holding a card starts
// selecting, after which taps add or remove cards. Wide screens get a grid. On phones the cards
// reach 8px from the screen's edges, which gives a card's line of facts room at 12px.
export function TorrentCards({ torrents, selected, showCheckboxes, onToggle, openHash, rowProps, wrapList }: TorrentCardsProps) {
  return wrapList(
    // One column that may shrink, so a card with its checkbox stays within a phone's width.
    <ul className="grid grid-cols-1 items-start gap-2 max-sm:-mx-2 lg:grid-cols-2 2xl:grid-cols-3">
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
              <div className="flex items-center gap-x-7 text-xs whitespace-nowrap">
                {/* The table's status icon, then the status, in its color without a badge. */}
                <span className={cn('inline-flex min-w-[8em] shrink-0 items-center gap-1.5', getStateColor(torrent.state, torrent.completion_on))} title={torrent.error || undefined}>
                  {createElement(getStateIcon(torrent.state, torrent.completion_on), { 'aria-hidden': true, className: 'size-3.5 shrink-0' })}
                  {getStateLabel(torrent.state, torrent.completion_on)}
                </span>
                <span className="text-muted-foreground tabular-nums">{Math.round(torrent.progress * 100)}%</span>
              </div>
              <p className="text-sm wrap-anywhere">{torrent.name}</p>
              {/* One line of facts, each with an icon. Hovering or a screen reader gives the words. */}
              {/* One line, packed from the start with one even gap: 12px where there's room, down to 2px
                  on small phones, so the five facts (about 20rem) fit from about 360px wide. Every fact
                  but the last sits in a slot sized for a typical largest value, so nothing moves when
                  values change and the cards line up; the peers come last, where a longer count moves
                  nothing. */}
              <div className="mt-0.5 flex items-center gap-x-[clamp(0.125rem,calc((100%-20rem)/4),0.75rem)] gap-y-0.5 text-xs whitespace-nowrap [:root[data-text-size]_&]:flex-wrap text-muted-foreground tabular-nums">
                <Fact icon={HardDrive} label={t('Size')} placeholder="999.9 MB">{formatBytes(torrent.size)}</Fact>
                <Speed icon={ArrowDown} bytes={torrent.dlspeed} color={DOWN_SPEED_COLOR} label={t('Down speed')} />
                <Speed icon={ArrowUp} bytes={torrent.upspeed} color={UP_SPEED_COLOR} label={t('Up speed')} />
                {torrent.progress < 1 ? (
                  <Fact icon={Clock} label={t('ETA {eta}', { eta: formatEta(torrent.eta) })} placeholder="99.99">{formatEta(torrent.eta)}</Fact>
                ) : (
                  <Fact icon={ArrowUpDown} label={t('Ratio {value}', { value: torrent.ratio.toFixed(2) })} placeholder="99.99">{torrent.ratio.toFixed(2)}</Fact>
                )}
                {/* Connected seeds and peers; the title adds how many are in the swarm. Last, so it
                    needs no slot of its own. */}
                <Fact icon={Users} label={t('Seeds {seeds} · Peers {peers}', { seeds: pair(torrent.num_seeds, torrent.num_complete), peers: pair(torrent.num_leechs, torrent.num_incomplete) })} placeholder="">
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
