import { useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { holdCursor } from '@/lib/dragCursor'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

// What the torrent table and the search results share: columns resized from their end edge, fitted
// to their content with a double click, and dragged (or moved with Alt and an arrow key) to a new place.

// How wide a text is in the page's font, at the given size and weight. Without a canvas (as in
// tests) it's an estimate; canMeasureText says which.
let measure: CanvasRenderingContext2D | null | undefined
function measurer(): CanvasRenderingContext2D | null {
  if (measure === undefined) {
    try {
      measure = document.createElement('canvas').getContext('2d')
    } catch {
      measure = null
    }
  }
  return measure
}
export const canMeasureText = (): boolean => measurer() !== null
export function textWidth(text: string, px: number, weight = 500, family = getComputedStyle(document.body).fontFamily || 'sans-serif'): number {
  const context = measurer()
  if (!context) return text.length * px * 0.6
  context.font = `${weight} ${px}px ${family}`
  return context.measureText(text).width
}

// The width that shows every given cell's content whole: each is copied, unclipped, into a hidden
// box beside the table, which keeps the table's fonts.
export function naturalWidth(cells: Element[], host: HTMLElement): number {
  const probe = document.createElement('div')
  probe.style.cssText = 'position:absolute;top:0;left:0;visibility:hidden;pointer-events:none;width:max-content;white-space:nowrap'
  host.appendChild(probe)
  let widest = 0
  for (const cell of cells) {
    probe.className = cell.className
    probe.innerHTML = cell.innerHTML
    widest = Math.max(widest, probe.getBoundingClientRect().width)
  }
  probe.remove()
  return Math.ceil(widest)
}

// The width a column needs to show its cells and title whole, from the table on screen. `index` is
// the column's place among the cells of a row.
export function fittedWidth(host: HTMLElement | null, index: number): number | null {
  if (!host || index < 0) return null
  const cells = [...host.querySelectorAll('tbody tr')].map(row => row.children[index]).filter(Boolean)
  const header = host.querySelectorAll('thead th')[index]
  // Room for the sort arrow, so sorting by the column later doesn't cut its title.
  const headerWidth = header ? naturalWidth([header], host) + 18 : 0
  return Math.max(naturalWidth(cells, host), headerWidth) + 1
}

// A column order with one column moved to where another is.
export function moveInOrder<K>(order: readonly K[], id: K, target: K): K[] {
  const from = order.indexOf(id)
  const to = order.indexOf(target)
  if (id === target || from === -1 || to === -1) return [...order]
  const next = order.filter(other => other !== id)
  next.splice(to, 0, id)
  return next
}

// Resizing columns from their end edge. The width shows while dragging and is handed over at the end.
export function useColumnResize<K extends string>({ widthOf, minWidthOf, onResize, onFit }: {
  widthOf: (key: K) => number
  minWidthOf: (key: K) => number
  onResize: (key: K, width: number) => void
  // A double click on the edge.
  onFit: (key: K) => void
}) {
  const [resizing, setResizing] = useState<{ key: K; width: number } | null>(null)
  // sign is -1 right to left, where a column's resizing edge is on its left.
  const start = useRef<{ x: number; width: number; sign: number } | null>(null)
  const release = useRef<(() => void) | null>(null)
  const width = (key: K) => (resizing?.key === key ? resizing.width : widthOf(key))
  const end = () => {
    if (resizing) onResize(resizing.key, resizing.width)
    start.current = null
    release.current?.()
    release.current = null
    setResizing(null)
  }
  const handle = (key: K, label: string) => (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={t('Resize {label}', { label })}
      title={t('Drag to resize. Double-click to fit the content.')}
      onPointerDown={(e: PointerEvent<HTMLSpanElement>) => {
        e.preventDefault()
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        start.current = { x: e.clientX, width: width(key), sign: getComputedStyle(e.currentTarget).direction === 'rtl' ? -1 : 1 }
        release.current = holdCursor('col-resize')
        setResizing({ key, width: width(key) })
      }}
      onPointerMove={(e: PointerEvent<HTMLSpanElement>) => {
        if (!start.current || resizing?.key !== key) return
        setResizing({ key, width: Math.max(minWidthOf(key), Math.round(start.current.width + (e.clientX - start.current.x) * start.current.sign)) })
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={() => onFit(key)}
      className="group absolute end-0 top-0 flex h-full w-2 cursor-col-resize touch-none justify-end"
    >
      <span className={cn('h-full w-px', resizing?.key === key ? 'bg-primary' : 'bg-border group-hover:bg-primary/60')} />
    </span>
  )
  // So a drag on the edge doesn't also move the column.
  const busy = () => !!start.current
  return { width, handle, busy }
}

// Moving columns by dragging their titles, or with Alt and an arrow key on a title.
export function useColumnDrag<K extends string>({ keys, onMove, busy }: {
  // The columns shown, in order.
  keys: readonly K[]
  onMove: (key: K, target: K) => void
  busy?: () => boolean
}) {
  const [dragging, setDragging] = useState<K | null>(null)
  const [dropTarget, setDropTarget] = useState<K | null>(null)
  const dragIndex = dragging ? keys.indexOf(dragging) : -1
  const clear = () => { setDragging(null); setDropTarget(null) }
  const titleProps = (key: K) => {
    // The drop marker shows on the side the column will land.
    const marker = dropTarget === key && dragging && dragging !== key ? (keys.indexOf(key) < dragIndex ? 'before' : 'after') : null
    return {
      draggable: true,
      onDragStart: (e: DragEvent<HTMLTableCellElement>) => {
        if (busy?.()) return e.preventDefault()
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', key)
        setDragging(key)
      },
      onDragOver: (e: DragEvent<HTMLTableCellElement>) => {
        if (!dragging) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (dropTarget !== key) setDropTarget(key)
      },
      onDragLeave: () => setDropTarget(target => (target === key ? null : target)),
      onDrop: (e: DragEvent<HTMLTableCellElement>) => {
        e.preventDefault()
        if (dragging) onMove(dragging, key)
        clear()
      },
      onDragEnd: clear,
      className: cn(
        dragging === key && 'opacity-50',
        marker === 'before' && 'shadow-[inset_2px_0_0_var(--color-primary)]',
        marker === 'after' && 'shadow-[inset_-2px_0_0_var(--color-primary)]',
      ),
    }
  }
  const onTitleKey = (e: KeyboardEvent<HTMLElement>, key: K) => {
    if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
    e.preventDefault()
    // The arrow points where the column goes on screen, which is backwards right to left.
    const towardsStart = (e.key === 'ArrowLeft') !== (getComputedStyle(e.currentTarget).direction === 'rtl')
    const neighbour = keys[keys.indexOf(key) + (towardsStart ? -1 : 1)]
    if (neighbour) onMove(key, neighbour)
  }
  return { titleProps, onTitleKey }
}
