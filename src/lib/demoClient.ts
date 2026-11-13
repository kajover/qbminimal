import type {
  Cookie,
  LogEntry,
  PeerLogEntry,
  RSSFeed,
  RSSItem,
  RSSRule,
  SearchResult,
  Torrent,
  TorrentCategory,
  TorrentCreatorTask,
  TorrentFile,
  TorrentPeers,
  TorrentTracker,
  WebSeed,
} from '@/types'
import type { ApiClient, LogLevels, QueueMove, SearchJob, SearchPlugin } from './api'
import { isApiAtLeast } from './apiVersion'
import type { MainDataUpdate } from './mainData'
import type { PrefDef } from './preferences'
import type { ShareLimits } from './shareLimits'

// A pretend qBittorrent that lives in memory, for trying the app without a server
// (npm run demo). Actions change its state, and speeds drift a little on every refresh.

const DEMO_WEB_API: string = import.meta.env.VITE_DEMO_WEB_API || '2.11.2'
const DEMO_SESSION_KEY = 'qbminimal.demoSession'
const NOW = Math.floor(Date.now() / 1000)
const GiB = 1024 ** 3
const MiB = 1024 ** 2

interface DemoTorrent {
  name: string
  size: number
  progress: number
  // Bytes per second while running.
  down: number
  up: number
  category: string
  tags: string
  tracker: string
  addedDaysAgo: number
  ratio: number
  stopped?: boolean
}

const SEED: DemoTorrent[] = [
  { name: 'debian-13.1.0-amd64-netinst.iso', size: 754 * MiB, progress: 1, down: 0, up: 412_000, category: 'Linux', tags: 'iso, stable', tracker: 'http://bttracker.debian.org:6969/announce', addedDaysAgo: 12, ratio: 3.41 },
  { name: 'Fedora-Workstation-Live-43.iso', size: 2.3 * GiB, progress: 0.62, down: 2_400_000, up: 180_000, category: 'Linux', tags: 'iso', tracker: 'http://torrent.fedoraproject.org:6969/announce', addedDaysAgo: 0.2, ratio: 0.18 },
  { name: 'Sintel.2010.1080p.mkv', size: 1.1 * GiB, progress: 0.27, down: 1_150_000, up: 64_000, category: 'Movies', tags: 'open-movie', tracker: 'udp://tracker.opentrackr.org:1337/announce', addedDaysAgo: 1, ratio: 0.05 },
  { name: 'ubuntu-25.10-desktop-amd64.iso', size: 5.7 * GiB, progress: 1, down: 0, up: 0, category: 'Linux', tags: 'iso', tracker: 'https://torrent.ubuntu.com/announce', addedDaysAgo: 30, ratio: 1.12, stopped: true },
  { name: 'archlinux-2026.11.01-x86_64.iso', size: 1.4 * GiB, progress: 1, down: 0, up: 890_000, category: 'Linux', tags: '', tracker: 'udp://tracker.archlinux.org:6969/announce', addedDaysAgo: 5, ratio: 7.9 },
  { name: 'Big Buck Bunny (2008) [4K]', size: 680 * MiB, progress: 0, down: 0, up: 0, category: 'Movies', tags: 'open-movie', tracker: 'udp://tracker.opentrackr.org:1337/announce', addedDaysAgo: 0.01, ratio: 0, stopped: true },
]

// The seed torrents, repeated with numbered names when the address asks for more
// (?torrents=40), for trying long lists.
function demoTorrents(): DemoTorrent[] {
  const wanted = Number(new URLSearchParams(globalThis.location?.search ?? '').get('torrents'))
  const count = Number.isFinite(wanted) && wanted > SEED.length ? Math.min(wanted, 2000) : SEED.length
  return Array.from({ length: count }, (_, i) => {
    const seed = SEED[i % SEED.length]
    const copy = Math.floor(i / SEED.length)
    return { ...seed, name: copy ? `${seed.name} (${copy + 1})` : seed.name }
  })
}

// A stable fake hash per name, so the same torrent keeps its hash between refreshes.
function fakeHash(name: string): string {
  let h = 0x811c9dc5
  let out = ''
  for (let round = 0; out.length < 40; round++) {
    for (const ch of `${round}${name}`) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193)
    out += (h >>> 0).toString(16).padStart(8, '0')
  }
  return out.slice(0, 40)
}

