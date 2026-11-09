import { useState, useSyncExternalStore, type PointerEvent } from 'react'
import { formatBytes } from '@/lib/format'
import { getSpeedHistory, niceCeiling, onSpeedHistory, type SpeedSample } from '@/lib/speedHistory'
import { t } from '@/i18n'

const WIDTH = 600
const HEIGHT = 120
// Download green and upload blue, as in the header, in the color-blind-safe shades index.css sets. Upload is dashed too, so the two never rely on color alone.
const SERIES = [
  { key: 'down', label: t('Download'), stroke: 'stroke-green-600', dot: 'bg-green-600', dash: undefined },
  { key: 'up', label: t('Upload'), stroke: 'stroke-blue-600 dark:stroke-blue-500', dot: 'bg-blue-600 dark:bg-blue-500', dash: '6 4' },
] as const

const speed = (bytes: number) => `${formatBytes(bytes)}/s`

function ago(ms: number) {
  const seconds = Math.round(ms / 1000)
  if (seconds < 5) return t('now')
  if (seconds < 60) return t('{seconds} s ago', { seconds })
  return t('{minutes} min ago', { minutes: Math.round(seconds / 60) })
}

function linePath(samples: SpeedSample[], key: 'down' | 'up', top: number) {
  const step = WIDTH / Math.max(1, samples.length - 1)
  return samples.map((sample, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${(HEIGHT - (sample[key] / top) * HEIGHT).toFixed(1)}`).join('')
}

// Download and upload speed since the page opened, up to ten minutes back.
export function SpeedChart() {
  const samples = useSyncExternalStore(onSpeedHistory, getSpeedHistory)
  const [hover, setHover] = useState<number | null>(null)

  if (samples.length < 2) return <p className="py-4 text-center text-xs text-muted-foreground">{t('The speed graph fills in while this page stays open.')}</p>

  const peak = Math.max(...samples.map(s => Math.max(s.down, s.up)))
  const top = niceCeiling(peak)
  const latest = samples[samples.length - 1]
  const point = hover === null ? null : samples[hover]

  const track = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    setHover(Math.round(ratio * (samples.length - 1)))
  }

  return (
    <figure className="space-y-1.5">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {SERIES.map(series => (
          <span key={series.key} className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${series.dot}`} aria-hidden />
            <span className="text-muted-foreground">{series.label}</span>
            <span className="tabular-nums">{speed(latest[series.key])}</span>
          </span>
        ))}
        <span className="sr-only">{t('Highest in this period: {speed}.', { speed: speed(peak) })}</span>
      </figcaption>

      <div className="flex gap-2 text-[0.625rem] text-muted-foreground tabular-nums">
        <div className="flex flex-col justify-between py-0.5 text-end" aria-hidden>
          <span>{speed(top)}</span>
          <span>{speed(top / 2)}</span>
          <span>0</span>
        </div>
        <div
          className="relative min-w-0 flex-1 touch-none"
          onPointerMove={track}
          onPointerDown={track}
          onPointerLeave={() => setHover(null)}
        >
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="block h-28 w-full overflow-visible" aria-hidden>
            {[0, 0.5, 1].map(f => (
              <line key={f} x1={0} x2={WIDTH} y1={HEIGHT * f} y2={HEIGHT * f} className="stroke-border" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            {SERIES.map(series => (
              <path key={series.key} d={linePath(samples, series.key, top)} fill="none" className={series.stroke} strokeWidth={2} strokeDasharray={series.dash} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            ))}
            {hover !== null && (
              <line x1={(hover / (samples.length - 1)) * WIDTH} x2={(hover / (samples.length - 1)) * WIDTH} y1={0} y2={HEIGHT} className="stroke-foreground/40" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            )}
          </svg>
          {point && hover !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
              style={{ left: `${(hover / (samples.length - 1)) * 100}%`, transform: hover > samples.length / 2 ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)' }}
            >
              <p className="text-muted-foreground">{ago(latest.time - point.time)}</p>
              {SERIES.map(series => (
                <p key={series.key} className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className={`size-1.5 rounded-full ${series.dot}`} aria-hidden />
                  {series.label} {speed(point[series.key])}
                </p>
              ))}
            </div>
          )}
          <div className="mt-0.5 flex justify-between" aria-hidden>
            <span>{ago(latest.time - samples[0].time)}</span>
            <span>{t('now')}</span>
          </div>
        </div>
      </div>
    </figure>
  )
}
