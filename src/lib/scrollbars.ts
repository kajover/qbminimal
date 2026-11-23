// Scrollbars of our own, drawn over the content like the ones macOS shows, because the browser's
// take room (a blank strip that hid the table's last column) and can't be shown only on demand.
// The browser's are hidden (index.css). With a mouse, moving within EDGE px of a box's right or
// bottom edge, where it scrolls that way, shows a thin bar there: its thumb can be dragged, and a
// click beside the thumb moves a page. Leaving the strip fades it out in qui's 0.2s. The bar
// stays clear of the box's rounded corners. Touch screens keep their own scroll indicator.
const EDGE = 12
const MIN_THUMB = 24

type Axis = 'y' | 'x'
interface Active { element: HTMLElement; axis: Axis }

let bar: HTMLDivElement
let thumb: HTMLDivElement
let active: Active | null = null
let dragging: { from: number; scroll: number; ratio: number } | null = null

const isRoot = (element: Element) => element === document.scrollingElement

// The box's area inside its borders, in window coordinates, and the radii of its corners.
function box(element: HTMLElement) {
  if (isRoot(element)) return { left: 0, top: 0, width: document.documentElement.clientWidth, height: document.documentElement.clientHeight, radius: { tl: 0, tr: 0, bl: 0, br: 0 } }
  const rect = element.getBoundingClientRect()
  const style = getComputedStyle(element)
  const r = (value: string) => parseFloat(value) || 0
  return {
    left: rect.left + element.clientLeft, top: rect.top + element.clientTop, width: element.clientWidth, height: element.clientHeight,
    radius: { tl: r(style.borderTopLeftRadius), tr: r(style.borderTopRightRadius), bl: r(style.borderBottomLeftRadius), br: r(style.borderBottomRightRadius) },
  }
}

const rtl = (element: HTMLElement) => getComputedStyle(element).direction === 'rtl'

function scrollsAlong(element: HTMLElement, axis: Axis) {
  const style = getComputedStyle(element)
  const overflow = axis === 'y' ? style.overflowY : style.overflowX
  if (!isRoot(element) && !/auto|scroll/.test(overflow)) return false
  return axis === 'y' ? element.scrollHeight > element.clientHeight + 1 : element.scrollWidth > element.clientWidth + 1
}

// Where the bar goes for this box and axis: the track (a strip along the edge, clear of the
// corners) and the thumb within it.
function layout({ element, axis }: Active) {
  const b = box(element)
  const left = rtl(element)
  if (axis === 'y') {
    const start = left ? b.radius.tl : b.radius.tr
    const end = left ? b.radius.bl : b.radius.br
    const track = { left: left ? b.left : b.left + b.width - EDGE, top: b.top + start, width: EDGE, height: b.height - start - end }
    const length = Math.max(MIN_THUMB, track.height * element.clientHeight / element.scrollHeight)
    const room = track.height - length
    const at = room * element.scrollTop / Math.max(1, element.scrollHeight - element.clientHeight)
    return { track, thumb: { left: 3, top: at, width: EDGE - 6, height: length }, room }
  }
  const track = { left: b.left + b.radius.bl, top: b.top + b.height - EDGE, width: b.width - b.radius.bl - b.radius.br, height: EDGE }
  const length = Math.max(MIN_THUMB, track.width * element.clientWidth / element.scrollWidth)
  const room = track.width - length
  // Right to left, scrollLeft runs from 0 to negative.
  const scrolled = Math.abs(element.scrollLeft) / Math.max(1, element.scrollWidth - element.clientWidth)
  const at = room * (left ? 1 - scrolled : scrolled)
  return { track, thumb: { left: at, top: 3, width: length, height: EDGE - 6 }, room }
}

const px = (value: number) => `${Math.round(value)}px`

function place() {
  if (!active) return
  if (!active.element.isConnected || !scrollsAlong(active.element, active.axis)) return hide()
  const { track, thumb: t } = layout(active)
  Object.assign(bar.style, { left: px(track.left), top: px(track.top), width: px(track.width), height: px(track.height) })
  Object.assign(thumb.style, { left: px(t.left), top: px(t.top), width: px(t.width), height: px(t.height) })
}

