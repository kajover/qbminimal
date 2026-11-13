import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'
import { hasStatus, qbitClient, type LogLevels } from '@/lib/api'
import { supportsFeature, type ApiFeature } from '@/lib/apiVersion'
import { parseBannedPeers, removeBannedPeer } from '@/lib/bannedPeers'
import { findFinished } from '@/lib/finished'
import { applyMainDataUpdate, totalSpeeds, type MainData } from '@/lib/mainData'
import { finishNoticesOn, notifyInBackground } from '@/lib/notify'
import { PIECE_DONE } from '@/lib/pieces'
import { recordSpeeds, recordTorrentSpeeds } from '@/lib/speedHistory'
import type { RSSRule, Torrent } from '@/types'
import { t } from '@/i18n'

// React Query hooks over the API client. Every query only runs once signed in, because the app
// shows the login form instead of these pages until then.

const FAST = 2000
const NORMAL = 5000

function reportFailure(title: string, error: unknown) {
  toast.error(title, { description: error instanceof Error ? error.message : undefined })
}

// A change on the server, followed by refreshing whatever it affects. When it fails, `failed`
// (a title, or one picked from the change itself) is shown as a notification. Leave it out to
// handle errors where the change is made.
function useServerChange<Vars>(run: (vars: Vars) => Promise<unknown>, affects: QueryKey[], failed?: string | ((vars: Vars) => string)) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: () => Promise.all(affects.map(queryKey => queryClient.invalidateQueries({ queryKey }))),
    onError: failed ? (error, vars) => reportFailure(typeof failed === 'function' ? failed(vars) : failed, error) : undefined,
  })
}

interface Job {
  work: () => Promise<unknown>
  // The notification title if it fails.
  failed: string
}

// --- Application ---

export const usePreferences = () => useQuery({
  queryKey: ['preferences'],
  queryFn: () => qbitClient.getPreferences(),
  // Edits live outside the query, so a refresh never overwrites what's being typed.
  refetchOnWindowFocus: false,
})

export const useSavePreferences = () =>
  useServerChange((changes: Record<string, unknown>) => qbitClient.setPreferences(changes), [['preferences'], ['bannedPeers']], t('Failed to save settings'))

export const useAppVersion = () => useQuery({ queryKey: ['app', 'version'], queryFn: () => qbitClient.getAppVersion() })

export const useWebApiVersion = () => useQuery({ queryKey: ['app', 'webApiVersion'], queryFn: () => qbitClient.getWebApiVersion(), staleTime: Infinity })

// Whether the running qBittorrent has a newer Web API feature. False until its version is known.
export function useApiFeature(feature: ApiFeature): boolean {
  return supportsFeature(useWebApiVersion().data, feature)
}

// --- Live state from sync/maindata ---

const MAIN_DATA: QueryKey = ['torrents', 'maindata']

// A notification outside the page when it's in the background, a message on it otherwise.
function announceFinished(torrents: Torrent[]) {
  for (const torrent of torrents) {
    if (!notifyInBackground(t('Download finished'), torrent.name)) toast.success(t('Download finished'), { description: torrent.name })
  }
}

// One incremental request every two seconds feeds the torrent list, the speeds, and the status.
// Its key starts with 'torrents', so refreshing ['torrents'] after an action refreshes it too.
function useMainData<T>(select: (data: MainData) => T) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: MAIN_DATA,
    queryFn: async () => {
      const previous = queryClient.getQueryData<MainData>(MAIN_DATA) ?? null
      const next = applyMainDataUpdate(previous, await qbitClient.getMainData(previous?.rid ?? 0))
      const now = Date.now()
      recordSpeeds({ time: now, ...totalSpeeds(next.torrents) })
      recordTorrentSpeeds(now, next.torrents)
      if (finishNoticesOn()) announceFinished(findFinished(previous?.torrents, next.torrents))
      return next
    },
    select,
    refetchInterval: FAST,
  })
}

const pickTorrents = (data: MainData) => Object.values(data.torrents)
const pickServerState = (data: MainData) => data.serverState
const pickTrackers = (data: MainData) => data.trackers
const pickSpeeds = (data: MainData) => totalSpeeds(data.torrents)

export const useTorrents = () => useMainData(pickTorrents)
export const useTransferInfo = () => useMainData(pickServerState)
// Download and upload speed in all, added up from the torrents so it matches the list.
export const useTotalSpeeds = () => useMainData(pickSpeeds)

// True while the list's refreshes fail, apart from a signed-out session, which shows the login form.
export function useConnectionProblem() {
  const { isError, error } = useMainData(pickServerState)
  return isError && !hasStatus(error, 403)
}
export const useTrackerMap = () => useMainData(pickTrackers)

// --- One torrent ---

const perTorrent = <T>(hash: string, part: string, load: () => Promise<T>, refetchInterval: number | false = NORMAL) =>
  ({ queryKey: ['torrent', hash, part], queryFn: load, enabled: !!hash, refetchInterval })

