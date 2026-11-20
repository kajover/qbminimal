// Checks GitHub for newer releases of qbminimal and qBittorrent. Only runs when asked to.

export const QBMINIMAL_RELEASES = 'https://github.com/kajover/qbminimal/releases/latest'
export const QBITTORRENT_DOWNLOADS = 'https://www.qbittorrent.org/download'

type Version = [number, number, number]

// "v1.2.3", "1.2.3" or "release-1.2.3" as numbers; anything else, such as a beta, is null.
export function parseVersion(text: string | undefined): Version | null {
  const match = /^(?:v|release-)?(\d+)\.(\d+)\.(\d+)$/.exec(text?.trim() ?? '')
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
}

export function isNewer(candidate: Version, current: Version) {
  for (let i = 0; i < 3; i++) if (candidate[i] !== current[i]) return candidate[i] > current[i]
  return false
}

export const formatVersion = (version: Version) => version.join('.')

// The newest finished qBittorrent release among its git tags, which are named like release-5.1.2.
export function newestRelease(tags: readonly string[]): Version | null {
  let newest: Version | null = null
  for (const tag of tags) {
    const version = parseVersion(tag.startsWith('release-') ? tag : undefined)
    if (version && (!newest || isNewer(version, newest))) newest = version
  }
  return newest
}

async function getJson(url: string) {
  const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } })
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`)
  return response.json() as Promise<unknown>
}

export const UPDATE_TORRENT_ASSET = 'qbminimal-update.torrent'
export const RELEASE_ZIP_ASSET = 'qbminimal-release.zip'

// An update installs through its torrent, which GitHub counts on the .torrent file only. The zip is
// downloaded once as well, and thrown away, so its count shows every install, by hand or in the
// app, and the .torrent's count shows how many came through the app. Not waited for, so the update
// is no slower, and failing here changes nothing.
export function countReleaseDownload(version: string) {
  const parsed = parseVersion(version)
  if (!parsed || typeof fetch !== 'function') return
  fetch(`https://github.com/kajover/qbminimal/releases/download/v${parsed.join('.')}/${RELEASE_ZIP_ASSET}`, { mode: 'no-cors', cache: 'no-store', credentials: 'omit' })
    .catch(() => undefined)
}

// The newest qbminimal release, and where its update torrent is, if it has one.
export async function latestQbminimalRelease(): Promise<{ version: Version | null; torrentUrl?: string }> {
  const release = await getJson('https://api.github.com/repos/kajover/qbminimal/releases/latest') as { tag_name?: string; assets?: { name?: string; browser_download_url?: string }[] }
  const torrentUrl = release.assets?.find(asset => asset.name === UPDATE_TORRENT_ASSET)?.browser_download_url
  return { version: parseVersion(release.tag_name), torrentUrl: torrentUrl?.startsWith('https://') ? torrentUrl : undefined }
}

export async function latestQbminimal(): Promise<Version | null> {
  return (await latestQbminimalRelease()).version
}

export async function latestQbittorrent(): Promise<Version | null> {
  const tags = await getJson('https://api.github.com/repos/qbittorrent/qBittorrent/tags?per_page=100') as { name?: string }[]
  return newestRelease(tags.map(tag => tag.name ?? ''))
}
