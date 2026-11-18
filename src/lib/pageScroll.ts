// What scrolls the page: in the frame (wide screens, or scrollbars that take room) the area below
// the header, elsewhere the window.
export const PAGE_SCROLL_ID = 'page-scroll'

export function pageScroller(): HTMLElement {
  const area = document.getElementById(PAGE_SCROLL_ID)
  return area && getComputedStyle(area).overflowY === 'auto' ? area : (document.scrollingElement as HTMLElement ?? document.documentElement)
}
