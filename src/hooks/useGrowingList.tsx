import { startTransition, useEffect, useState } from 'react'

// Long lists of cards draw 300 at a time (the first few at once) and quietly add 300 more as their end comes near, so a
// few thousand torrents don't all draw at once. There are no pages: the list just goes on. Only
// the drawing grows; selecting all and acting on the selection still covers every item.
const BATCH = 300
// A list first draws only a screenful or two, so coming back to the page (or a new filter) shows
// at once, even on a phone; the rest of the first batch follows straight after, at low priority,
// so a tap in the meantime isn't held up.
const FIRST = 40
// How far ahead of the end the next batch is drawn.
const AHEAD = '0px 0px 1200px 0px'

export function useGrowingList<T>(items: T[], restart: unknown) {
  const [limit, setLimit] = useState(FIRST)
  // A new filter, search or sort starts again from the first cards.
  const [restarted, setRestarted] = useState(restart)
  if (restart !== restarted) {
    setRestarted(restart)
    setLimit(FIRST)
  }
  // Once the first cards are on screen, the rest of the batch.
  useEffect(() => {
    if (limit >= BATCH) return
    const timer = window.setTimeout(() => startTransition(() => setLimit(current => Math.max(current, BATCH))))
    return () => window.clearTimeout(timer)
  }, [limit])
  const [end, setEnd] = useState<HTMLElement | null>(null)
  const more = limit < items.length

  useEffect(() => {
    if (!end || !more || typeof IntersectionObserver === 'undefined') return
    // Watched from the box that scrolls the list (the frame), or the window on phones.
    let root: HTMLElement | null = end.parentElement
    while (root && !/auto|scroll/.test(getComputedStyle(root).overflowY)) root = root.parentElement
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) setLimit(current => (current < BATCH ? BATCH : current + BATCH))
    }, { root, rootMargin: AHEAD })
    observer.observe(end)
    // Observed again after each batch, so a list still short of the end keeps growing.
    return () => observer.disconnect()
  }, [end, more, limit])

  return {
    shown: more ? items.slice(0, limit) : items,
    more,
    // Draws up to this item, for the keyboard moving past the last one drawn.
    showUpTo: (index: number) => { if (index >= limit - 1) setLimit(Math.ceil((index + 2) / BATCH) * BATCH) },
    // A marker after the last item drawn, watched to draw the next batch.
    endMarker: more ? <div ref={setEnd} aria-hidden className="h-px" /> : null,
  }
}
