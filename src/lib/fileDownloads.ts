// qBittorrent serves completed torrent files itself through this endpoint, added in Web API
// 2.16.0 (qBittorrent 5.3); supportsFeature(…, 'fileDownload') says whether it's there.
const DOWNLOAD_ENDPOINT = 'api/v2/torrents/downloadFile'

// `fileIndex` is the file's `index` from torrents/files. The path stays relative
// so the link also works when qBittorrent is served from a sub-path.
export function getFileDownloadUrl(hash: string, fileIndex: number): string {
  const params = new URLSearchParams({ hash, file: String(fileIndex) })
  return `${DOWNLOAD_ENDPOINT}?${params}`
}