export const useTorrentFiles = (hash: string) => useQuery(perTorrent(hash, 'files', () => qbitClient.getTorrentFiles(hash)))
export const useTorrentTrackers = (hash: string) => useQuery(perTorrent(hash, 'trackers', () => qbitClient.getTorrentTrackers(hash)))
export const useTorrentPeers = (hash: string) => useQuery(perTorrent(hash, 'peers', () => qbitClient.getTorrentPeers(hash)))
export const useWebSeeds = (hash: string) => useQuery(perTorrent(hash, 'webseeds', () => qbitClient.getWebSeeds(hash), false))

export const useTorrentAvailability = (hash: string, enabled: boolean) =>
  useQuery({ ...perTorrent(hash, 'availability', () => qbitClient.getPieceAvailability(hash)), enabled: enabled && !!hash })

// A finished torrent stops polling once every piece shows as done, and starts again after a recheck.
export const useTorrentPieces = (hash: string, torrentComplete: boolean) => useQuery({
  ...perTorrent(hash, 'pieces', () => qbitClient.getPieceStates(hash)),
  refetchInterval: (query) => (torrentComplete && query.state.data?.every(piece => piece === PIECE_DONE) ? false : NORMAL),
})

// Any torrent action. Afterwards the list, the open details, and the lists an action can change
// are refreshed.
export const useTorrentAction = () =>
  useServerChange(({ work }: Job) => work(), [['torrents'], ['torrent'], ['bannedPeers'], ['categories'], ['tags']], job => job.failed)

export const usePauseTorrents = () => useServerChange((hashes: string[]) => qbitClient.pauseTorrents(hashes), [['torrents']], t('Failed to pause'))
export const useResumeTorrents = () => useServerChange((hashes: string[]) => qbitClient.resumeTorrents(hashes), [['torrents']], t('Failed to resume'))
export const useDeleteTorrents = () =>
  useServerChange(({ hashes, deleteFiles }: { hashes: string[]; deleteFiles?: boolean }) => qbitClient.deleteTorrents(hashes, deleteFiles), [['torrents']], t('Failed to delete'))

export function useSetFilePriority() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ hash, id, priority }: { hash: string; id: string; priority: number }) => qbitClient.setFilePriority(hash, id, priority),
    onSuccess: (_result, { hash }) => queryClient.invalidateQueries({ queryKey: ['torrent', hash, 'files'] }),
  })
}

// --- Categories, tags, and banned peers ---

export const useCategories = () => useQuery({ queryKey: ['categories'], queryFn: () => qbitClient.getCategories() })
export const useTags = () => useQuery({ queryKey: ['tags'], queryFn: () => qbitClient.getTags() })

export const useBannedPeers = () => useQuery({
  queryKey: ['bannedPeers'],
  queryFn: () => qbitClient.getPreferences(),
  select: (prefs) => parseBannedPeers(prefs.banned_IPs),
})

// Reads the list fresh first, so a ban added elsewhere since the page loaded isn't undone.
export const useUnbanPeer = () => useServerChange(async (ip: string) => {
  const prefs = await qbitClient.getPreferences()
  await qbitClient.setPreferences({ banned_IPs: removeBannedPeer(prefs.banned_IPs, ip) })
}, [['bannedPeers']], t('Failed to unban peer'))

// --- Search ---

export const useSearchPlugins = (refetchInterval: number | false = false) =>
  useQuery({ queryKey: ['search', 'plugins'], queryFn: () => qbitClient.searchPlugins(), refetchInterval })

export const useSearchPluginAction = () => useServerChange(({ work }: Job) => work(), [['search', 'plugins']], job => job.failed)

// --- RSS ---

export const useRSSFeeds = () => useQuery({ queryKey: ['rss', 'feeds'], queryFn: () => qbitClient.getRSSFeeds() })
export const useRSSItems = (feedUid: string) =>
  useQuery({ queryKey: ['rss', 'items', feedUid], queryFn: () => qbitClient.getRSSItems(feedUid), enabled: !!feedUid })
export const useRSSRules = () => useQuery({ queryKey: ['rss', 'rules'], queryFn: () => qbitClient.getRSSRules() })
export const useSetRSSRule = () => useServerChange(({ name, rule }: { name: string; rule: RSSRule }) => qbitClient.setRSSRule(name, rule), [['rss', 'rules']])
export const useRemoveRSSRule = () => useServerChange((name: string) => qbitClient.removeRSSRule(name), [['rss', 'rules']])

// --- Logs ---

export const useLogs = (levels: LogLevels) =>
  useQuery({ queryKey: ['logs', 'main', levels], queryFn: () => qbitClient.getLogs(levels), refetchInterval: NORMAL })
export const usePeerLog = (enabled: boolean) =>
  useQuery({ queryKey: ['logs', 'peers'], queryFn: () => qbitClient.getPeerLog(), enabled, refetchInterval: NORMAL })
