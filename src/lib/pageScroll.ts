// What scrolls the page: in the frame (wide screens, or scrollbars that take room) the area below
// the header, elsewhere the window.
export const PAGE_SCROLL_ID = 'page-scroll'

export function pageScroller(): HTMLElement {
  const area = document.getElementById(PAGE_SCROLL_ID)
  return area && getComputedStyle(area).overflowY === 'auto' ? area : (document.scrollingElement as HTMLElement ?? document.documentElement)
}

// Whether the page is in the frame (see the `frame` variant in index.css): wide screens, or
// scrollbars that take room.
export function inFrame(wide: boolean): boolean {
  return wide || document.documentElement.dataset.scrollbars === 'room'
}

// A page as tall as the screen below the header, so its lists stop at the bottom and scroll on
// their own instead of the page: the frame's height on wide screens, the window's below the
// header and above the tab bar on phones.
export const FILL_PAGE = 'flex flex-col gap-4 frame:h-full window-scroll:h-[calc(100dvh-var(--header-height,calc(3rem+1px+env(safe-area-inset-top)))-var(--bottom-nav-height,0px)-2rem)]'

// Desktop layouts wherever they fit, not only on wide screens: these parts span the page, so the
// window's width tells their room. A table from a tablet up; the filters beside the list while it
// keeps about 550px; the quick search field in the header where it fits beside the buttons.
export const ROOM_FOR_TABLE = '(min-width: 768px)'
export const ROOM_FOR_SIDEBAR = '(min-width: 900px)'
export const ROOM_FOR_HEADER_SEARCH = '(min-width: 768px)'
