import { useLayoutEffect, useState, type RefObject } from 'react'

// Long lists draw only the rows in view, and some above and below, so selecting or changing
// hundreds of torrents redraws a few dozen rows rather than all of them. Short lists draw every row.
const ALL_ROWS_UP_TO = 80
const EXTRA_ROWS = 10
// Until a row is measured: a table row with 14px text and its padding.
const ROW_HEIGHT = 37

export interface RowWindow { start: number; end: number; before: number; after: number }

export function useRowWindow(scroller: RefObject<HTMLElement | null>, count: number): RowWindow {
  const [view, setView] = useState({ top: 0, height: 0, row: ROW_HEIGHT })
  const windowed = count > ALL_ROWS_UP_TO
  useLayoutEffect(() => {
    const box = scroller.current
    if (!box || !windowed) return
    const measure = () => {
      // A drawn row, not the space standing in for the rows above.
      const row = box.querySelector('tbody tr[data-hash]')?.getBoundingClientRect().height || ROW_HEIGHT
      // Kept in whole rows, so scrolling within a row draws nothing again.
      setView(current => {
        const next = { top: Math.floor(box.scrollTop / row) * row, height: box.clientHeight, row }
        return next.top === current.top && next.height === current.height && next.row === current.row ? current : next
      })
    }
    measure()
    box.addEventListener('scroll', measure, { passive: true })
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(box)
    return () => {
      box.removeEventListener('scroll', measure)
      observer?.disconnect()
    }
  }, [scroller, windowed])
  if (!windowed) return { start: 0, end: count, before: 0, after: 0 }
  // Before the first measurement, a screenful of rows from the top.
  const shown = Math.ceil((view.height || 1000) / view.row)
  const start = Math.max(0, Math.round(view.top / view.row) - EXTRA_ROWS)
  const end = Math.min(count, Math.round(view.top / view.row) + shown + EXTRA_ROWS)
  return { start, end, before: start * view.row, after: (count - end) * view.row }
}

// Brings a row that may not be drawn yet into view, then hands it over once it is.
export function revealRow(index: number, hash: string, then: (row: HTMLElement) => void) {
  const found = () => document.querySelector<HTMLElement>(`[data-hash="${hash}"]`)
  const row = found()
  if (row) return then(row)
  const box = document.querySelector<HTMLElement>('[data-row-scroller]')
  const height = document.querySelector('tbody tr[data-hash]')?.getBoundingClientRect().height || ROW_HEIGHT
  if (!box) return
  box.scrollTop = index * height
  // Drawn after the scroll has been measured and the rows redrawn.
  requestAnimationFrame(() => requestAnimationFrame(() => { const next = found(); if (next) then(next) }))
}
