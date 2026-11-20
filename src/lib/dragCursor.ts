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
