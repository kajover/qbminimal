// While an edge is dragged, its resize cursor shows everywhere, also where the pointer runs past
// the edge at its limit or over buttons, until the drag ends. Returns what ends it.
export function holdCursor(cursor: string): () => void {
  const root = document.documentElement
  root.style.setProperty('--drag-cursor', cursor)
  root.dataset.dragCursor = ''
  return () => {
    delete root.dataset.dragCursor
    root.style.removeProperty('--drag-cursor')
  }
}

// After a drag the browser may still send a click to whatever now lies under the pointer, as the
// panel moved or closed: a card or row there would be selected. That one click is dropped.
export function swallowClick() {
  const drop = (event: MouseEvent) => {
    event.stopPropagation()
    event.preventDefault()
  }
  window.addEventListener('click', drop, { capture: true, once: true })
  window.setTimeout(() => window.removeEventListener('click', drop, { capture: true }), 400)
}
