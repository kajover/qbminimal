import type {
  Cookie,
  LogEntry,
  PeerLogEntry,
  RSSFeed,
  RSSItem,
  RSSRule,
  SearchResult,
  TorrentCategory,
  TorrentCreatorTask,
  TorrentFile,
  TorrentPeer,
  TorrentPeers,
  TorrentTracker,
  WebSeed,
} from '@/types'
import type { MainDataUpdate } from './mainData'
import { flattenRSSTree, listRSSFolders, type RawRSSTree } from './rss'
import type { ShareLimits } from './shareLimits'
import { encodeTrackerUrls } from './trackers'
import { demoClient } from './demoClient'

// Relative, so the app also works when qBittorrent sits under a sub-path behind a reverse proxy.
const API_ROOT = 'api/v2'

class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// True when `error` is qBittorrent answering with this HTTP status, such as 404 for an
// endpoint an older version doesn't have.
export function hasStatus(error: unknown, status: number): boolean {
  return error instanceof ApiError && error.status === status
}

type Params = Record<string, string | number | boolean | undefined>

function encode(params: Params): URLSearchParams {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.append(key, String(value))
  }
  return search
}

// qBittorrent takes several hashes, URLs, or names in one field, separated by |.
const many = (values: string[]) => values.join('|')

// Links rather than calls, so the browser saves the file itself.
export const getTorrentExportUrl = (hash: string) => `${API_ROOT}/torrents/export?${encode({ hash })}`
export const getCreatedTorrentUrl = (taskID: string) => `${API_ROOT}/torrentcreator/torrentFile?${encode({ taskID })}`

export type QueueMove = 'top' | 'up' | 'down' | 'bottom'
const QUEUE_ACTIONS: Record<QueueMove, string> = { top: 'topPrio', up: 'increasePrio', down: 'decreasePrio', bottom: 'bottomPrio' }

export interface SearchPlugin {
  name: string
  fullName?: string
  version: string
  enabled: boolean
}

export interface SearchJob {
  id: number
  status: string
  total: number
}

export interface LogLevels {
  normal: boolean
  info: boolean
  warning: boolean
  critical: boolean
}

// The browser keeps qBittorrent's session in an HttpOnly cookie, so the app never stores a password.
class QbitClient {
  private sessionEnded: (() => void) | null = null

  // Called when qBittorrent turns a request away because the session is gone.
  onUnauthorized(handler: (() => void) | null): void {
    this.sessionEnded = handler
  }

