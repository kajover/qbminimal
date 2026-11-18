import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react'

const LONG_PRESS_MS = 500
// A finger that moves this far is scrolling, not holding.
const MOVE_TOLERANCE = 10

// A finger held on an element, for touch screens; a mouse uses Ctrl or Cmd and a click instead.
// `wasHeld()` says, once, that the click ending a hold should do nothing more.
export function useLongPress(onLongPress: (() => void) | undefined) {
  const hold = useRef<{ timer: number; x: number; y: number } | null>(null)
  const held = useRef(false)
  const cancel = () => {
    if (hold.current) window.clearTimeout(hold.current.timer)
    hold.current = null
  }
  useEffect(() => cancel, [])
  const wasHeld = () => {
    const was = held.current
    held.current = false
    return was
  }
  const handlers = {
    onPointerDown: (e: PointerEvent) => {
      cancel()
      held.current = false
      if (!onLongPress || e.pointerType === 'mouse') return
      const timer = window.setTimeout(() => {
        hold.current = null
        held.current = true
        navigator.vibrate?.(10)
        onLongPress()
      }, LONG_PRESS_MS)
      hold.current = { timer, x: e.clientX, y: e.clientY }
    },
    onPointerMove: (e: PointerEvent) => {
      const start = hold.current
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_TOLERANCE) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    // The phone's own menu for a held element would cover the page.
    onContextMenu: (e: MouseEvent) => { if (onLongPress && held.current) e.preventDefault() },
  }
  return { handlers, wasHeld }
}
