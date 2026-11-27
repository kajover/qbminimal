// How far down the details first open: to just below Export .torrent (marked
// data-details-reach), so the torrent's name, paths and magnet link show without scrolling. From
// the top of the panel or sheet, with room for the padding below it. With another tab open, the
// Details tab is drawn unseen to measure it (DetailsTabs' `probe`), from its own top, and the
// open tab's top is added; the result is kept.
let detailsReach: number | undefined
export function measureReach(box: HTMLElement | null): number | undefined {
  // The shown one: phones place it below the magnet link, wider screens beside it.
  const mark = [...box?.querySelectorAll('[data-details-reach]') ?? []].find(element => element.getBoundingClientRect().height > 0)
  const panel = mark?.closest('[role=tabpanel]')
  // Where the open tab's contents start; the unseen Details tab starts there too.
  const open = box?.querySelector('[role=tabpanel][data-state=active]')
  if (box && mark && panel && open) {
    detailsReach = Math.ceil(mark.getBoundingClientRect().bottom - panel.getBoundingClientRect().top + open.getBoundingClientRect().top - box.getBoundingClientRect().top) + 16
  }
  return detailsReach
}

// The last measure, or undefined before the first.
export const knownReach = () => detailsReach