function toTorrent(t: DemoTorrent, jitter: number, queuePosition: number): Torrent {
  const done = t.progress >= 1
  const running = !t.stopped
  const dlspeed = running && !done ? Math.round(t.down * jitter) : 0
  const upspeed = running ? Math.round(t.up * (2 - jitter)) : 0
  const left = Math.round(t.size * (1 - t.progress))
  const state = !running ? (done ? 'stoppedUP' : 'stoppedDL') : done ? (upspeed > 0 ? 'uploading' : 'stalledUP') : dlspeed > 0 ? 'downloading' : 'stalledDL'
  const added = Math.round(NOW - t.addedDaysAgo * 86400)
  const downloaded = Math.round(t.size * t.progress)
  return {
    hash: fakeHash(t.name), name: t.name, magnet_uri: `magnet:?xt=urn:btih:${fakeHash(t.name)}`,
    category: t.category, tags: t.tags, tracker: t.tracker, trackers_count: 1, private: false, has_metadata: true,
    comment: '', created_by: 'mktorrent 1.1', creation_date: added - 86400,
    state, progress: t.progress, size: t.size, total_size: t.size, amount_left: left, completed: downloaded,
    availability: done ? -1 : 1 + t.progress, pieces_num: 480, pieces_have: Math.round(480 * t.progress), piece_size: Math.ceil(t.size / 480),
    seq_dl: false, f_l_piece_prio: false, super_seeding: false, force_start: false, auto_tmm: false, priority: done ? 0 : queuePosition, popularity: Math.round(t.ratio / Math.max(t.addedDaysAgo / 30, 1) * 100) / 100,
    dlspeed, upspeed, downloaded, uploaded: Math.round(downloaded * t.ratio), total_downloaded: downloaded, total_uploaded: Math.round(downloaded * t.ratio), total_wasted: 0,
    ratio: t.ratio, eta: dlspeed > 0 ? Math.round(left / dlspeed) : 8640000,
    num_seeds: running ? 12 : 0, num_complete: 140, num_leechs: running ? 3 : 0, num_incomplete: 22, connections_count: running ? 15 : 0, connections_limit: 100,
    dl_limit: 0, up_limit: 0, ratio_limit: -2, seeding_time_limit: -2, inactive_seeding_time_limit: -2, share_limit_action: 'Default', share_limits_mode: 'Default',
    added_on: added, completion_on: done ? added + 3600 : 0, last_activity: running ? NOW : added, time_active: Math.round(t.addedDaysAgo * 86400), seeding_time: done ? Math.round(t.addedDaysAgo * 80000) : 0, reannounce: 1200,
    save_path: `/downloads/${t.category.toLowerCase()}`, download_path: '', content_path: `/downloads/${t.category.toLowerCase()}/${t.name}`,
  }
}

const VERSION_5_3_PREFS = new Set(['torrent_files_backup_enabled', 'torrent_files_backup_dir', 'torrent_files_finished_backup_dir_enabled', 'torrent_files_finished_backup_dir', 'remove_torrent_file_backup', 'mail_notification_encryption_type', 'web_ui_sessions_count_limit', 'i2p_pex_enabled', 'i2p_inbound_length_variance', 'i2p_outbound_length_variance', 'confirm_remove_all_tags', 'confirm_remove_tracker_from_all_torrents', 'enable_multi_connections_from_same_peer_id', 'seeding_outgoing_connections', 'max_outstanding_block_requests', 'webtorrent_stun_server', 'store_search_jobs', 'store_search_job_results'])
const DROPPED_IN_5_3 = new Set(['export_dir', 'export_dir_fin', 'mail_notification_ssl_enabled'])

// A plain value for each preference the demo's version would report. The list loads only when
// Settings asks, so it stays out of the app's first download.
async function samplePreferences(): Promise<Record<string, unknown>> {
  const { ALL_PREFS } = await import('./preferences')
  const newer = isApiAtLeast(DEMO_WEB_API, [2, 16, 0])
  const sample = (def: PrefDef): unknown =>
    def.type === 'bool' ? false : def.type === 'int' || def.type === 'number' ? 0 : def.type === 'select' ? def.options?.[0]?.value ?? '' : ''
  const prefs: Record<string, unknown> = {}
  for (const def of ALL_PREFS) {
    if (def.type === 'custom' || (newer ? DROPPED_IN_5_3 : VERSION_5_3_PREFS).has(def.key)) continue
    prefs[def.key] = sample(def)
  }
  return { ...prefs, save_path: '/downloads', locale: 'en', web_ui_username: 'demo', resolve_peer_countries: true }
}

