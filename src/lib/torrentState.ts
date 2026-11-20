import { t } from '@/i18n'
// How a torrent's state reads and looks in the list.

// qBittorrent 5 says 'stopped' where 4.x said 'paused'.
export const isStoppedState = (state: string): boolean => /^(paused|stopped)/.test(state)

type Tone = 'blue' | 'green' | 'yellow' | 'red' | 'muted'

function stateTone(state: string, completedOn: number): Tone {
  if (isStoppedState(state) && completedOn > 0) return 'green'
  if (state === 'downloading' || state === 'forcedDL' || state === 'metaDL' || state === 'forcedMetaDL') return 'blue'
  if (state === 'uploading' || state === 'forcedUP' || state === 'checkingUP' || state === 'completed' || state === 'seeding') return 'green'
  if (isStoppedState(state)) return 'yellow'
  if (state === 'error' || state === 'missingFiles') return 'red'
  return 'muted'
}

// Each color is marked "tint", so the Monochrome choice under Settings > App can make it plain
// (see index.css): "tint-fill" for a filled badge, "tint-ring" for an outlined one.
const TEXT: Record<Tone, string> = {
  blue: 'tint text-blue-500',
  green: 'tint text-green-500',
  yellow: 'tint text-yellow-500',
  red: 'tint text-red-500',
  muted: 'tint text-muted-foreground',
}

const BADGE: Record<Tone, string> = {
  blue: 'tint tint-fill bg-blue-500/15 text-blue-600 dark:text-blue-400',
  green: 'tint tint-fill bg-green-500/15 text-green-700 dark:text-green-400',
  yellow: 'tint tint-fill bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
  red: 'tint tint-fill bg-red-500/15 text-red-600 dark:text-red-400',
  muted: 'tint tint-fill bg-muted text-muted-foreground',
}

export const getStateColor = (state: string, completedOn: number): string => TEXT[stateTone(state, completedOn)]
// As in qui, only the usual moving, waiting and failed states are filled: downloading, seeding,
// stalled, queued and errors. The rest, such as forced, checking, moving and stopped (completed too),
// are only outlined in their color.
const FILLED_STATES = new Set(['downloading', 'uploading', 'stalledDL', 'stalledUP', 'queuedDL', 'queuedUP', 'error', 'missingFiles'])

const OUTLINE: Record<Tone, string> = {
  blue: 'tint tint-ring text-blue-600 ring-1 ring-blue-500/60 ring-inset dark:text-blue-400',
  green: 'tint tint-ring text-green-700 ring-1 ring-green-600/70 ring-inset dark:text-green-400 dark:ring-green-500/70',
  yellow: 'tint tint-ring text-yellow-700 ring-1 ring-yellow-500/70 ring-inset dark:text-yellow-400',
  red: 'tint tint-ring text-red-600 ring-1 ring-red-500/60 ring-inset dark:text-red-400',
  muted: 'tint tint-ring text-muted-foreground ring-1 ring-border ring-inset',
}

export const getStateBadge = (state: string, completedOn: number): string =>
  (FILLED_STATES.has(state) ? BADGE : OUTLINE)[stateTone(state, completedOn)]

const LABELS: Record<string, string> = {
  downloading: 'Downloading',
  pausedDL: 'Paused',
  pausedUP: 'Paused',
  stoppedDL: 'Stopped',
  stoppedUP: 'Stopped',
  uploading: 'Seeding',
  completed: 'Completed',
  seeding: 'Seeding',
  stalledDL: 'Stalled',
  stalledUP: 'Stalled',
  checkingUP: 'Checking',
  checkingDL: 'Checking',
  error: 'Error',
  forcedDL: 'Forced DL',
  forcedUP: 'Forced UP',
  forcedMetaDL: 'Meta DL',
  metaDL: 'Meta DL',
  allocating: 'Allocating',
  checkingResumeData: 'Checking',
  moving: 'Moving',
  missingFiles: 'Missing Files',
  queuedDL: 'Queued',
  queuedUP: 'Queued',
}

export function getStateLabel(state: string, completedOn: number): string {
  if (isStoppedState(state) && completedOn > 0) return t('Completed')
  return LABELS[state] ? t(LABELS[state]) : state
}

const NEVER = 8640000
const ETA_UNITS: [seconds: number, suffix: string][] = [[86400, 'd'], [3600, 'h'], [60, 'm'], [1, 's']]

// The largest whole unit only, like "3h", to keep table cells short. qBittorrent reports 100
// days (8640000 seconds) or more when a torrent won't finish, shown as ∞.
export function formatEta(seconds: number): string {
  if (!(seconds >= 0 && seconds < NEVER)) return '∞'
  const [size, suffix] = ETA_UNITS.find(([unit]) => seconds >= unit) ?? [1, 's']
  return `${Math.floor(seconds / size)}${suffix}`
}

// Download green and upload blue, in the list, the cards and the header alike.
export const DOWN_SPEED_COLOR = 'tint text-green-600 dark:text-green-500'
export const UP_SPEED_COLOR = 'tint text-blue-600 dark:text-blue-400'


// Seeds or peers as "connected (in the swarm)", the way qBittorrent shows them.
export const peerPair = (connected: number, total: number) => `${Math.max(connected, 0)} (${Math.max(total, 0)})`
