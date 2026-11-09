import { readStored, writeStored } from './storage'

// Whether to say when a torrent finishes while the page is open. Off until turned on in Settings.
const KEY = 'qbminimal.notifyFinished'

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window

// iPhones and iPads only have notifications in a Home Screen web app, not in a Safari tab.
export const needsHomeScreen = () =>
  typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

export const finishNoticesOn = () => readStored(KEY) === 'on'

// Phones only show notifications through a service worker, so the page registers one (it caches nothing).
export function registerServiceWorker() {
  if (__DEMO__ || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  // A relative address keeps it working when the app is served from a folder.
  navigator.serviceWorker.register('sw.js').catch(() => {})
}

// Turning them on asks the browser for permission to show notifications outside the page.
// The request has to start inside the click, with nothing awaited before it, or Safari ignores it.
export function setFinishNotices(on: boolean): Promise<boolean> {
  if (!on) {
    writeStored(KEY, null)
    return Promise.resolve(false)
  }
  const done = () => {
    writeStored(KEY, 'on')
    return true
  }
  if (!notificationsSupported() || Notification.permission !== 'default') return Promise.resolve(done())
  return new Promise<boolean>(resolve => {
    try {
      // Older Safari only takes a callback, newer browsers return a promise.
      const result = Notification.requestPermission(() => resolve(done())) as Promise<NotificationPermission> | undefined
      if (result && typeof result.then === 'function') result.then(() => resolve(done()), () => resolve(done()))
    } catch {
      resolve(done())
    }
  })
}

const show = (title: string, body: string) => {
  const options = { body, icon: 'app-icon-192.png', tag: body }
  const viaPage = () => {
    try {
      new Notification(title, options)
    } catch {
      // Nothing more to try.
    }
  }
  if (!('serviceWorker' in navigator)) return viaPage()
  navigator.serviceWorker
    .getRegistration()
    .then(registration => (registration ? registration.showNotification(title, options) : viaPage()))
    .catch(viaPage)
}

// A system notification when the page is in the background and allowed to show one;
// otherwise the caller shows its own message on the page. The answer comes straight away,
// the notification itself is sent a moment later.
export function notifyInBackground(title: string, body: string): boolean {
  if (!notificationsSupported() || Notification.permission !== 'granted' || document.visibilityState === 'visible') return false
  show(title, body)
  return true
}
