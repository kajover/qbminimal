import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// One hover label for the whole app: resting the mouse on a button, link or other control, or
// reaching it with the keyboard, shows its name (its title, or else its aria-label) just above it,
// quicker and more legible than the browser's own tooltip, which it replaces while shown. A disabled button ignores the pointer, so
// its wrapper's title is used, which says why it's unavailable. Touch screens have no hover, so
// they get none; buttons with their own Tooltip (data-own-tooltip) are left to it.
const CONTROL = 'button, a[href], [role="button"], [role="tab"], [role="switch"], [role="checkbox"], select, summary'
const DELAY_MS = 400
const GAP = 6

function labelOf(element: Element): string {
  return (element.getAttribute('title') || element.getAttribute('data-hover-title') || element.getAttribute('aria-label') || '').trim()
}

function findTarget(from: EventTarget | null): HTMLElement | null {
  if (!(from instanceof Element)) return null
  const control = from.closest<HTMLElement>(CONTROL)
  if (control) {
    if (control.closest('[data-own-tooltip]')) return null
    const label = labelOf(control)
    // A label that only repeats the button's visible text adds nothing.
    return label && label !== control.textContent?.trim() ? control : null
  }
  // The wrapper of a disabled control, which carries the reason in its title.
  const wrapper = from.closest<HTMLElement>('[title]')
  return wrapper?.querySelector(':disabled, [aria-disabled="true"]') ? wrapper : null
}

export function HoverLabels() {
  const [shown, setShown] = useState<{ text: string; rect: DOMRect } | null>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let current: HTMLElement | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    // The browser's tooltip would show as well, so the title is set aside while ours is up.
    const restoreTitle = () => {
      const kept = current?.getAttribute('data-hover-title')
      if (current && kept !== null && kept !== undefined) {
        current.setAttribute('title', kept)
        current.removeAttribute('data-hover-title')
      }
    }
    const hide = () => {
      clearTimeout(timer)
      restoreTitle()
      current = null
      setShown(null)
    }
    const over = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const target = findTarget(e.target)
      if (target === current) return
      hide()
      if (!target) return
      current = target
      const title = target.getAttribute('title')
      if (title !== null) {
        target.setAttribute('data-hover-title', title)
        target.removeAttribute('title')
      }
      timer = setTimeout(() => {
        if (current !== target || !target.isConnected) return
        setShown({ text: labelOf(target), rect: target.getBoundingClientRect() })
      }, DELAY_MS)
    }
    // Reaching a control with the keyboard shows its label at once, until focus moves on. Only
    // after a key press: dialogs and sheets move focus themselves when they open, which isn't that.
    let byKeyboard = false
    const key = (e: KeyboardEvent) => { if (e.key === 'Tab' || e.key.startsWith('Arrow')) byKeyboard = true }
    const point = () => { byKeyboard = false }
    const focus = (e: FocusEvent) => {
      const target = findTarget(e.target)
      if (!byKeyboard || !target || !target.matches(':focus-visible')) return
      hide()
      current = target
      setShown({ text: labelOf(target), rect: target.getBoundingClientRect() })
    }
    const blur = () => { if (current?.matches(':focus-visible')) hide() }
    const out = (e: PointerEvent) => {
      if (current && !(e.relatedTarget instanceof Node && current.contains(e.relatedTarget))) hide()
    }
    document.addEventListener('pointerover', over)
    document.addEventListener('pointerout', out)
    document.addEventListener('keydown', key)
    document.addEventListener('pointerdown', point)
    document.addEventListener('focusin', focus)
    document.addEventListener('focusout', blur)
    document.addEventListener('pointerdown', hide, true)
    document.addEventListener('keydown', hide, true)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('blur', hide)
    return () => {
      hide()
      document.removeEventListener('pointerover', over)
      document.removeEventListener('pointerout', out)
      document.removeEventListener('keydown', key)
      document.removeEventListener('pointerdown', point)
      document.removeEventListener('focusin', focus)
      document.removeEventListener('focusout', blur)
      document.removeEventListener('pointerdown', hide, true)
      document.removeEventListener('keydown', hide, true)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('blur', hide)
    }
  }, [])

  // Above the control, or below it when there's no room; kept on screen sideways.
  useLayoutEffect(() => {
    if (!shown || !box.current) {
      setPosition(null)
      return
    }
    const { width, height } = box.current.getBoundingClientRect()
    const { rect } = shown
    const above = rect.top - GAP - height
    const top = above >= 4 ? above : rect.bottom + GAP
    const left = Math.min(Math.max(4, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 4)
    setPosition({ left, top })
  }, [shown])

  if (!shown) return null
  return (
    <div
      ref={box}
      role="tooltip"
      style={position ?? { left: 0, top: 0, visibility: 'hidden' }}
      className="pointer-events-none fixed z-[70] max-w-72 rounded-md bg-foreground px-2 py-1 text-xs text-balance text-background shadow-sm animate-in fade-in-0"
    >
      {shown.text}
    </div>
  )
}