const FEEDS: { feed: RSSFeed; articles: RSSItem[] }[] = [
  { name: 'Distro releases', url: 'https://example.org/distros.xml' },
  { name: 'Open movies', url: 'https://example.org/movies.xml' },
].map(({ name, url }, index) => {
  const uid = `{demo-feed-${index}}`
  const articles: RSSItem[] = Array.from({ length: 4 }, (_, n) => ({
    id: `${uid}-${n}`, feedUID: uid, title: `${name}: item ${n + 1}`, torrentUrl: `https://example.org/${index}/${n}.torrent`,
    date: new Date((NOW - n * 86400) * 1000).toUTCString(), isRead: n > 1,
  }))
  return { feed: { uid, path: name, url, title: name, unreadCount: articles.filter(a => !a.isRead).length, hasError: false }, articles }
})

const SEARCH_HITS: SearchResult[] = SEED.map((t, i) => ({
  fileName: t.name, fileUrl: `https://example.org/download/${i}.torrent`, fileSize: t.size,
  nbSeeders: 200 - i * 30, nbLeechers: 10 + i, siteUrl: i % 2 ? 'https://example.org' : 'https://example.net', descrLink: `https://example.org/view/${i}`,
  engineName: i % 2 ? 'demo' : 'sample', pubDate: NOW - (i + 1) * 86_400,
}))

class DemoClient implements ApiClient {
  private torrents = demoTorrents()
  private prefs: Record<string, unknown> | null = null
  private banned: string[] = []
  private cookies: Cookie[] = []
  private altSpeed = false
  private limits = { down: 0, up: 0 }
  private sessionPaused = false
  private searches: { id: number; endsAt: number }[] = []
  private rules: Record<string, RSSRule> = {}
  private creatorTasks: TorrentCreatorTask[] = []
  private plugins: SearchPlugin[] = [
    { name: 'demo', fullName: 'Demo search', version: '1.0', enabled: true },
    { name: 'archive', fullName: 'Internet Archive', version: '2.3', enabled: false },
  ]
  private rid = 0

  private find = (hash: string) => this.torrents.find(t => fakeHash(t.name) === hash)
  private each(hashes: string[], change: (t: DemoTorrent) => void) {
    for (const hash of hashes) {
      const t = this.find(hash)
      if (t) change(t)
    }
  }

  onUnauthorized(): void {}
  // Signing in lasts for the browser session, so a reload keeps the demo open; ?signedin in the
  // address skips the form, for trying it on a device.
  async checkSession() {
    if (new URLSearchParams(globalThis.location?.search ?? '').has('signedin')) return true
    try { return sessionStorage.getItem(DEMO_SESSION_KEY) === '1' } catch { return false }
  }
  async login() {
    try { sessionStorage.setItem(DEMO_SESSION_KEY, '1') } catch { /* private mode: sign in each time */ }
    return true
  }
  async logout() {
    try { sessionStorage.removeItem(DEMO_SESSION_KEY) } catch { /* nothing kept */ }
  }

  async getAppVersion() { return isApiAtLeast(DEMO_WEB_API, [2, 16, 0]) ? 'v5.3.0' : 'v5.2.3' }
  async getWebApiVersion() { return DEMO_WEB_API }
  async getBuildInfo() { return { qt: '6.8.2', libtorrent: '2.0.11.0', boost: '1.86.0', openssl: '3.4.1', zlib: '1.3.1', bitness: 64, platform: 'linux' } }
  async getProcessInfo() { return { launch_time: NOW - 26 * 3600 } }
  async shutdown() {}

  async getPreferences() {
    this.prefs ??= await samplePreferences()
    return { ...this.prefs, banned_IPs: this.banned.join('\n') }
  }

  async setPreferences(changes: Record<string, unknown>) {
    this.prefs = { ...(this.prefs ?? await samplePreferences()), ...changes }
    if (typeof changes.banned_IPs === 'string') this.banned = changes.banned_IPs.split('\n').filter(Boolean)
  }

