import { useEffect, useRef, type HTMLAttributes, type MouseEvent, type PointerEvent } from 'react'

const LONG_PRESS_MS = 500
// A finger that moves this far is scrolling, not holding.
const MOVE_TOLERANCE = 10
// Clicks on these are the control's own, not the row's.
const CONTROLS = 'button, a, input, label, select, textarea, [role="checkbox"], [role="menuitem"], [data-row-select]'

interface RowPressHandlers<T> {
  // A click or tap. `touch` says it came from a finger or pen rather than a mouse.
  onPress: (event: MouseEvent, item: T, touch: boolean) => void
  // Holding a finger on the row.
  onLongPress: (item: T) => void
  // A right-click, just before the context menu opens.
  onMenu: (item: T) => void
}

// Click, long-press, and right-click handling shared by table rows and cards.
export function useRowPress<T>({ onPress, onLongPress, onMenu }: RowPressHandlers<T>) {
  const press = useRef<{ timer: number; x: number; y: number } | null>(null)
  const touch = useRef(false)
  const held = useRef(false)

  const cancel = () => {
    if (press.current) window.clearTimeout(press.current.timer)
    press.current = null
  }
  useEffect(() => cancel, [])

  return (item: T) => ({
    onPointerDown: (event: PointerEvent) => {
      cancel()
      touch.current = event.pointerType !== 'mouse'
      held.current = false
      if (!touch.current || (event.target as HTMLElement).closest(CONTROLS)) return
      // Keeps the context menu's own long-press from opening: on phones a hold selects instead.
      event.preventDefault()
      const timer = window.setTimeout(() => {
        press.current = null
        held.current = true
        navigator.vibrate?.(10)
        onLongPress(item)
      }, LONG_PRESS_MS)
      press.current = { timer, x: event.clientX, y: event.clientY }
    },
    onPointerMove: (event: PointerEvent) => {
      const start = press.current
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > MOVE_TOLERANCE) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onClick: (event: MouseEvent) => {
      // The tap that ends a long press already did its work.
      if (held.current) {
        held.current = false
        return
      }
      if ((event.target as HTMLElement).closest(CONTROLS)) return
      onPress(event, item, touch.current)
    },
    onContextMenu: (event: MouseEvent) => {
      // A phone's own long-press menu would cover the selection that just started.
      if (touch.current) {
        event.preventDefault()
        return
      }
      onMenu(item)
    },
  })
}

// Everything a row or card spreads onto itself: press handling plus keyboard focus.
export type RowProps = HTMLAttributes<HTMLElement> & { 'data-hash'?: string }
