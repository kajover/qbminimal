import { createElement, memo, useLayoutEffect, useRef, useState } from 'react'
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

// The events a card hands on to the list's row handlers.
const EVENTS = ['onPointerDown', 'onPointerMove', 'onPointerUp', 'onPointerCancel', 'onClick', 'onContextMenu', 'onFocus', 'onKeyDown'] as const
type CardHandlers = Pick<RowProps, typeof EVENTS[number]> & { onToggle: (range: boolean) => void }

// One card. It draws again only when its own torrent, selection, open state or focus changes, so a
// click redraws the two or three cards it affects, not the whole page of them. Its handlers stay
// the same and pass each event on to the list's current ones.
const TorrentCard = memo(function TorrentCard({ torrent, isSelected, isOpen, showCheckboxes, tabIndex, handlers }: {
  torrent: Torrent
  isSelected: boolean
  isOpen: boolean
  showCheckboxes: boolean
  tabIndex: number | undefined
  handlers: CardHandlers
}) {
  const { onToggle, ...events } = handlers
  return (
    <li
      {...events}
      data-hash={torrent.hash}
      tabIndex={tabIndex}
      aria-selected={isSelected}
      aria-current={isOpen ? 'true' : undefined}
      className={cn(
        'flex cursor-default touch-manipulation items-start gap-2 rounded-xl border bg-card px-2.5 py-2.5 outline-hidden select-none focus-visible:ring-2 focus-visible:ring-ring [-webkit-touch-callout:none]',
        // Selected or open, a card only gets a stronger border all round, the same everywhere.
        (isSelected || isOpen) && 'border-primary ring-1 ring-primary',
      )}
    >
      {showCheckboxes && (
        <Checkbox
          // Its top meets the top of the first line, as the status icon's does.
          className="mt-px"
          aria-label={t('Select {name}', { name: torrent.name })}
          checked={isSelected}
          onClick={(e) => { e.preventDefault(); onToggle(e.shiftKey) }}
        />
      )}
      <div className="min-w-0 flex-1">
        {/* The status has room for the usual ones ("Downloading", "Missing Files"), so the
            percentage beside it stays put as the status changes. */}
        <div className="flex items-center gap-x-7 text-xs whitespace-nowrap">
          {/* The table's status icon, then the status, in its color without a badge. */}
          <span className={cn('inline-flex min-w-[8em] shrink-0 items-center gap-1.5', getStateColor(torrent.state, torrent.completion_on))} title={torrent.error || undefined}>
            {createElement(getStateIcon(torrent.state, torrent.completion_on), { 'aria-hidden': true, className: 'size-3 shrink-0' })}
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
})

// The phone layout: one card per torrent. A tap opens its details, and holding a card starts
// selecting, after which taps add or remove cards. Wide screens get a grid. On phones the cards
// reach 8px from the screen's edges, which gives a card's line of facts room at 12px.
export function TorrentCards({ torrents, selected, showCheckboxes, onToggle, openHash, rowProps, wrapList }: TorrentCardsProps) {
  // The newest handlers and torrents, for the cards' unchanging handlers to call.
  const latest = useRef({ rowProps, onToggle, torrents })
  useLayoutEffect(() => { latest.current = { rowProps, onToggle, torrents } })
  // One set of handlers per torrent for as long as the list is shown.
  const [cache] = useState(() => new Map<string, CardHandlers>())
  const handlersFor = (hash: string): CardHandlers => {
    let handlers = cache.get(hash)
    if (!handlers) {
      const forward = (name: typeof EVENTS[number]) => (event: never) => {
        const torrent = latest.current.torrents.find(t => t.hash === hash)
        const handler = torrent && latest.current.rowProps(torrent)[name] as ((event: never) => void) | undefined
        handler?.(event)
      }
      handlers = Object.fromEntries(EVENTS.map(name => [name, forward(name)])) as unknown as CardHandlers
      handlers.onToggle = (range) => latest.current.onToggle(hash, range)
      cache.set(hash, handlers)
    }
    return handlers
  }
  return wrapList(
    // One column that may shrink, so a card with its checkbox stays within a phone's width.
    <ul data-list-edge className="grid grid-cols-1 items-start gap-2 max-sm:-mx-2 lg:grid-cols-2 2xl:grid-cols-3">
      {torrents.map(torrent => (
        <TorrentCard
          key={torrent.hash}
          torrent={torrent}
          isSelected={selected.has(torrent.hash)}
          isOpen={openHash === torrent.hash}
          showCheckboxes={showCheckboxes}
          tabIndex={rowProps(torrent).tabIndex}
          handlers={handlersFor(torrent.hash)}
        />
      ))}
    </ul>,
  )
}
