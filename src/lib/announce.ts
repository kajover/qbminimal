let region: HTMLElement | null = null
let frame = 0

function getRegion() {
  if (region?.isConnected) return region
  region = document.createElement('div')
  region.setAttribute('role', 'status')
  region.setAttribute('aria-live', 'polite')
  region.setAttribute('aria-atomic', 'true')
  region.className = 'sr-only'
  document.body.appendChild(region)
  return region
}

// Tells screen readers something that changed without moving focus. The text is cleared first
// and set on the next frame, so the same message twice in a row is read again.
export function announce(message: string) {
  if (typeof document === 'undefined') return
  const element = getRegion()
  element.textContent = ''
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => { element.textContent = message })
}
