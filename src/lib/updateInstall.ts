// Where an update install stands. Kept outside the Settings page, which unmounts when another page
// opens while the install carries on, so coming back shows its progress, not the Install button.
export interface InstallState {
  // The percent downloaded while an update installs, null otherwise.
  percent: number | null
  // Set once qBittorrent serves the new version; the page reloads when asked, not by itself.
  installed: boolean
}

const IDLE: InstallState = { percent: null, installed: false }
let state = IDLE
let control: AbortController | null = null
const listeners = new Set<() => void>()

export const getInstallState = () => state
export function subscribeInstall(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function setInstallState(next: Partial<InstallState>) {
  state = { ...state, ...next }
  for (const listener of listeners) listener()
}

// Starts a new install's cancel handle.
export function startInstallControl() {
  control = new AbortController()
  return control
}
export const cancelInstall = () => control?.abort()

// For tests.
export function resetInstallState() {
  control = null
  setInstallState(IDLE)
}