  private async send<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_ROOT}/${path}`, { credentials: 'same-origin', ...init })
    const text = await response.text()
    if (response.status === 401 || response.status === 403) {
      this.sessionEnded?.()
      throw new ApiError(response.status, 'Your session has ended. Sign in again.')
    }
    if (!response.ok) throw new ApiError(response.status, text.trim() || `qBittorrent answered with status ${response.status}`)
    if (!text) return undefined as T
    try {
      return JSON.parse(text) as T
    } catch {
      return text as T
    }
  }

  private get<T>(path: string, params?: Params): Promise<T> {
    return this.send<T>(params ? `${path}?${encode(params)}` : path)
  }

  private post<T = void>(path: string, params: Params = {}): Promise<T> {
    return this.send<T>(path, { method: 'POST', body: encode(params) })
  }

  private upload<T>(path: string, form: FormData): Promise<T> {
    return this.send<T>(path, { method: 'POST', body: form })
  }

  // --- Session ---

  // Any authenticated request works as a check. app/version is the cheapest.
  async checkSession(): Promise<boolean> {
    try {
      const response = await fetch(`${API_ROOT}/app/version`, { credentials: 'same-origin' })
      return response.ok
    } catch {
      return false
    }
  }

  // qBittorrent 5.2 answers a good login with 204 and no body. Older versions answer 200 with
  // "Ok." or "Fails.".
  async login(username: string, password: string): Promise<boolean> {
    const response = await fetch(`${API_ROOT}/auth/login`, { method: 'POST', credentials: 'same-origin', body: encode({ username, password }) })
    if (response.status === 204) return true
    return response.ok && (await response.text()).trim() === 'Ok.'
  }

  async logout(): Promise<void> {
    await fetch(`${API_ROOT}/auth/logout`, { method: 'POST', credentials: 'same-origin' }).catch(() => undefined)
  }

  // --- Application ---

  getAppVersion = () => this.get<string>('app/version')
  // A two-part version like "2.8" parses as a number, so it's turned back into text.
  getWebApiVersion = async () => String(await this.get<string | number>('app/webapiVersion'))
  getBuildInfo = () => this.get<Record<string, string | number>>('app/buildInfo')
  getProcessInfo = () => this.get<{ launch_time?: number }>('app/processInfo')
  shutdown = () => this.post('app/shutdown')
  getPreferences = () => this.get<Record<string, unknown>>('app/preferences')
  setPreferences = (changes: Record<string, unknown>) => this.post('app/setPreferences', { json: JSON.stringify(changes) })
  // Full paths of the folders, or of everything, inside a folder on qBittorrent's machine.
  getDirectoryContent = (dirPath: string, mode: 'dirs' | 'all') => this.get<string[]>('app/getDirectoryContent', { dirPath, mode })
  // Web API 2.15.2 and newer: bytes free on the drive holding `path`.
  getFreeSpaceAtPath = async (path: string) => Number(await this.get<number | string>('app/getFreeSpaceAtPath', { path }))
  getCookies = () => this.get<Cookie[]>('app/cookies')
  setCookies = (cookies: Cookie[]) => this.post('app/setCookies', { cookies: JSON.stringify(cookies) })
  rotateApiKey = async () => (await this.post<{ apiKey?: string }>('app/rotateAPIKey'))?.apiKey ?? ''
  deleteApiKey = () => this.post('app/deleteAPIKey')
  getNetworkInterfaces = () => this.get<{ name: string; value: string }[]>('app/networkInterfaceList')
  getInterfaceAddresses = (iface: string) => this.get<string[]>('app/networkInterfaceAddressList', { iface })
  sendTestEmail = () => this.post('app/sendTestEmail')

  // --- Transfers ---

  getMainData = (rid: number) => this.get<MainDataUpdate>('sync/maindata', { rid })
  toggleSpeedLimitsMode = () => this.post('transfer/toggleSpeedLimitsMode')
  // The global limits in bytes per second, 0 for none. While the alternative limits are on, these set those.
  setGlobalDownloadLimit = (limit: number) => this.post('transfer/setDownloadLimit', { limit })
  setGlobalUploadLimit = (limit: number) => this.post('transfer/setUploadLimit', { limit })
  // Web API 2.16.2 and newer. Stops every transfer but keeps each torrent's own state.
  pauseSession = () => this.post('transfer/pauseSession')
  resumeSession = () => this.post('transfer/resumeSession')
  // Bans apply to every torrent, not only the one the peer came from.
  banPeers = (peers: string[]) => this.post('transfer/banPeers', { peers: many(peers) })

  // --- Torrents ---

  // `params` comes from buildAddParams. Links and files can go together.
  addTorrents(params: Record<string, string>, files: File[], filePriorities?: number[]): Promise<unknown> {
    const form = new FormData()
    for (const [key, value] of Object.entries(params)) form.append(key, value)
    for (const file of files) form.append('torrents', file, file.name)
    if (filePriorities?.length) form.append('filePriorities', filePriorities.join(','))
    return this.upload('torrents/add', form)
  }

  // A search plugin can download the .torrent itself, for sites that need its login.
  addTorrentUrl = (url: string, options: { savePath?: string; category?: string; downloader?: string } = {}) =>
    this.addTorrents(Object.fromEntries(Object.entries({ urls: url, savepath: options.savePath, category: options.category, downloader: options.downloader }).filter(([, value]) => value)) as Record<string, string>, [])

  // Reads .torrent files without adding them. qBittorrent keeps the result, so they can then be added by hash.
  parseMetadata(files: File[]): Promise<unknown[]> {
    const form = new FormData()
    for (const file of files) form.append('torrents', file, file.name)
    return this.upload('torrents/parseMetadata', form)
  }

  // Asks for a link's file list. qBittorrent answers with only the hash until it has the metadata.
  fetchMetadata = (source: string) => this.post<unknown>('torrents/fetchMetadata', { source })

  pauseTorrents = (hashes: string[]) => this.post('torrents/stop', { hashes: many(hashes) })
  resumeTorrents = (hashes: string[]) => this.post('torrents/start', { hashes: many(hashes) })
  deleteTorrents = (hashes: string[], deleteFiles = false) => this.post('torrents/delete', { hashes: many(hashes), deleteFiles })
  recheckTorrents = (hashes: string[]) => this.post('torrents/recheck', { hashes: many(hashes) })
  reannounceTorrents = (hashes: string[]) => this.post('torrents/reannounce', { hashes: many(hashes) })
  moveInQueue = (hashes: string[], move: QueueMove) => this.post(`torrents/${QUEUE_ACTIONS[move]}`, { hashes: many(hashes) })
  setForceStart = (hashes: string[], value: boolean) => this.post('torrents/setForceStart', { hashes: many(hashes), value })
  toggleSequentialDownload = (hashes: string[]) => this.post('torrents/toggleSequentialDownload', { hashes: many(hashes) })
  toggleFirstLastPiecePrio = (hashes: string[]) => this.post('torrents/toggleFirstLastPiecePrio', { hashes: many(hashes) })
  setSuperSeeding = (hashes: string[], value: boolean) => this.post('torrents/setSuperSeeding', { hashes: many(hashes), value })
  setAutoManagement = (hashes: string[], enable: boolean) => this.post('torrents/setAutoManagement', { hashes: many(hashes), enable })
  setLocation = (hashes: string[], location: string) => this.post('torrents/setLocation', { hashes: many(hashes), location })
  // A blank path stops keeping incomplete files in a separate folder.
  setDownloadPath = (hashes: string[], path: string) => this.post('torrents/setDownloadPath', { id: many(hashes), path })
  setComment = (hashes: string[], comment: string) => this.post('torrents/setComment', { hashes: many(hashes), comment })
  renameTorrent = (hash: string, name: string) => this.post('torrents/rename', { hash, name })
  // Limits are bytes per second. 0 or less removes the limit.
  setDownloadLimit = (hashes: string[], limit: number) => this.post('torrents/setDownloadLimit', { hashes: many(hashes), limit })
  setUploadLimit = (hashes: string[], limit: number) => this.post('torrents/setUploadLimit', { hashes: many(hashes), limit })

  // qBittorrent 5.2 rejects this unless every value is sent, the action included, and Web API
  // 2.15.3 also requires the limits mode. Older versions ignore the mode.
  setShareLimits = (hashes: string[], limits: ShareLimits) => this.post('torrents/setShareLimits', {
    hashes: many(hashes),
    ratioLimit: limits.ratioLimit,
    seedingTimeLimit: limits.seedingTimeLimit,
    inactiveSeedingTimeLimit: limits.inactiveSeedingTimeLimit,
    shareLimitAction: limits.shareLimitAction,
    shareLimitsMode: limits.shareLimitsMode ?? 'Default',
  })

  // --- One torrent's contents ---

  getTorrentFiles = (hash: string) => this.get<TorrentFile[]>('torrents/files', { hash })
  // `id` is one file index or several joined with |.
  setFilePriority = (hash: string, id: string, priority: number) => this.post('torrents/filePrio', { hash, id, priority })
  renameFile = (hash: string, oldPath: string, newPath: string) => this.post('torrents/renameFile', { hash, oldPath, newPath })
  renameFolder = (hash: string, oldPath: string, newPath: string) => this.post('torrents/renameFolder', { hash, oldPath, newPath })
  getPieceStates = (hash: string) => this.get<number[]>('torrents/pieceStates', { hash })
  // How many connected peers have each piece. -1 means unknown.
  getPieceAvailability = (hash: string) => this.get<number[]>('torrents/pieceAvailability', { hash })
  getSSLParameters = (hash: string) => this.get<{ ssl_certificate?: string; ssl_private_key?: string; ssl_dh_params?: string }>('torrents/SSLParameters', { hash })
  setSSLParameters = (hash: string, certificate: string, privateKey: string, dhParams: string) =>
    this.post('torrents/setSSLParameters', { hash, ssl_certificate: certificate, ssl_private_key: privateKey, ssl_dh_params: dhParams })

  // --- Trackers, peers, and web seeds ---

  getTorrentTrackers = (hash: string) => this.get<TorrentTracker[]>('torrents/trackers', { hash })
  // One URL per line. A blank line starts a new tier.
  addTrackers = (hash: string, urls: string) => this.post('torrents/addTrackers', { hash, urls })
  // qBittorrent 5.2 calls the old URL `url`, earlier versions `origUrl`, so both are sent.
  editTracker = (hash: string, url: string, newUrl: string) => this.post('torrents/editTracker', { hash, url, origUrl: url, newUrl })
  removeTrackers = (hash: string, urls: string[]) => this.post('torrents/removeTrackers', { hash, urls: encodeTrackerUrls(urls) })

  async getTorrentPeers(hash: string): Promise<TorrentPeers> {
    const data = await this.get<{ peers?: Record<string, TorrentPeer>; show_flags?: boolean }>('sync/torrentPeers', { hash, rid: 0 })
    return { peers: data?.peers ?? {}, showFlags: data?.show_flags !== false }
  }

  addPeers = (hashes: string[], peers: string[]) =>
    this.post<Record<string, { added: number; failed: number }>>('torrents/addPeers', { hashes: many(hashes), peers: many(peers) })

  getWebSeeds = (hash: string) => this.get<WebSeed[]>('torrents/webseeds', { hash })
  addWebSeeds = (hash: string, urls: string[]) => this.post('torrents/addWebSeeds', { hash, urls: many(urls) })
  editWebSeed = (hash: string, origUrl: string, newUrl: string) => this.post('torrents/editWebSeed', { hash, origUrl, newUrl })
  removeWebSeeds = (hash: string, urls: string[]) => this.post('torrents/removeWebSeeds', { hash, urls: many(urls) })

  // --- Categories and tags ---

  getCategories = () => this.get<Record<string, TorrentCategory>>('torrents/categories')
  createCategory = (category: string, savePath: string) => this.post('torrents/createCategory', { category, savePath })
  editCategory = (category: string, savePath: string) => this.post('torrents/editCategory', { category, savePath })
  removeCategories = (categories: string[]) => this.post('torrents/removeCategories', { categories: categories.join('\n') })
  setCategory = (hashes: string[], category: string) => this.post('torrents/setCategory', { hashes: many(hashes), category })
  getTags = () => this.get<string[]>('torrents/tags')
  createTags = (tags: string[]) => this.post('torrents/createTags', { tags: tags.join(',') })
  deleteTags = (tags: string[]) => this.post('torrents/deleteTags', { tags: tags.join(',') })
  addTags = (hashes: string[], tags: string[]) => this.post('torrents/addTags', { hashes: many(hashes), tags: tags.join(',') })
  removeTags = (hashes: string[], tags: string[]) => this.post('torrents/removeTags', { hashes: many(hashes), tags: tags.join(',') })

  // --- Torrent creator (qBittorrent 5.0 and newer) ---

  createTorrent = async (params: Record<string, string>) => (await this.post<{ taskID?: string }>('torrentcreator/addTask', params))?.taskID ?? ''
  getTorrentCreatorTasks = () => this.get<TorrentCreatorTask[]>('torrentcreator/status')
  deleteTorrentCreatorTask = (taskID: string) => this.post('torrentcreator/deleteTask', { taskID })

  // --- RSS ---

  // qBittorrent returns the whole feed tree, articles included, in one answer.
  private getRSSTree = () => this.get<RawRSSTree>('rss/items', { withData: true })

  async getRSSFeeds(): Promise<{ feeds: RSSFeed[]; folders: string[] }> {
    const tree = await this.getRSSTree()
    return { feeds: flattenRSSTree(tree).map(entry => entry.feed), folders: listRSSFolders(tree) }
  }

  async getRSSItems(feedUid: string): Promise<{ articles: RSSItem[] }> {
    const entry = flattenRSSTree(await this.getRSSTree()).find(({ feed }) => feed.uid === feedUid)
    return { articles: entry?.articles ?? [] }
  }

  // Folders use backslashes in qBittorrent. A new feed is named after its URL.
  addRSSFeed(url: string, folder = ''): Promise<void> {
    const name = url.replaceAll('\\', '/')
    return this.post('rss/addFeed', { url, path: folder ? `${folder}\\${name}` : name })
  }

  addRSSFolder = (path: string) => this.post('rss/addFolder', { path })
  removeRSSFeed = (path: string) => this.post('rss/removeItem', { path })
  // Moving an item within its own folder renames it.
  moveRSSItem = (itemPath: string, destPath: string) => this.post('rss/moveItem', { itemPath, destPath })
  refreshRSSItem = (itemPath: string) => this.post('rss/refreshItem', { itemPath })
  setRSSFeedURL = (path: string, url: string) => this.post('rss/setFeedURL', { path, url })
  // 0 uses qBittorrent's global refresh interval.
  setRSSFeedRefreshInterval = (path: string, seconds: number) => this.post('rss/setFeedRefreshInterval', { path, refreshInterval: seconds })
  // Without an article id, marks the whole feed or folder.
  markAsRead = (itemPath: string, articleId?: string) => this.post('rss/markAsRead', { itemPath, articleId })
  getRSSRules = () => this.get<Record<string, RSSRule>>('rss/rules')
  setRSSRule = (name: string, rule: RSSRule) => this.post('rss/setRule', { ruleName: name, ruleDef: JSON.stringify(rule) })
  renameRSSRule = (ruleName: string, newRuleName: string) => this.post('rss/renameRule', { ruleName, newRuleName })
  removeRSSRule = (name: string) => this.post('rss/removeRule', { ruleName: name })
  // The article titles each feed would download, by feed name.
  getRSSMatchingArticles = (ruleName: string) => this.get<Record<string, string[]>>('rss/matchingArticles', { ruleName })

  // --- Search ---

  startSearch = (pattern: string, plugins = 'enabled', category = 'all') => this.post<{ id: number }>('search/start', { pattern, plugins, category })
  stopSearch = (id: number) => this.post('search/stop', { id })
  deleteSearch = (id: number) => this.post('search/delete', { id })
  getSearchStatus = () => this.get<SearchJob[]>('search/status')
  getSearchResults = (id: number) => this.get<{ results: SearchResult[]; status: string }>('search/results', { id })
  // Lets the plugin download the .torrent itself, for sites that need its login.
  downloadSearchTorrent = (torrentUrl: string, pluginName: string) => this.post('search/downloadTorrent', { torrentUrl, pluginName })
  searchPlugins = () => this.get<SearchPlugin[]>('search/plugins')
  installSearchPlugin = (sources: string[]) => this.post('search/installPlugin', { sources: many(sources) })
  uninstallSearchPlugin = (names: string[]) => this.post('search/uninstallPlugin', { names: many(names) })
  enableSearchPlugin = (names: string[], enable: boolean) => this.post('search/enablePlugin', { names: many(names), enable })
  updateSearchPlugins = () => this.post('search/updatePlugins')

  // --- Logs ---

  getLogs = (levels: LogLevels, lastKnownId = -1) => this.get<LogEntry[]>('log/main', { ...levels, last_known_id: lastKnownId })
  // Warnings only, after the given entry. Search uses them to spot plugin errors.
  getLogWarnings = (lastKnownId = -1) => this.getLogs({ normal: false, info: false, warning: true, critical: false }, lastKnownId)
  getPeerLog = () => this.get<PeerLogEntry[]>('log/peers', { last_known_id: -1 })
}

// Everything the app calls. The demo implements the same thing without a server.
export type ApiClient = Omit<QbitClient, never>

export const qbitClient: ApiClient = __DEMO__ ? demoClient : new QbitClient()