function show(next: Active) {
  active = next
  place()
  bar.dataset.shown = ''
}

function hide() {
  if (dragging) return
  delete bar.dataset.shown
  active = null
}

// The innermost box whose scrollbar strip is under the pointer.
function stripAt(target: EventTarget | null, x: number, y: number): Active | null {
  for (let element = target instanceof HTMLElement ? target : null; element; element = element.parentElement) {
    for (const axis of ['y', 'x'] as const) {
      if (!scrollsAlong(element, axis)) continue
      const { track } = layout({ element, axis })
      if (x >= track.left && x <= track.left + track.width && y >= track.top && y <= track.top + track.height) return { element, axis }
    }
  }
  const root = document.scrollingElement
  if (root instanceof HTMLElement && scrollsAlong(root, 'y')) {
    const { track } = layout({ element: root, axis: 'y' })
    if (x >= track.left && x <= track.left + track.width && y >= track.top && y <= track.top + track.height) return { element: root, axis: 'y' }
  }
  return null
}

function scrollTo(position: number) {
  if (!active) return
  const { element, axis } = active
  if (axis === 'y') element.scrollTop = position
  else element.scrollLeft = rtl(element) ? -position : position
}

export function startScrollbars() {
  bar = document.createElement('div')
  bar.className = 'overlay-scrollbar'
  bar.setAttribute('aria-hidden', 'true')
  thumb = document.createElement('div')
  bar.append(thumb)
  document.body.append(bar)

  let frame = 0
  let last: PointerEvent | null = null
  document.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || dragging) return
    last = event
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      if (!last) return
      // Over the bar itself, it stays.
      if (last.target instanceof Node && bar.contains(last.target)) return
      const found = stripAt(last.target, last.clientX, last.clientY)
      if (found) show(found)
      else hide()
    })
  }, { passive: true })
  document.addEventListener('pointerleave', hide)
  // Moved while shown (by the wheel, or the thumb), the thumb follows.
  document.addEventListener('scroll', () => { if (active) place() }, { capture: true, passive: true })
  window.addEventListener('resize', hide)

  thumb.addEventListener('pointerdown', (event) => {
    if (!active) return
    event.preventDefault()
    event.stopPropagation()
    thumb.setPointerCapture(event.pointerId)
    const { element, axis } = active
    const { room } = layout(active)
    const scrollRange = axis === 'y' ? element.scrollHeight - element.clientHeight : element.scrollWidth - element.clientWidth
    const scroll = axis === 'y' ? element.scrollTop : Math.abs(element.scrollLeft)
    const flip = axis === 'x' && rtl(element) ? -1 : 1
    dragging = { from: axis === 'y' ? event.clientY : event.clientX, scroll, ratio: flip * scrollRange / Math.max(1, room) }
    bar.dataset.dragging = ''
  })
  thumb.addEventListener('pointermove', (event) => {
    if (!dragging || !active) return
    const moved = (active.axis === 'y' ? event.clientY : event.clientX) - dragging.from
    scrollTo(dragging.scroll + moved * dragging.ratio)
  })
  const endDrag = (event: PointerEvent) => {
    if (!dragging) return
    dragging = null
    delete bar.dataset.dragging
    if (!(event.target instanceof Node && bar.contains(document.elementFromPoint(event.clientX, event.clientY)))) hide()
  }
  thumb.addEventListener('pointerup', endDrag)
  thumb.addEventListener('pointercancel', endDrag)
  // A click on the track beside the thumb moves a page that way.
  bar.addEventListener('pointerdown', (event) => {
    if (!active || event.target !== bar) return
    event.preventDefault()
    const { element, axis } = active
    const rect = thumb.getBoundingClientRect()
    const before = axis === 'y' ? event.clientY < rect.top : event.clientX < rect.left
    const page = (axis === 'y' ? element.clientHeight : element.clientWidth) * 0.9
    const forward = axis === 'x' && rtl(element) ? before : !before
    if (axis === 'y') element.scrollBy({ top: forward ? page : -page })
    else element.scrollBy({ left: forward ? page : -page })
  })
  bar.addEventListener('pointerleave', () => { if (!dragging) hide() })
}