  async getDirectoryContent(dirPath: string) {
    const base = dirPath.replace(/\/+$/, '')
    return ['downloads', 'media', 'backups'].map(name => `${base}/${name}`)
  }

  async getFreeSpaceAtPath() { return 512 * GiB }
  async getCookies() { return this.cookies }
  async setCookies(cookies: Cookie[]) { this.cookies = cookies }
  async rotateApiKey() { return `qbt_${fakeHash(String(Date.now())).slice(0, 32)}` }
  async deleteApiKey() {}
  async getNetworkInterfaces() { return [{ name: 'eth0', value: 'eth0' }] }
  async getInterfaceAddresses() { return ['192.0.2.10'] }
  async sendTestEmail() {}

  async getMainData(): Promise<MainDataUpdate> {
    this.rid++
    // Speeds wobble by up to 15% either way.
    const jitter = 0.85 + Math.random() * 0.3
    const unfinished = this.torrents.filter(t => t.progress < 1)
    const list = this.torrents.map(t => toTorrent(t, this.sessionPaused ? 0 : jitter, unfinished.indexOf(t) + 1))
    const trackers: Record<string, string[]> = {}
    for (const t of list) (trackers[t.tracker] ??= []).push(t.hash)
    const dl = list.reduce((sum, t) => sum + t.dlspeed, 0)
    const ul = list.reduce((sum, t) => sum + t.upspeed, 0)
    return {
      rid: this.rid,
      full_update: true,
      torrents: Object.fromEntries(list.map(t => [t.hash, t])),
      trackers,
      server_state: {
        connection_status: 'connected', dht_nodes: 312, dl_info_speed: dl, up_info_speed: ul,
        dl_info_data: 146 * GiB, up_info_data: 83 * GiB, dl_rate_limit: this.limits.down, up_rate_limit: this.limits.up,
        free_space_on_disk: 512 * GiB, alltime_dl: 4.1 * 1024 * GiB, alltime_ul: 8.6 * 1024 * GiB, global_ratio: '2.10',
        total_peer_connections: 46, use_alt_speed_limits: this.altSpeed, session_state: this.sessionPaused,
        last_external_address_v4: '203.0.113.7',
      },
    }
  }

  async toggleSpeedLimitsMode() { this.altSpeed = !this.altSpeed }
  async setGlobalDownloadLimit(limit: number) { this.limits.down = Math.max(limit, 0) }
  async setGlobalUploadLimit(limit: number) { this.limits.up = Math.max(limit, 0) }
  async pauseSession() { this.sessionPaused = true }
  async resumeSession() { this.sessionPaused = false }
  async banPeers(peers: string[]) { this.banned = [...new Set([...this.banned, ...peers.map(p => p.replace(/:\d+$/, '').replace(/^\[|\]$/g, ''))])] }

  async addTorrents(params: Record<string, string>, files: File[]) {
    const names = [...(params.urls ?? '').split('\n').filter(Boolean).map(url => url.split('/').pop() || url), ...files.map(f => f.name.replace(/\.torrent$/, ''))]
    for (const name of names) {
      if (!this.torrents.some(t => t.name === name)) {
        this.torrents.push({ name, size: 900 * MiB, progress: 0, down: 1_800_000, up: 20_000, category: params.category ?? '', tags: params.tags ?? '', tracker: 'udp://tracker.opentrackr.org:1337/announce', addedDaysAgo: 0, ratio: 0, stopped: params.stopped === 'true' })
      }
    }
    return { success_count: Math.max(names.length, 1), failure_count: 0, pending_count: 0 }
  }

  async addTorrentUrl(url: string, options: { category?: string } = {}) {
    return this.addTorrents({ urls: url, category: options.category ?? '' }, [])
  }

  async parseMetadata(files: File[]) {
    return files.map(file => ({ hash: fakeHash(file.name), info: { name: file.name.replace(/\.torrent$/, ''), length: 2 * MiB, files: [{ path: 'Demo/video.mkv', length: 1.5 * MiB }, { path: 'Demo/readme.txt', length: 0.5 * MiB }] } }))
  }

