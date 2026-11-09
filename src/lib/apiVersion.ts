// Web API versions that added features this app uses. qBittorrent 5.2.3 reports 2.15.1.
export const API_FEATURES = {
  // torrents/parseMetadata and torrents/fetchMetadata (qBittorrent 5.2)
  metadata: [2, 15, 0],
  // app/getFreeSpaceAtPath
  freeSpaceAtPath: [2, 15, 2],
  // shareLimitsMode on torrents and in torrents/setShareLimits
  shareLimitsMode: [2, 15, 3],
  // torrents/downloadFile, and torrentcreator/addTask's ignoreDotfiles (qBittorrent 5.3)
  fileDownload: [2, 16, 0],
  creatorIgnoreDotfiles: [2, 16, 0],
  // transfer/pauseSession and transfer/resumeSession
  sessionPause: [2, 16, 2],
} as const

export type ApiFeature = keyof typeof API_FEATURES

export function isApiAtLeast(webApiVersion: string | undefined, minimum: readonly number[]): boolean {
  if (!webApiVersion) return false
  const version = webApiVersion.trim().split('.').map(Number)
  if (version.length === 0 || version.some(Number.isNaN)) return false
  for (let i = 0; i < minimum.length; i++) {
    const part = version[i] ?? 0
    if (part !== minimum[i]) return part > minimum[i]
  }
  return true
}

export function supportsFeature(webApiVersion: string | undefined, feature: ApiFeature): boolean {
  return isApiAtLeast(webApiVersion, API_FEATURES[feature])
}
