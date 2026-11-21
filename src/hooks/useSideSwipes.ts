import { useEffect, type RefObject } from 'react'

// Swipes that start here are left alone: they belong to what's under the finger or pointer.
const OWN_SWIPES = '[role="dialog"], [role="menu"], [data-keeps-swipes], [data-sonner-toast], input, textarea, select'

// Whether a swipe starting at this element should move the table: not when it starts on the
// table itself (which scrolls natively), in something else that scrolls sideways, or in a
// dialog, menu, form field or the details panel.
function movesTable(start: EventTarget | null, scroller: HTMLElement) {
  if (scroller.scrollWidth <= scroller.clientWidth + 1) return false
  if (!(start instanceof Element) || start.closest(OWN_SWIPES)) return false
  for (let el: Element | null = start; el && el !== document.body; el = el.parentElement) {
    if (el === scroller) return false
    if (el.scrollWidth > el.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return false
  }
  return true
}

// How far a finger moves before the swipe counts as sideways or up and down.
const INTENT_DISTANCE = 8
// How quickly a flick's glide slows down, per frame at 60 frames a second.
const FRICTION = 0.95

// A sideways swipe anywhere on the page, the space under a short list included, scrolls the
// table, instead of doing nothing or making the browser go back a page. Trackpads send wheel
// events; on touch screens the finger drags the table and a flick lets it glide on.
export function useSideSwipes(scrollerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      if (!movesTable(e.target, scroller)) return
      e.preventDefault()
      scroller.scrollBy({ left: e.deltaMode === 1 ? e.deltaX * 16 : e.deltaX })
    }

    let touch: { id: number; x: number; y: number; scrollLeft: number; sideways: boolean | null; lastX: number; lastTime: number; velocity: number } | null = null
    let glide = 0
    const stopGlide = () => cancelAnimationFrame(glide)

    const onTouchStart = (e: TouchEvent) => {
      stopGlide()
      touch = null
      if (e.touches.length !== 1 || !movesTable(e.target, scroller)) return
      // The bottom scrollbar's thumb follows the finger itself.
      if (e.target instanceof Element && e.target.closest('[data-own-touch]')) return
      const t = e.touches[0]
      touch = { id: t.identifier, x: t.clientX, y: t.clientY, scrollLeft: scroller.scrollLeft, sideways: null, lastX: t.clientX, lastTime: e.timeStamp, velocity: 0 }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!touch) return
      const t = Array.from(e.touches).find(x => x.identifier === touch?.id)
      if (!t) return
      const dx = t.clientX - touch.x
      const dy = t.clientY - touch.y
      if (touch.sideways === null) {
        if (Math.hypot(dx, dy) < INTENT_DISTANCE) return
        touch.sideways = Math.abs(dx) > Math.abs(dy)
      }
      if (!touch.sideways) return
      // Sideways: the page stays still vertically, and the browser doesn't go back a page.
      if (e.cancelable) e.preventDefault()
      scroller.scrollLeft = touch.scrollLeft - dx
      const elapsed = e.timeStamp - touch.lastTime
      if (elapsed > 0) touch.velocity = 0.8 * ((t.clientX - touch.lastX) / elapsed) + 0.2 * touch.velocity
      touch.lastX = t.clientX
      touch.lastTime = e.timeStamp
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (!touch?.sideways) {
        touch = null
        return
      }
      // A recent, quick flick keeps the table moving for a moment.
      let velocity = e.timeStamp - touch.lastTime < 80 ? touch.velocity * 16 : 0
      touch = null
      const step = () => {
        if (Math.abs(velocity) < 0.5) return
        scroller.scrollLeft -= velocity
        velocity *= FRICTION
        glide = requestAnimationFrame(step)
      }
      glide = requestAnimationFrame(step)
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      stopGlide()
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [scrollerRef])
}
