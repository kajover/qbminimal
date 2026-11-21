// Notifications sit outside every dialog and sheet. A sheet that's open makes the rest of the page
// ignore the pointer, and would close when one is touched, so they stay usable on top of it: they
// catch the pointer themselves (index.css) and touching one isn't touching outside the sheet.
export function keepOpenForNotices(event: { target: EventTarget | null; preventDefault: () => void }) {
  if (event.target instanceof Element && event.target.closest('[data-sonner-toaster]')) event.preventDefault()
}