  // Like a magnet link finding peers: only the hash for the first ~2 seconds, then the file list.
  private metadataAsked = new Map<string, number>()
  async fetchMetadata(source: string) {
    const first = this.metadataAsked.get(source) ?? Date.now()
    this.metadataAsked.set(source, first)
    if (Date.now() - first < 2000) return { hash: fakeHash(source) }
    return {
      hash: fakeHash(source),
      info: {
        name: 'Big.Buck.Bunny.and.Friends.Complete.Collection.2008-2024.2160p.UHD.BluRay.REMUX.HDR10.HEVC.DTS-HD.MA.5.1',
        length: 9 * MiB,
        files: [
          { path: 'Big.Buck.Bunny.and.Friends.Complete.Collection.2008-2024.2160p.UHD.BluRay.REMUX.HDR10.HEVC.DTS-HD.MA.5.1/Season 01/Big.Buck.Bunny.and.Friends.S01E01.The.Very.First.Morning.In.The.Meadow.2160p.UHD.BluRay.REMUX.mkv', length: 4 * MiB },
          { path: 'Big.Buck.Bunny.and.Friends.Complete.Collection.2008-2024.2160p.UHD.BluRay.REMUX.HDR10.HEVC.DTS-HD.MA.5.1/Season 01/Big.Buck.Bunny.and.Friends.S01E02.A.Squirrel.Named.Frank.2160p.UHD.BluRay.REMUX.mkv', length: 3 * MiB },
          { path: 'Big.Buck.Bunny.and.Friends.Complete.Collection.2008-2024.2160p.UHD.BluRay.REMUX.HDR10.HEVC.DTS-HD.MA.5.1/Subtitles/English (SDH)/Big.Buck.Bunny.and.Friends.S01E01.en.sdh.forced.srt', length: 0.5 * MiB },
          { path: 'Big.Buck.Bunny.and.Friends.Complete.Collection.2008-2024.2160p.UHD.BluRay.REMUX.HDR10.HEVC.DTS-HD.MA.5.1/Subtitles/English (SDH)/Big.Buck.Bunny.and.Friends.S01E02.en.sdh.forced.srt', length: 0.5 * MiB },
          { path: 'Big.Buck.Bunny.and.Friends.Complete.Collection.2008-2024.2160p.UHD.BluRay.REMUX.HDR10.HEVC.DTS-HD.MA.5.1/readme.txt', length: 1 * MiB },
        ],
      },
    }
  }

  async pauseTorrents(hashes: string[]) { this.each(hashes, t => { t.stopped = true }) }
  async resumeTorrents(hashes: string[]) { this.each(hashes, t => { t.stopped = false }) }
  async deleteTorrents(hashes: string[]) { this.torrents = this.torrents.filter(t => !hashes.includes(fakeHash(t.name))) }
  async recheckTorrents() {}
  async reannounceTorrents() {}
  // The queue is the unfinished torrents in list order; moving them reorders those places only.
  async moveInQueue(hashes: string[], move: QueueMove) {
    const slots = this.torrents.flatMap((t, i) => (t.progress < 1 ? [i] : []))
    const queue = slots.map(i => this.torrents[i])
    const picked = (t: DemoTorrent) => hashes.includes(fakeHash(t.name))
    if (move === 'top' || move === 'bottom') {
      const moving = queue.filter(picked)
      const rest = queue.filter(t => !picked(t))
      queue.splice(0, queue.length, ...(move === 'top' ? [...moving, ...rest] : [...rest, ...moving]))
    } else if (move === 'up') {
      for (let i = 1; i < queue.length; i++) if (picked(queue[i]) && !picked(queue[i - 1])) [queue[i - 1], queue[i]] = [queue[i], queue[i - 1]]
    } else {
      for (let i = queue.length - 2; i >= 0; i--) if (picked(queue[i]) && !picked(queue[i + 1])) [queue[i], queue[i + 1]] = [queue[i + 1], queue[i]]
    }
    slots.forEach((slot, i) => { this.torrents[slot] = queue[i] })
  }
  async setForceStart(hashes: string[], value: boolean) { if (value) this.each(hashes, t => { t.stopped = false }) }
  async toggleSequentialDownload() {}
  async toggleFirstLastPiecePrio() {}
  async setSuperSeeding() {}
  async setAutoManagement() {}
  async setLocation() {}
  async setDownloadPath() {}
  async setComment() {}
  async renameTorrent(hash: string, name: string) { this.each([hash], t => { t.name = name }) }
  async setDownloadLimit() {}
  async setUploadLimit() {}
  async setShareLimits(_hashes: string[], _limits: ShareLimits) {}

