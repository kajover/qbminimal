// What scrolls the page: in the frame (the wide layout) the area below
// the header, elsewhere the window.
export const PAGE_SCROLL_ID = 'page-scroll'

export function pageScroller(): HTMLElement {
  const area = document.getElementById(PAGE_SCROLL_ID)
  return area && getComputedStyle(area).overflowY === 'auto' ? area : (document.scrollingElement as HTMLElement ?? document.documentElement)
}


// A page as tall as the screen below the header, so its lists stop at the bottom and scroll on
// their own instead of the page: the frame's height on wide screens, the window's below the
// header on phones. There it ends where the torrent table does: just above the tab bar, or as far
// from the screen's edge as the tab bar would be, reaching into the page's bottom padding.
export const FILL_BOTTOM = 'window-scroll:-mb-[calc(1rem-var(--selection-bar-gap,0.25rem))]'
export const FILL_PAGE = `flex flex-col gap-4 frame:h-full window-scroll:h-[calc(100dvh-var(--header-height,calc(3rem+1px+env(safe-area-inset-top)))-var(--bottom-nav-height,0px)-var(--selection-bar-gap,0.25rem)-1rem)] ${FILL_BOTTOM}`

// Desktop layouts wherever they fit, not only on wide screens: these parts span the page, so the
// window's width tells their room. A table from a tablet up; the filters beside the list while it
// keeps about 550px; the quick search field in the header where it fits beside the buttons.
// The desktop layout: from 1200px, held sideways from 900px wide and 540px tall (a tablet, an open
// iPhone Duo), and upright from 660px wide and 840px tall (an upright tablet or open iPhone Duo).
// The same as the `wide` variant in index.css.
export const WIDE = '(min-width: 1200px), (min-width: 900px) and (min-height: 540px) and (orientation: landscape), (min-width: 660px) and (min-height: 840px)'
export const ROOM_FOR_TABLE = '(min-width: 768px)'
export const ROOM_FOR_SIDEBAR = '(min-width: 900px)'
export const ROOM_FOR_HEADER_SEARCH = '(min-width: 768px)'
