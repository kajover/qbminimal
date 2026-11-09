import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { getTorrentExportUrl } from '@/lib/api'
import { copyText } from '@/lib/clipboard'
import { formatBytes, formatDateTime, formatDuration } from '@/lib/format'
import type { Torrent } from '@/types'
import { PieceBar } from './PieceBar'
import { t } from '@/i18n'

type Row = [label: string, value: string | number | undefined | false]

// Groups of facts about a torrent. Rows without a value, often fields an older qBittorrent
// doesn't send, are left out.
function groups(x: Torrent): { title: string; rows: Row[] }[] {
  const has = (n: number | undefined) => n !== undefined && n >= 0
  const of = (part: number | string, whole: number | string) => t('{part} of {whole}', { part, whole })
  return [
    {
      title: t('Transfer'),
      rows: [
        [t('Progress'), of(`${Math.floor(x.progress * 1000) / 10}%`, formatBytes(x.size))],
        [t('Speed'), `↓ ${formatBytes(x.dlspeed)}/s · ↑ ${formatBytes(x.upspeed)}/s`],
        [t('Downloaded'), formatBytes(x.downloaded ?? x.total_downloaded ?? 0)],
        [t('Uploaded'), formatBytes(x.uploaded)],
        [t('Ratio'), x.ratio.toFixed(2)],
        [t('Seeds'), t('{connected} connected of {total}', { connected: x.num_seeds, total: x.num_complete })],
        [t('Peers'), t('{connected} connected of {total}', { connected: x.num_leechs, total: x.num_incomplete })],
        [t('Connections'), has(x.connections_count) && (x.connections_limit && x.connections_limit > 0 ? of(x.connections_count!, x.connections_limit) : String(x.connections_count))],
        [t('Availability'), has(x.availability) && x.availability!.toFixed(3)],
        [t('Wasted'), has(x.total_wasted) && formatBytes(x.total_wasted!)],
        [t('Pieces'), !!x.pieces_num && (x.piece_size
          ? t('{have} of {total}, {size} each', { have: x.pieces_have ?? 0, total: x.pieces_num, size: formatBytes(x.piece_size) })
          : of(x.pieces_have ?? 0, x.pieces_num))],
        [t('Queue position'), x.priority > 0 ? x.priority : t('Not queued')],
      ],
    },
    {
      title: t('Time'),
      rows: [
        [t('Added'), formatDateTime(x.added_on)],
        [t('Completed on'), x.completion_on > 0 && formatDateTime(x.completion_on)],
        [t('Active for'), formatDuration(x.time_active)],
        [t('Seeding for'), x.seeding_time > 0 && formatDuration(x.seeding_time)],
        [t('Next announce'), has(x.reannounce) && formatDuration(x.reannounce)],
      ],
    },
    {
      title: t('Where'),
      rows: [
        [t('Save path'), x.save_path],
        [t('Incomplete files'), x.download_path],
        [t('Category'), x.category || '-'],
        [t('Tags'), x.tags || '-'],
      ],
    },
    {
      title: t('About'),
      rows: [
        [t('Private'), x.private !== undefined && (x.private ? t('Yes') : t('No'))],
        [t('Created by'), x.created_by],
        [t('Created on'), !!x.creation_date && x.creation_date > 0 && formatDateTime(x.creation_date)],
        [t('Comment'), x.comment],
        [t('Hash'), x.hash],
        [t('Hash (v2)'), x.infohash_v2],
      ],
    },
  ]
}

export function TorrentInfoTab({ torrent }: { torrent: Torrent }) {
  const copy = async (text: string, copied: string, failed: string) => {
    if (await copyText(text)) toast.success(copied)
    else toast.error(failed)
  }

  return (
    <div className="space-y-3">
      <PieceBar hash={torrent.hash} torrentComplete={torrent.progress >= 1} />

      {/* Web API 2.17.0 and newer say why a torrent stopped with an error. */}
      {torrent.error && <p role="alert" className="mx-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{torrent.error}</p>}

      <div className="flex flex-wrap gap-2 px-2">
        <Button size="sm" variant="outline" onClick={() => copy(torrent.name, t('Name copied'), t("Couldn't copy the name"))}>{t('Copy name')}</Button>
        <Button size="sm" variant="outline" onClick={() => copy(torrent.hash, t('Hash copied'), t("Couldn't copy the hash"))}>{t('Copy hash')}</Button>
        {torrent.magnet_uri && <Button size="sm" variant="outline" onClick={() => copy(torrent.magnet_uri, t('Magnet link copied'), t("Couldn't copy the magnet link"))}>{t('Copy magnet link')}</Button>}
        {torrent.has_metadata === false ? (
          <span className="inline-flex cursor-not-allowed" title={t('Available once qBittorrent has this torrent\'s metadata')}>
            <Button size="sm" variant="outline" disabled>{t('Export .torrent')}</Button>
          </span>
        ) : (
          <Button size="sm" variant="outline" asChild>
            <a href={getTorrentExportUrl(torrent.hash)} download={`${torrent.name}.torrent`}>{t('Export .torrent')}</a>
          </Button>
        )}
      </div>

      {groups(torrent).map(group => (
        <section key={group.title}>
          <h3 className="px-2 text-xs font-medium text-muted-foreground">{group.title}</h3>
          <dl className="divide-y text-sm">
            {group.rows.filter((row): row is [string, string | number] => row[1] !== undefined && row[1] !== false && row[1] !== '').map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 px-2 py-1.5">
                <dt className="shrink-0 text-muted-foreground">{label}</dt>
                <dd className="truncate text-end tabular-nums" title={String(value)}>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