  async getTorrentFiles(hash: string): Promise<TorrentFile[]> {
    const t = this.find(hash)
    if (!t) return []
    return [
      { index: 0, name: `${t.name}/${t.name}`, size: t.size * 0.98, progress: t.progress, priority: 1 },
      { index: 1, name: `${t.name}/SHA256SUMS`, size: 1024, progress: 1, priority: 1 },
      { index: 2, name: `${t.name}/extras/notes.txt`, size: t.size * 0.02, progress: t.progress, priority: 0 },
    ]
  }

  async setFilePriority() {}
  async renameFile() {}
  async renameFolder() {}

  async getPieceStates(hash: string) {
    const progress = this.find(hash)?.progress ?? 0
    return Array.from({ length: 480 }, (_, i) => (i / 480 < progress ? 2 : progress > 0 && i / 480 < progress + 0.02 ? 1 : 0))
  }

  async getPieceAvailability(hash: string) {
    return (await this.getPieceStates(hash)).map((_, i) => (i % 97 === 0 ? 0 : 1 + (i % 4)))
  }

  async getSSLParameters() { return { ssl_certificate: '', ssl_private_key: '', ssl_dh_params: '' } }
  async setSSLParameters() {}

  async getTorrentTrackers(hash: string): Promise<TorrentTracker[]> {
    const url = this.find(hash)?.tracker ?? ''
    return [
      { url: '** [DHT] **', status: 2, tier: '', num_peers: 40, num_seeds: 30, num_leeches: 10, num_downloaded: 0, msg: '' },
      { url, status: 2, tier: 0, num_peers: 160, num_seeds: 140, num_leeches: 20, num_downloaded: 900, msg: '' },
    ]
  }

  async addTrackers() {}
  async editTracker() {}
  async removeTrackers() {}

  async getTorrentPeers(): Promise<TorrentPeers> {
    return {
      peers: {
        '203.0.113.5:51413': {
          ip: '203.0.113.5', port: 51413, client: 'qBittorrent 5.1.2', peer_id_client: 'qBittorrent 5.1.2', country: 'Germany', country_code: 'de',
          progress: 1, dl_speed: 0, up_speed: 120_000, downloaded: 0, uploaded: 84_000_000, relevance: 0, connection: 'BT',
          flags: 'u I H X E', flags_desc: 'u = Peer is interested and you are choked\nI = Incoming connection\nH = Peer from DHT\nX = Peer from PEX\nE = Encrypted traffic',
          files: 'archlinux-2026.11.01-x86_64.iso',
        },
        '198.51.100.20:6881': {
          ip: '198.51.100.20', port: 6881, client: 'Transmission 4.0.6', peer_id_client: 'Transmission 4.0.6', country: 'Canada', country_code: 'ca',
          progress: 0.42, dl_speed: 80_000, up_speed: 0, downloaded: 31_000_000, uploaded: 0, relevance: 0.58, connection: 'μTP',
          flags: 'D P', flags_desc: 'D = Downloading from the peer\nP = µTP connection',
          files: 'Sintel.2010.1080p.mkv\nSintel.2010.1080p.srt',
        },
      },
      showFlags: true,
    }
  }

  async addPeers(hashes: string[], peers: string[]) {
    return Object.fromEntries(hashes.map(hash => [hash, { added: peers.length, failed: 0 }]))
  }

  async getWebSeeds(): Promise<WebSeed[]> { return [] }
  async addWebSeeds() {}
  async editWebSeed() {}
  async removeWebSeeds() {}

  async getCategories(): Promise<Record<string, TorrentCategory>> {
    const names = [...new Set(this.torrents.map(t => t.category).filter(Boolean))]
    return Object.fromEntries(names.map(name => [name, { name, savePath: `/downloads/${name.toLowerCase()}` }]))
  }

  async createCategory() {}
  async editCategory() {}
  async removeCategories() {}
  async setCategory(hashes: string[], category: string) { this.each(hashes, t => { t.category = category }) }
  async getTags() { return [...new Set(this.torrents.flatMap(t => t.tags.split(',').map(tag => tag.trim()).filter(Boolean)))] }
  async createTags() {}
  async deleteTags() {}
  async addTags() {}
  async removeTags() {}

