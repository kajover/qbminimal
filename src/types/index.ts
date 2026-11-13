// Shapes of the data qBittorrent's Web API returns. Field names are qBittorrent's own, so they
// stay in snake_case. Optional fields are ones older qBittorrent versions leave out.

// --- Torrents (torrents/info and sync/maindata) ---

export interface Torrent {
  // Identity
  hash: string
  name: string
  infohash_v1?: string
  infohash_v2?: string
  magnet_uri: string
  category: string
  // Comma separated, as qBittorrent sends them.
  tags: string
  tracker: string
  trackers_count: number
  private?: boolean
  has_metadata?: boolean
  comment?: string
  created_by?: string
  creation_date?: number

  // State and progress
  state: string
  // Web API 2.17.0 and newer: why the torrent is in the error state.
  error?: string
  progress: number
  size: number
  total_size: number
  amount_left: number
  completed: number
  availability?: number
  pieces_num?: number
  pieces_have?: number
  piece_size?: number
  seq_dl?: boolean
  f_l_piece_prio?: boolean
  super_seeding?: boolean
  force_start: boolean
  auto_tmm: boolean
  // Queue position, or 0 or less when not queued.
  priority: number

  // Transfer
  dlspeed: number
  upspeed: number
  dl_speed_avg?: number
  up_speed_avg?: number
  downloaded?: number
  uploaded: number
  downloaded_session?: number
  uploaded_session?: number
  total_downloaded?: number
  total_uploaded?: number
  total_wasted?: number
  ratio: number
  // Web API 2.11 and newer: ratio per month active, or -1 for infinite.
  popularity?: number
  eta: number
  num_seeds: number
  num_complete: number
  num_leechs: number
  num_incomplete: number
  connections_count?: number
  connections_limit?: number

  // Limits. -2 follows the global setting, -1 means none.
  dl_limit: number
  up_limit: number
  ratio_limit: number
  seeding_time_limit: number
  inactive_seeding_time_limit: number
  max_ratio?: number
  max_seeding_time?: number
  max_inactive_seeding_time?: number
  // qBittorrent 5.2 and newer.
  share_limit_action?: string
  // Web API 2.15.3 and newer: 'Default', 'MatchAny', or 'MatchAll'.
  share_limits_mode?: string

  // Times, in seconds since 1970 or as durations in seconds.
  added_on: number
  completion_on: number
  last_activity: number
  seen_complete?: number
  time_active: number
  seeding_time: number
  reannounce?: number

  // Locations
  save_path: string
  download_path: string
  content_path: string
}

export interface TorrentFile {
  index: number
  name: string
  size: number
  progress: number
  // 0 skips the file, 1 is normal, 6 high, 7 maximum.
  priority: number
  is_seed?: boolean
  piece_range?: [number, number]
}

export interface TorrentTracker {
  url: string
  // 0 disabled, 1 not contacted yet, 2 working, 3 updating, 4 not working.
  status: number
  tier: number | string
  num_peers: number
  num_seeds: number
  num_leeches?: number
  num_downloaded: number
  msg: string
}

export interface WebSeed {
  url: string
}

export interface TorrentPeer {
  ip?: string
  port?: number
  client?: string
  connection?: string
  progress?: number
  dl_speed?: number
  up_speed?: number
  downloaded?: number
  uploaded?: number
  relevance?: number
  // Letters for the connection's state, explained one per line in flags_desc.
  flags?: string
  flags_desc?: string
  host_name?: string
  // The client named by the peer ID, which can differ from the one the peer reports.
  peer_id_client?: string
  // The files the peer's pieces belong to, one per line.
  files?: string
  // Filled only when "Resolve peer countries" is on. The code is lower case, like "de".
  country?: string
  country_code?: string
}

export interface TorrentPeers {
  peers: Record<string, TorrentPeer>
  // Whether qBittorrent looks up peer countries.
  showFlags: boolean
}

export interface TorrentCategory {
  name: string
  savePath?: string
}

export interface TorrentCreatorTask {
  taskID: string
  sourcePath: string
  // 'Queued', 'Running', 'Finished', or 'Failed'.
  status: string
  progress?: number
  errorMessage?: string
  torrentFilePath?: string
  timeAdded?: string
}

// --- RSS ---

export interface RSSFeed {
  uid: string
  // Where the feed sits in qBittorrent's folder tree, like "Shows\\Daily".
  path: string
  url: string
  title: string
  unreadCount: number
  hasError: boolean
  isLoading?: boolean
  refreshInterval?: number
  lastBuildDate?: string
}

export interface RSSItem {
  id: string
  feedUID: string
  title: string
  url?: string
  torrentUrl?: string
  link?: string
  author?: string
  date?: string
  description?: string
  isRead: boolean
}

// qBittorrent stores more settings on a rule than the app edits, so unknown ones are kept as they are.
export interface RSSRule {
  enabled: boolean
  mustContain: string
  mustNotContain: string
  useRegex: boolean
  affectedFeeds: string[]
  assignedCategory: string
  savePath: string
  torrentParams?: { category?: string; save_path?: string; [key: string]: unknown }
  [key: string]: unknown
}

// --- Search ---

export interface SearchResult {
  fileName: string
  fileUrl: string
  fileSize: number
  nbSeeders: number
  nbLeechers: number
  siteUrl: string
  descrLink: string
  // The plugin that found it, from qBittorrent 4.4.
  engineName?: string
  // When the site published it, in seconds, from qBittorrent 5.0. -1 or 0 when unknown.
  pubDate?: number
}

// --- Logs ---

export interface LogEntry {
  id: number
  timestamp: number
  // 1 normal, 2 info, 4 warning, 8 critical.
  type: number
  message: string
}

export interface PeerLogEntry {
  id: number
  timestamp: number
  ip: string
  blocked: boolean
  reason: string
}

// --- Network ---

export interface Cookie {
  name: string
  domain: string
  path: string
  value: string
  // Seconds since 1970.
  expirationDate: number
}
