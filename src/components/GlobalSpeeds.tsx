import { useTotalSpeeds, useTransferInfo } from '@/hooks/useApi'
import { formatBytes } from '@/lib/format'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

// Current speeds in the header, download above upload, when turned on in Settings. Each arrow
// keeps its place at the start of a slot as wide as the widest speed ("999.9 MB/s", measured by an
// invisible copy), and the number ends at the slot's end, so a changing speed never moves the
// header's buttons. A limit that's set shows faintly after its speed, on the same line, in a slot
// of its own, so the header stays low; while qBittorrent's alternative
// ("slow") limits are on, the speeds are amber. Clicking opens the statistics, which hold the switch
// for the alternative limits; the limits themselves are set in Settings.
export function GlobalSpeeds({ onOpen }: { onOpen: () => void }) {
  const { data: speeds } = useTotalSpeeds()
  const { data: state } = useTransferInfo()
  if (!speeds) return null
  const alternative = state?.use_alt_speed_limits === true

  // Both rows get a limit's slot when either has a limit, so they stay the same width.
  const limited = (state?.dl_rate_limit ?? 0) > 0 || (state?.up_rate_limit ?? 0) > 0
  // The widest copy sets the slot's width; what shows only fills it (w-0 min-w-full), so it never
  // widens it.
  const slot = (widest: ReactNode, content: ReactNode, className?: string) => (
    <span className={cn('grid', className)}>
      <span aria-hidden className="invisible col-start-1 row-start-1 flex gap-1">{widest}</span>
      <span className="col-start-1 row-start-1 flex w-0 min-w-full items-center justify-between gap-1">{content}</span>
    </span>
  )
  const row = (arrow: string, speed: number, limit: number | undefined) => (
    <span className="flex items-center gap-1.5">
      {slot(<><span>{arrow}</span><span>999.9 MB/s</span></>, <><span aria-hidden>{arrow}</span><span>{formatBytes(speed)}/s</span></>)}
      {limited && slot('≤ 999.9 MB/s', !!limit && limit > 0 && <span>≤ {formatBytes(limit)}/s</span>, 'opacity-60')}
    </span>
  )
  return (
    <button
      type="button"
      onClick={onOpen}
      title={t('Statistics')}
      aria-label={`${t('Current speeds')}: ↓ ${formatBytes(speeds.down)}/s, ↑ ${formatBytes(speeds.up)}/s${alternative ? `. ${t('Alternative speed limits are on')}` : ''}. ${t('Statistics')}`}
      className={cn(
        'hidden shrink-0 flex-col rounded-md px-1 py-0.5 text-xs leading-tight tabular-nums whitespace-nowrap outline-hidden hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring [:root[data-header-speeds=on]_&]:flex',
        alternative && 'bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-400',
      )}
    >
      {row('↓', speeds.down, state?.dl_rate_limit)}
      {row('↑', speeds.up, state?.up_rate_limit)}
    </button>
  )
}
