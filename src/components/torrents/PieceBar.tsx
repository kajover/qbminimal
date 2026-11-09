import { useEffect, useRef } from 'react'
import { useTorrentAvailability, useTorrentPieces } from '@/hooks/useApi'
import { countPieces, getAvailabilityColumns, getPieceColumns } from '@/lib/pieces'
import { t } from '@/i18n'

// The palette's colors as the page has them (index.css sets the color-blind-safe ones), so the
// bars match the rest of the page. The fallbacks are Tailwind's own, should a color not be on the page.
const paletteColor = (name: string, fallback: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim() || fallback
const doneColor = () => paletteColor('green-500', '#22c55e')
const downloadingColor = () => paletteColor('amber-500', '#f59e0b')
const downloadingAltColor = () => paletteColor('amber-700', '#b45309')
// Same stripes as the legend swatch (.piece-stripes in index.css).
function stripePattern(context: CanvasRenderingContext2D, size: number) {
  const tile = document.createElement('canvas')
  tile.width = tile.height = size
  const tileContext = tile.getContext('2d')
  if (!tileContext) return null
  tileContext.fillStyle = downloadingColor()
  tileContext.fillRect(0, 0, size, size)
  tileContext.fillStyle = downloadingAltColor()
  // Two bands cover the diagonal and its wrap-around corners, so the tile repeats seamlessly.
  for (const offset of [0, -size]) {
    tileContext.beginPath()
    tileContext.moveTo(offset + size / 2, 0)
    tileContext.lineTo(offset + size, 0)
    tileContext.lineTo(offset + size * 1.5, size)
    tileContext.lineTo(offset + size, size)
    tileContext.closePath()
    tileContext.fill()
  }
  return context.createPattern(tile, 'repeat')
}
// Keeps a column with only a few finished pieces visible on a huge torrent.
const MIN_DONE_OPACITY = 0.25

function drawPieces(canvas: HTMLCanvasElement, states: number[]) {
  const context = canvas.getContext('2d')
  if (!context) return

  const width = Math.round(canvas.clientWidth * window.devicePixelRatio)
  const height = Math.round(canvas.clientHeight * window.devicePixelRatio)
  // Setting the size also clears the canvas.
  canvas.width = width
  canvas.height = height

  const stripes = stripePattern(context, Math.max(4, Math.round(5 * window.devicePixelRatio)))
  getPieceColumns(states, width).forEach((column, x) => {
    if (column.downloading) {
      // Diagonal stripes, so downloading doesn't rely on colour alone.
      context.globalAlpha = 1
      context.fillStyle = stripes ?? downloadingColor()
    } else if (column.done > 0) {
      context.globalAlpha = MIN_DONE_OPACITY + (1 - MIN_DONE_OPACITY) * column.done
      context.fillStyle = doneColor()
    } else {
      return
    }
    context.fillRect(x, 0, 1, height)
  })
}

const availableColor = () => paletteColor('blue-500', '#3b82f6')
const unavailableColor = () => paletteColor('red-500', '#ef4444')

function drawAvailability(canvas: HTMLCanvasElement, availability: number[]) {
  const context = canvas.getContext('2d')
  if (!context) return
  const width = Math.round(canvas.clientWidth * window.devicePixelRatio)
  const height = Math.round(canvas.clientHeight * window.devicePixelRatio)
  canvas.width = width
  canvas.height = height
  getAvailabilityColumns(availability, width).forEach((peers, x) => {
    if (peers < 0) return
    // More peers with a piece shows as a stronger blue, up to five.
    context.globalAlpha = peers === 0 ? 1 : 0.3 + 0.7 * Math.min(peers, 5) / 5
    context.fillStyle = peers === 0 ? unavailableColor() : availableColor()
    context.fillRect(x, 0, 1, height)
  })
}

// Which pieces connected peers can send, like qBittorrent's availability bar.
function AvailabilityBar({ hash }: { hash: string }) {
  const { data: availability } = useTorrentAvailability(hash, true)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !availability) return
    const draw = () => drawAvailability(canvas, availability)
    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [availability])

  if (!availability?.length || availability.every(peers => peers < 0)) return null
  const missing = availability.filter(peers => peers === 0).length
  const summary = missing === 0
    ? t('Every piece is available from connected peers')
    : missing === 1 ? t('1 piece isn\'t available from connected peers') : t('{count} pieces aren\'t available from connected peers', { count: missing.toLocaleString() })

  return (
    <div className="space-y-1 pt-1">
      <canvas ref={canvasRef} role="img" aria-label={summary} className="block h-2 w-full rounded-sm bg-muted" />
      <p className={`text-xs ${missing ? 'text-red-500' : 'text-muted-foreground'}`}>{summary}</p>
    </div>
  )
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`size-2 rounded-sm ${className}`} aria-hidden="true" />
      {label}
    </span>
  )
}

// The file list and action forms stay usable if this fails, so it only reports in place.
export function PieceBar({ hash, torrentComplete }: { hash: string; torrentComplete: boolean }) {
  const { data: states, isError, isLoading } = useTorrentPieces(hash, torrentComplete)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !states) return

    const draw = () => drawPieces(canvas, states)
    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [states])

  if (isLoading) return <p className="px-2 py-2 text-xs text-muted-foreground">{t('Loading pieces...')}</p>
  if (isError) return <p className="px-2 py-2 text-xs text-muted-foreground">{t('Couldn\'t load this torrent\'s pieces.')}</p>
  if (!states?.length) return <p className="px-2 py-2 text-xs text-muted-foreground">{t('Piece information isn\'t available yet.')}</p>

  const { total, done, downloading } = countPieces(states)
  const summary = downloading
    ? t('{done} of {total} pieces, {downloading} downloading', { done: done.toLocaleString(), total: total.toLocaleString(), downloading: downloading.toLocaleString() })
    : t('{done} of {total} pieces', { done: done.toLocaleString(), total: total.toLocaleString() })

  return (
    <div className="space-y-1 px-2 py-2">
      <canvas ref={canvasRef} role="img" aria-label={summary} className="block h-4 w-full rounded-sm bg-muted" />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{summary}</span>
        <span className="flex items-center gap-2">
          <LegendItem className="bg-green-500" label={t('Done')} />
          <LegendItem className="piece-stripes" label={t('Downloading')} />
          <LegendItem className="border bg-muted" label={t('Missing')} />
        </span>
      </div>
      {!torrentComplete && <AvailabilityBar hash={hash} />}
    </div>
  )
}
