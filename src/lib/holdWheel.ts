import { PAGE_SCROLL_ID, pageScroller } from '@/lib/pageScroll'

// A ref for the bar below a list in the frame (wide screens): the wheel or trackpad over it scrolls
// nothing, so neither the list nor the page around it moves or bounces. Elsewhere the window scrolls
// the page, and the wheel is left to it.
export function holdWheel(bar: HTMLElement | null) {
  if (!bar) return
  const onWheel = (event: WheelEvent) => {
    if (pageScroller().id === PAGE_SCROLL_ID) event.preventDefault()
  }
  bar.addEventListener('wheel', onWheel, { passive: false })
  return () => bar.removeEventListener('wheel', onWheel)
}
