import type { ReactNode } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/CopyButton'
import { getTorrentExportUrl } from '@/lib/api'
import { formatBytes, formatDateTime, formatDuration } from '@/lib/format'
import { DOWN_SPEED_COLOR, ratioColor, UP_SPEED_COLOR } from '@/lib/torrentState'
import { cn } from '@/lib/utils'
import type { Torrent } from '@/types'
import { DetailsHeading } from './DetailsHeading'
import { PieceBar } from './PieceBar'
import { SpeedChart } from './SpeedChart'
import { t } from '@/i18n'

// Laid out like qui's: the torrent's identifiers first, each with a copy button, then its figures
// in compact columns, then its pieces. Values a qBittorrent version doesn't send are left out.

type Value = ReactNode | undefined | false
const shown = (value: Value) => value !== undefined && value !== false && value !== '' && value !== null

// An identifier or path: its name above, the value in a fixed-width font, and a copy button.
// `wide` spans both columns; `empty` is shown, without a copy button, when there's no value.
function Identity({ label, value, wide, empty }: { label: string; value: string | undefined; wide?: boolean; empty?: string }) {
  if (!value && !empty) return null
  return (
    <div className={cn('min-w-0', wide && 'sm:col-span-2')}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex min-h-6 min-w-0 items-center gap-1">
        {value ? (
          <>
            <span className={cn('truncate', wide ? 'text-sm font-medium' : 'font-mono text-xs')} dir={wide ? 'auto' : 'ltr'} title={value}>{value}</span>
            <CopyButton text={value} label={label} className="size-6" />
          </>
        ) : <span className="text-xs text-muted-foreground">{empty}</span>}
      </dd>
    </div>
  )
}

// One figure in a column: the name on the left, the value on the right.
function Stat({ label, value, className }: { label: string; value: Value; className?: string }) {
  if (!shown(value)) return null
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5 text-xs">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn('truncate text-end font-medium tabular-nums', className)} title={typeof value === 'string' ? value : undefined}>{value}</dd>
    </div>
  )
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <DetailsHeading>{title}</DetailsHeading>
      <dl>{children}</dl>
    </section>
  )
}

const limit = (bytes: number | undefined) => (bytes && bytes > 0 ? `${formatBytes(bytes)}/s` : '∞')
// qBittorrent's -2 means the global setting, -1 no limit.
const shareLimit = (value: number | undefined, format: (n: number) => string) =>
  value === undefined ? undefined : value === -2 ? t('Global') : value < 0 ? '∞' : format(value)