  async createTorrent(params: Record<string, string>) {
    const taskID = `demo-${this.creatorTasks.length + 1}`
    this.creatorTasks.push({ taskID, sourcePath: params.sourcePath ?? '', status: 'Finished', progress: 100, timeAdded: new Date().toISOString() })
    return taskID
  }

  async getTorrentCreatorTasks() { return this.creatorTasks }
  async deleteTorrentCreatorTask(taskID: string) { this.creatorTasks = this.creatorTasks.filter(task => task.taskID !== taskID) }

  async getRSSFeeds() { return { feeds: FEEDS.map(f => f.feed), folders: [] } }
  async getRSSItems(feedUid: string) { return { articles: FEEDS.find(f => f.feed.uid === feedUid)?.articles ?? [] } }
  async addRSSFeed() {}
  async addRSSFolder() {}
  async removeRSSFeed() {}
  async moveRSSItem() {}
  async refreshRSSItem() {}
  async setRSSFeedURL() {}
  async setRSSFeedRefreshInterval() {}
  async markAsRead() {}
  async getRSSRules() { return { ...this.rules } }
  async setRSSRule(name: string, rule: RSSRule) { this.rules = { ...this.rules, [name]: rule } }

  async renameRSSRule(ruleName: string, newRuleName: string) {
    const { [ruleName]: rule, ...rest } = this.rules
    this.rules = rule ? { ...rest, [newRuleName]: rule } : rest
  }

  async removeRSSRule(name: string) {
    const { [name]: _removed, ...rest } = this.rules
    this.rules = rest
  }

  async getRSSMatchingArticles() { return { 'Distro releases': ['Distro releases: item 1'] } }

  // Each search runs for a few seconds, so the spinner and stop button can be seen.
  async startSearch() {
    const id = (this.searches.at(-1)?.id ?? 0) + 1
    this.searches = [...this.searches, { id, endsAt: Date.now() + 4000 }]
    return { id }
  }
  async stopSearch(id: number) { this.searches = this.searches.map(s => (s.id === id ? { ...s, endsAt: Math.min(s.endsAt, Date.now()) } : s)) }
  async deleteSearch(id: number) { this.searches = this.searches.filter(s => s.id !== id) }
  async getSearchStatus(): Promise<SearchJob[]> {
    return this.searches.map(s => ({ id: s.id, status: Date.now() < s.endsAt ? 'Running' : 'Stopped', total: SEARCH_HITS.length }))
  }
  async getSearchResults(id: number) {
    const search = this.searches.find(s => s.id === id)
    return { results: SEARCH_HITS, status: search && Date.now() < search.endsAt ? 'Running' : 'Stopped' }
  }
  async downloadSearchTorrent() {}
  async searchPlugins() { return this.plugins }
  async installSearchPlugin() {}
  async uninstallSearchPlugin(names: string[]) { this.plugins = this.plugins.filter(p => !names.includes(p.name)) }
  async enableSearchPlugin(names: string[], enable: boolean) { this.plugins = this.plugins.map(p => (names.includes(p.name) ? { ...p, enabled: enable } : p)) }
  async updateSearchPlugins() {}

  async getLogs(levels: LogLevels): Promise<LogEntry[]> {
    const all: LogEntry[] = [
      { id: 0, timestamp: NOW - 26 * 3600, type: 1, message: 'qBittorrent v5.2.3 started' },
      { id: 1, timestamp: NOW - 26 * 3600 + 2, type: 2, message: 'Successfully listening on IP. IP: "0.0.0.0". Port: "TCP/51413"' },
      { id: 2, timestamp: NOW - 600, type: 4, message: 'Tracker is not reachable, retrying later' },
    ]
    const wanted = { 1: levels.normal, 2: levels.info, 4: levels.warning, 8: levels.critical } as Record<number, boolean>
    return all.filter(entry => wanted[entry.type])
  }

  async getLogWarnings() { return [] }
  async getPeerLog(): Promise<PeerLogEntry[]> { return this.banned.map((ip, id) => ({ id, timestamp: NOW, ip, blocked: true, reason: 'banned' })) }
}

export const demoClient = /* @__PURE__ */ new DemoClient()
