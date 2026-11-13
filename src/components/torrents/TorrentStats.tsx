import { useState, type ReactNode } from 'react'
import { Activity, Database, Gauge, Globe, HardDrive, History, Network, Pause, Play, Turtle, type LucideIcon } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { useApiFeature, usePreferences, useTorrents, useTransferInfo } from '@/hooks/useApi'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'
import { formatBytes } from '@/lib/format'
import { SpeedChart } from './SpeedChart'
import { CONNECTION_LABELS } from '@/lib/statusNotes'
import { t } from '@/i18n'

const size = (bytes: number | undefined) => (bytes === undefined ? '-' : formatBytes(bytes))
const count = (value: number | undefined) => (value === undefined ? '-' : value.toLocaleString())
const limit = (bytes: number | undefined) => (bytes === undefined ? '-' : bytes > 0 ? `${formatBytes(bytes)}/s` : t('Unlimited'))

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md bg-muted/60 px-3 py-2">
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm tabular-nums" title={value}>{value}</p>
      </div>
    </div>
  )
}

// qBittorrent 5.3 can pause every transfer at once and later resume exactly what was running.
function SessionPauseButton({ paused }: { paused: boolean }) {
  const queryClient = useQueryClient()
  const [pending, setPending] = useState(false)

  const toggle = async () => {
    setPending(true)
    try {
      await (paused ? qbitClient.resumeSession() : qbitClient.pauseSession())
      await queryClient.invalidateQueries({ queryKey: ['torrents'] })
      toast.success(paused ? t('Transfers resumed') : t('All transfers paused'), { description: paused ? undefined : t('Each torrent keeps its own state, so resuming brings back what was running.') })
    } catch (e) {
      toast.error(paused ? t('Couldn\'t resume transfers') : t('Couldn\'t pause transfers'), { description: e instanceof Error ? e.message : undefined })
    } finally {
      setPending(false)
    }
  }

  return (
    <Button type="button" size="sm" variant={paused ? 'default' : 'outline'} disabled={pending} onClick={toggle} className="w-full gap-2">
      {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
      {paused ? t('Resume all transfers') : t('Pause all transfers')}
    </Button>
  )
}

// Switches qBittorrent between its normal and alternative ("slow") speed limits. Pressed and amber
// while the alternative ones are on, like the speeds in the header.
function AlternativeLimitsButton({ on }: { on: boolean }) {
  const queryClient = useQueryClient()
  const { data: prefs } = usePreferences()
  const [pending, setPending] = useState(false)
  const rate = (bytes: unknown) => (Number(bytes) > 0 ? `${formatBytes(Number(bytes))}/s` : t('Unlimited'))
  const rates = prefs ? `↓ ${rate(prefs.alt_dl_limit)} · ↑ ${rate(prefs.alt_up_limit)}` : undefined

  const toggle = async () => {
    setPending(true)
    try {
      await qbitClient.toggleSpeedLimitsMode()
      await queryClient.invalidateQueries({ queryKey: ['torrents'] })
      if (on) toast.success(t('Alternative speed limits off'), { description: t('Your normal speed limits apply') })
      else toast.success(t('Alternative speed limits on'), { description: rates })
    } catch (e) {
      toast.error(t('Failed to change speed limits'), { description: e instanceof Error ? e.message : undefined })
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      aria-pressed={on}
      title={rates}
      disabled={pending}
      onClick={toggle}
      className={cn('mt-2 w-full gap-2', on && 'border-amber-500/40 bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-400')}
    >
      <Turtle className="size-4" />
      {t('Alternative speed limits')}
    </Button>
  )
}

// qBittorrent's connection status and statistics, as a page like Logs.
export function StatisticsView() {
  const { data: state } = useTransferInfo()
  const { data: torrents } = useTorrents()
  const canPauseSession = useApiFeature('sessionPause') && typeof state?.session_state === 'boolean'
  const sessionPaused = state?.session_state === true
  const connection = CONNECTION_LABELS[state?.connection_status ?? '']
  const externalAddress = [state?.last_external_address_v4, state?.last_external_address_v6].filter(Boolean).join(', ')

  const allGroups: { title: string; icon: LucideIcon; rows: [string, string][] }[] = state ? [
    {
      title: t('Storage'),
      icon: HardDrive,
      rows: [
        [t('Free space'), size(state.free_space_on_disk)],
        // Summed here, as qBittorrent doesn't report it.
        [t('Total size of torrents'), torrents ? formatBytes(torrents.reduce((sum, torrent) => sum + (torrent.size ?? 0), 0)) : '-'],
      ],
    },
    {
      title: t('All time'),
      icon: History,
      rows: [
        [t('Downloaded'), size(state.alltime_dl)],
        [t('Uploaded'), size(state.alltime_ul)],
        [t('Ratio'), state.global_ratio ?? '-'],
      ],
    },
    {
      title: t('This session'),
      icon: Activity,
      rows: [
        [t('Downloaded'), size(state.dl_info_data)],
        [t('Uploaded'), size(state.up_info_data)],
        [t('Wasted'), size(state.total_wasted_session)],
        [t('Connected peers'), count(state.total_peer_connections)],
      ],
    },
    {
      title: t('Cache and disk'),
      icon: Database,
      rows: [
        [t('Read cache hits'), state.read_cache_hits !== undefined ? `${state.read_cache_hits}%` : '-'],
        [t('Read cache overload'), state.read_cache_overload !== undefined ? `${state.read_cache_overload}%` : '-'],
        [t('Write cache overload'), state.write_cache_overload !== undefined ? `${state.write_cache_overload}%` : '-'],
        [t('Total buffer size'), size(state.total_buffers_size)],
        [t('Queued disk jobs'), count(state.queued_io_jobs)],
        [t('Average time in queue'), state.average_time_queue === undefined ? '-' : `${state.average_time_queue} ms`],
        [t('Total queued size'), size(state.total_queued_size)],
      ],
    },
  ] : []
  // Rows this qBittorrent doesn't report are left out, and so is a group left empty.
  const groups = allGroups
    .map(group => ({ ...group, rows: group.rows.filter(([, value]) => value !== '-') }))
    .filter(group => group.rows.length > 0)

  return (
    <div className="space-y-4">
      <PageHeader title={t('Statistics')} />
      <Card>
        <CardContent className="space-y-4">

        {!state ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('Loading statistics...')}</p>
        ) : (
          <>
            <div className={cn('space-y-2.5 rounded-md border px-3 py-2.5', !connection && 'text-muted-foreground')}>
              <div className="flex items-center gap-3">
                <span className={cn('size-2.5 shrink-0 rounded-full', sessionPaused ? 'bg-muted-foreground' : connection?.dot ?? 'bg-muted-foreground')} aria-hidden />
                <div className="min-w-0">
                  <p className={cn('text-sm font-medium', !sessionPaused && connection?.text)}>
                    {connection?.label ?? t('Connection status unknown')}{sessionPaused && t(', all transfers paused')}
                  </p>
                  {connection && <p className="text-xs text-muted-foreground">{connection.description}</p>}
                </div>
              </div>
              {canPauseSession && <SessionPauseButton paused={sessionPaused} />}
            </div>

            <section>
              <h3 className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Gauge className="size-3.5" />{t('Speed')}</h3>
              <SpeedChart />
              {/* The limits in force, which are the alternative ones while those are on. */}
              <dl className={cn('mt-2 grid grid-cols-2 gap-2 text-sm', state.use_alt_speed_limits && 'text-amber-700 dark:text-amber-400')}>
                <div className="rounded-md bg-muted/60 px-3 py-1.5">
                  <dt className="text-xs text-muted-foreground">{t('Download limit')}</dt>
                  <dd className="tabular-nums">↓ {limit(state.dl_rate_limit)}</dd>
                </div>
                <div className="rounded-md bg-muted/60 px-3 py-1.5">
                  <dt className="text-xs text-muted-foreground">{t('Upload limit')}</dt>
                  <dd className="tabular-nums">↑ {limit(state.up_rate_limit)}</dd>
                </div>
              </dl>
              <AlternativeLimitsButton on={state.use_alt_speed_limits === true} />
            </section>

            {/* One row: the node count needs little room, the addresses the rest. */}
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
              <Fact icon={<Network className="size-4" />} label={t('DHT nodes')} value={count(state.dht_nodes)} />
              {externalAddress && <Fact icon={<Globe className="size-4" />} label={t('External address')} value={externalAddress} />}
            </div>

            {groups.map(group => (
              <section key={group.title}>
                <h3 className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><group.icon className="size-3.5" />{group.title}</h3>
                <dl className="divide-y text-sm">
                  {group.rows.map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 py-1.5">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="text-end tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}

            {state.average_time_queue !== undefined && state.average_time_queue > 5000 && (
              <p className="text-xs text-amber-500">{t('Disk jobs are waiting {time} on average, so the disk may be slowing transfers.', { time: formatDuration(state.average_time_queue / 1000) })}</p>
            )}
          </>
        )}
        </CardContent>
      </Card>
    </div>
  )
}
