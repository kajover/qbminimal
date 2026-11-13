import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type RefObject } from 'react'
import { useSideSwipes } from '@/hooks/useSideSwipes'

const MIN_THUMB = 40

interface Geometry {
  left: number
  width: number
  // How much of the content is in view, and how far along it is scrolled, both 0 to 1.
  visible: number
  position: number
}

// A sideways scrollbar for a wide table, kept at the bottom of the screen instead of the end
// of the table, and drawn by the app so it shows on phones too. It sits just above the tab bar
// or the details panel, which share their heights as CSS variables, and shares the room it takes
// so the phone's selection bar can sit above it.
export function BottomScrollbar({ target }: { target: RefObject<HTMLElement | null> }) {
  const [geometry, setGeometry] = useState<Geometry | null>(null)
  const track = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; scrollLeft: number } | null>(null)
  useSideSwipes(target)

  useEffect(() => {
    const scroller = target.current
    if (!scroller) return
    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const { scrollWidth, clientWidth, scrollLeft } = scroller
        if (scrollWidth <= clientWidth + 1) return setGeometry(null)
        const rect = scroller.getBoundingClientRect()
        const range = scrollWidth - clientWidth
        // Right to left, scrolling starts at the right edge and scrollLeft runs from 0 down.
        const fromLeft = getComputedStyle(scroller).direction === 'rtl' ? range + scrollLeft : scrollLeft
        setGeometry({ left: rect.left, width: rect.width, visible: clientWidth / scrollWidth, position: fromLeft / range })
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(scroller)
    // The table inside grows when columns are shown or widened.
    if (scroller.firstElementChild) observer.observe(scroller.firstElementChild)
    scroller.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      scroller.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [target])

  const shown = geometry !== null
  useEffect(() => {
    if (!shown) return
    document.documentElement.style.setProperty('--table-scrollbar-space', '1rem')
    return () => { document.documentElement.style.removeProperty('--table-scrollbar-space') }
  }, [shown])

  if (!geometry) return null

  const trackWidth = geometry.width - 8
  const thumbWidth = Math.max(MIN_THUMB, geometry.visible * trackWidth)
  const thumbLeft = geometry.position * (trackWidth - thumbWidth)

  const startDrag = (e: PointerEvent<HTMLDivElement>) => {
    const scroller = target.current
    if (!scroller) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, scrollLeft: scroller.scrollLeft }
  }
  const moveDrag = (e: PointerEvent<HTMLDivElement>) => {
    const scroller = target.current
    if (!scroller || !drag.current) return
    // A thumb's width of movement scrolls a screenful of table.
    const scale = (scroller.scrollWidth - scroller.clientWidth) / Math.max(1, trackWidth - thumbWidth)
    scroller.scrollTo({ left: drag.current.scrollLeft + (e.clientX - drag.current.x) * scale })
  }
  const endDrag = () => {
    drag.current = null
  }
  // Pressing the track beside the thumb moves a screenful that way.
  const page = (e: PointerEvent<HTMLDivElement>) => {
    const scroller = target.current
    if (!scroller || !track.current) return
    const x = e.clientX - track.current.getBoundingClientRect().left
    scroller.scrollBy({ left: (x < thumbLeft ? -1 : 1) * scroller.clientWidth * 0.9, behavior: 'smooth' })
  }

  return (
    <div
      aria-hidden
      data-own-touch
      className="bottom-bar z-20 px-1"
      style={{
        left: geometry.left,
        width: geometry.width,
        // Above the phone's selection bar too, while there is one.
        '--bar-bottom': 'calc(var(--bottom-nav-height, 0px) + var(--selection-bar-space, 0px) + var(--details-height, 0px) + 0.25rem)',
      } as CSSProperties}
    >
      <div ref={track} onPointerDown={page} className="relative h-3 touch-none rounded-full border bg-background/80 shadow-sm backdrop-blur">
        <div
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="absolute inset-y-0.5 cursor-grab rounded-full bg-foreground/30 hover:bg-foreground/50 active:cursor-grabbing active:bg-foreground/60"
          style={{ left: thumbLeft, width: thumbWidth }}
        />
      </div>
    </div>
  )
}
