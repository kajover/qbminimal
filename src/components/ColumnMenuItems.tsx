import { useState, type ComponentType, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

// A menu's tick box item, from the dropdown or the right-click menu.
type CheckItem = ComponentType<{
  checked?: boolean
  disabled?: boolean
  className?: string
  onSelect?: (event: Event) => void
  onCheckedChange?: (checked: boolean) => void
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void
  children?: ReactNode
}>

// The columns of a Columns menu: a tick box to show or hide each, and a handle to drag it to a new
// place, hidden ones too. Alt and the up or down arrow moves the column under focus.
export function ColumnMenuItems<K extends string>({ order, shown, locked, label, onToggle, onMove, Item }: {
  // Every column, in order.
  order: readonly K[]
  shown: (key: K) => boolean
  // The column that always shows.
  locked?: K
  label: (key: K) => string
  onToggle: (key: K) => void
  onMove: (key: K, target: K) => void
  Item: CheckItem
}) {
  const [drag, setDrag] = useState<{ key: K; over: K } | null>(null)
  const keyAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest('[data-column-key]') as HTMLElement | null)?.dataset.columnKey as K | undefined
  const end = () => {
    if (drag && drag.over !== drag.key) onMove(drag.key, drag.over)
    setDrag(null)
  }
  return order.map(key => {
    // The line shows on the side the column will land.
    const marker = drag && drag.over === key && drag.key !== key ? (order.indexOf(key) < order.indexOf(drag.key) ? 'before' : 'after') : null
    return (
      <div
        key={key}
        data-column-key={key}
        className={cn('flex items-center rounded-sm', drag?.key === key && 'opacity-50', marker === 'before' && 'shadow-[inset_0_2px_0_var(--color-primary)]', marker === 'after' && 'shadow-[inset_0_-2px_0_var(--color-primary)]')}
      >
        <span
          aria-hidden
          title={t('Drag to move')}
          onPointerDown={(e: PointerEvent<HTMLSpanElement>) => {
            e.preventDefault()
            e.stopPropagation()
            e.currentTarget.setPointerCapture(e.pointerId)
            setDrag({ key, over: key })
          }}
          onPointerMove={(e: PointerEvent<HTMLSpanElement>) => {
            if (drag?.key !== key) return
            const over = keyAt(e.clientX, e.clientY)
            if (over && over !== drag.over) setDrag({ key, over })
          }}
          onPointerUp={end}
          onPointerCancel={() => setDrag(null)}
          className="flex cursor-grab touch-none items-center self-stretch px-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
        </span>
        <Item
          className="min-w-0 flex-1"
          checked={shown(key)}
          disabled={key === locked}
          onSelect={(e) => e.preventDefault()}
          onCheckedChange={() => onToggle(key)}
          onKeyDown={(e) => {
            if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
            e.preventDefault()
            e.stopPropagation()
            const neighbour = order[order.indexOf(key) + (e.key === 'ArrowUp' ? -1 : 1)]
            if (neighbour) onMove(key, neighbour)
          }}
        >
          {label(key)}
        </Item>
      </div>
    )
  })
}