export function TorrentInfoTab({ torrent: x }: { torrent: Torrent }) {
  const has = (n: number | undefined) => n !== undefined && n >= 0
  const pair = (a: number, b: number) => `${Math.max(a, 0)} / ${Math.max(b, 0)}`
  const exportButton = x.has_metadata === false ? (
    <span className="inline-flex cursor-not-allowed" title={t('Available once qBittorrent has this torrent\'s metadata')}>
      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" disabled><Download />{t('Export .torrent')}</Button>
    </span>
  ) : (
    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" asChild>
      <a href={getTorrentExportUrl(x.hash)} download={`${x.name}.torrent`}><Download />{t('Export .torrent')}</a>
    </Button>
  )

  return (
    <div className="space-y-4 px-2 pt-1 pb-3">
      {/* Web API 2.17.0 and newer say why a torrent stopped with an error. */}
      {x.error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{x.error}</p>}

      <section>
        <DetailsHeading end={exportButton}>{t('About')}</DetailsHeading>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <Identity label={t('Name')} value={x.name} wide />
          <Identity label={t('Hash')} value={x.hash} />
          <Identity label={t('Hash (v2)')} value={x.infohash_v2} />
          <Identity label={t('Save path')} value={x.save_path} />
          {/* qBittorrent's temporary path; shown even when unused, so it's clear where files go. */}
          <Identity label={t('Incomplete files')} value={x.download_path} empty={t('In the save path')} />
          <Identity label={t('Magnet link')} value={x.magnet_uri} />
          <Identity label={t('Comment')} value={x.comment} />
        </dl>
      </section>

      <div className="grid gap-x-6 gap-y-4 border-t pt-3 sm:grid-cols-2 xl:grid-cols-4">
        <Column title={t('Transfer')}>
          <Stat label={t('Progress')} value={t('{part} of {whole}', { part: `${Math.floor(x.progress * 100)}%`, whole: formatBytes(x.size) })} />
          <Stat label={t('Downloaded')} value={formatBytes(x.downloaded ?? x.total_downloaded ?? 0)} />
          <Stat label={t('Uploaded')} value={formatBytes(x.uploaded)} />
          <Stat label={t('Ratio')} value={x.ratio.toFixed(2)} className={ratioColor(x.ratio)} />
          <Stat label={t('Wasted')} value={has(x.total_wasted) && formatBytes(x.total_wasted!)} />
          <Stat label={t('Queue position')} value={x.priority > 0 ? x.priority : t('Not queued')} />
        </Column>
        <Column title={t('Network')}>
          <Stat label={t('Down speed')} value={`${formatBytes(x.dlspeed)}/s`} className={x.dlspeed > 0 ? DOWN_SPEED_COLOR : undefined} />
          <Stat label={t('Up speed')} value={`${formatBytes(x.upspeed)}/s`} className={x.upspeed > 0 ? UP_SPEED_COLOR : undefined} />
          <Stat label={t('Seeds')} value={pair(x.num_seeds, x.num_complete)} />
          <Stat label={t('Peers')} value={pair(x.num_leechs, x.num_incomplete)} />
          <Stat label={t('Connections')} value={has(x.connections_count) && (x.connections_limit && x.connections_limit > 0 ? pair(x.connections_count!, x.connections_limit) : String(x.connections_count))} />
          <Stat label={t('Availability')} value={has(x.availability) && x.availability!.toFixed(3)} />
          <Stat label={t('Pieces')} value={!!x.pieces_num && (x.piece_size ? `${pair(x.pieces_have ?? 0, x.pieces_num)} × ${formatBytes(x.piece_size)}` : pair(x.pieces_have ?? 0, x.pieces_num))} />
        </Column>
        <Column title={t('Time')}>
          <Stat label={t('Added')} value={formatDateTime(x.added_on)} />
          <Stat label={t('Completed on')} value={x.completion_on > 0 && formatDateTime(x.completion_on)} />
          <Stat label={t('Created on')} value={!!x.creation_date && x.creation_date > 0 && formatDateTime(x.creation_date)} />
          <Stat label={t('Active for')} value={formatDuration(x.time_active)} />
          <Stat label={t('Seeding for')} value={x.seeding_time > 0 && formatDuration(x.seeding_time)} />
          <Stat label={t('Next announce')} value={has(x.reannounce) && formatDuration(x.reannounce)} />
        </Column>
        <Column title={t('Limits')}>
          <Stat label={t('Down limit')} value={limit(x.dl_limit)} />
          <Stat label={t('Up limit')} value={limit(x.up_limit)} />
          <Stat label={t('Ratio limit')} value={shareLimit(x.max_ratio, n => n.toFixed(2))} />
          <Stat label={t('Seeding time limit')} value={shareLimit(x.seeding_time_limit, n => formatDuration(n * 60))} />
          <Stat label={t('Category')} value={x.category || '-'} />
          <Stat label={t('Tags')} value={x.tags || '-'} />
          <Stat label={t('Private')} value={x.private !== undefined && (x.private ? t('Yes') : t('No'))} />
          <Stat label={t('Created by')} value={x.created_by} />
        </Column>
      </div>

      <section className="border-t pt-3">
        <DetailsHeading>{t('Speed')}</DetailsHeading>
        <SpeedChart hash={x.hash} />
      </section>

      <section className="border-t pt-3">
        <DetailsHeading>{t('Pieces')}</DetailsHeading>
        <div className="-mx-2">
          <PieceBar hash={x.hash} torrentComplete={x.progress >= 1} />
        </div>
      </section>
    </div>
  )
}
