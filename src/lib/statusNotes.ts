import type { ServerState } from './mainData'
import { t } from '@/i18n'

// qBittorrent's connection states, as the statistics show them.
export const CONNECTION_LABELS: Record<string, { label: string; description: string; dot: string; text: string }> = {
  connected: { label: t('Connected'), description: t('Other peers can reach qBittorrent'), dot: 'bg-green-500', text: 'text-green-600 dark:text-green-400' },
  firewalled: { label: t('Firewalled'), description: t('Peers can\'t connect in, so only outgoing connections work'), dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  disconnected: { label: t('Disconnected'), description: t('qBittorrent has no network connection'), dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
}
const PAUSED_DOT = 'bg-muted-foreground'
const ALTERNATIVE_DOT = 'bg-amber-500'
const ERROR_DOT = 'bg-red-500'

export interface StatusNote {
  dot: string
  label: string
}

// What the statistics would show that's out of the ordinary: transfers paused, or a connection other
// than "connected", then the alternative speed limits. Nothing while all is as usual.
export function statisticsNotes(state: Partial<ServerState> | undefined): StatusNote[] {
  if (!state) return []
  const notes: StatusNote[] = []
  const connection = CONNECTION_LABELS[state.connection_status ?? '']
  if (state.session_state === true) notes.push({ dot: PAUSED_DOT, label: t('All transfers paused') })
  else if (state.connection_status && state.connection_status !== 'connected') notes.push({ dot: connection?.dot ?? PAUSED_DOT, label: connection?.label ?? state.connection_status })
  if (state.use_alt_speed_limits === true) notes.push({ dot: ALTERNATIVE_DOT, label: t('Alternative speed limits are on') })
  return notes
}

// Torrents that stopped with an error or lost their files, which the Errored status filter shows.
export const isErrored = (state: string) => state === 'error' || state === 'missingFiles'

export function torrentNotes(errored: number): StatusNote[] {
  return errored > 0 ? [{ dot: ERROR_DOT, label: t('Torrents with errors: {count}', { count: errored }) }] : []
}
