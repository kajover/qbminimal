import { useTotalSpeeds, useTransferInfo } from '@/hooks/useApi'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

// Current speeds in the header, download above upload, when turned on in Settings. Each arrow
// keeps its place at the start of a slot with room for "999.9 KB/s", and the number ends at the
// slot's end. A limit that's set shows faintly below its speed; while qBittorrent's alternative
// ("slow") limits are on, the speeds are amber. Only a readout: the limits are set in Settings, and
// the alternative ones switched in the statistics.
export function GlobalSpeeds() {
  const { data: speeds } = useTotalSpeeds()
  const { data: state } = useTransferInfo()
  if (!speeds) return null
  const alternative = state?.use_alt_speed_limits === true

  const row = (arrow: string, speed: number, limit: number | undefined) => (
    <span className="flex flex-col items-stretch">
      <span className="flex min-w-[6.4em] items-center justify-between gap-1">
        <span aria-hidden>{arrow}</span>
        <span>{formatBytes(speed)}/s</span>
      </span>
      {!!limit && limit > 0 && <span className="text-end text-[0.8em] opacity-70">≤ {formatBytes(limit)}/s</span>}
    </span>
  )
  return (
    <div
      role="status"
      aria-label={`${t('Current speeds')}: ↓ ${formatBytes(speeds.down)}/s, ↑ ${formatBytes(speeds.up)}/s${alternative ? `. ${t('Alternative speed limits are on')}` : ''}`}
      className={cn(
        'hidden shrink-0 flex-col rounded-md px-1 py-0.5 text-xs leading-tight tabular-nums whitespace-nowrap [:root[data-header-speeds=on]_&]:flex',
        alternative && 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
      )}
    >
      {row('↓', speeds.down, state?.dl_rate_limit)}
      {row('↑', speeds.up, state?.up_rate_limit)}
    </div>
  )
}
