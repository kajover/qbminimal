import { ArrowDown, ArrowDownToLine, ArrowLeftRight, ArrowUp, ArrowUpToLine, FileCheck, Folder, FolderInput, Gauge, Hash, ListOrdered, Magnet, Megaphone, Rocket, Sprout, Tag, TagX, Type, WandSparkles, Zap, ZapOff, type LucideIcon } from 'lucide-react'
import { useTorrentAction } from '@/hooks/useApi'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import { copyText } from '@/lib/clipboard'
import type { Torrent } from '@/types'
import { t } from '@/i18n'

// Actions that need a value first open a small dialog.
export type BulkPrompt = 'category' | 'addTags' | 'removeTags' | 'location' | 'limits' | 'shareLimits' | 'autoOn'

export interface MenuEntry {
  // Stable, for remembering which actions are pinned to the selection bar.
  id: string
  label: string
  onSelect: () => void
  icon?: LucideIcon
  // For an entry that turns something off again, shown pressed in a row of icons.
  pressed?: boolean
  disabled?: boolean
}

// Shown as sections of the More menu, and as sections or submenus of the right-click menu. A group
// of `icons` shows as a row of icon buttons, each named by a label on hover.
export interface MenuGroup {
  name: string
  entries: MenuEntry[]
  icons?: boolean
}

// Everything that can be done to a set of torrents besides starting, stopping, and deleting them.
export function useBulkActions(torrents: Torrent[], ask: (prompt: BulkPrompt) => void): MenuGroup[] {
  const action = useTorrentAction()
  const hashes = torrents.map(t => t.hash)
  const one = torrents.length === 1

  const run = (id: string, label: string, work: (hashes: string[]) => Promise<unknown>, done: string, failed: string, icon?: LucideIcon): MenuEntry => ({
    id,
    label,
    icon,
    onSelect: () => void action.mutateAsync({ work: () => work(hashes), failed }).then(() => toast.success(done), () => undefined),
  })
  const prompt = (id: string, label: string, kind: BulkPrompt, icon?: LucideIcon): MenuEntry => ({ id, label, icon, onSelect: () => ask(kind) })
  const copy = (id: string, label: string, lines: string[], copiedMessage: string, failedMessage: string, icon?: LucideIcon): MenuEntry => ({
    id,
    label,
    icon,
    onSelect: () => void copyText(lines.join('\n')).then(copied => (copied ? toast.success(copiedMessage) : toast.error(failedMessage))),
  })
  const queue = t('Queue order changed')
  const queueFailed = t('Failed to change queue order')
  // One button forces them all, or, when they all are already, stops forcing.
  const allForced = torrents.length > 0 && torrents.every(torrent => torrent.force_start)

  return [
    {
      name: 'Transfer',
      icons: true,
      entries: [
        allForced
          ? { ...run('forceStart', t('Stop forcing'), h => qbitClient.setForceStart(h, false), t('Force start off'), t('Failed to change force start'), ZapOff), pressed: true }
          : run('forceStart', t('Force start'), h => qbitClient.setForceStart(h, true), t('Force start on'), t('Failed to change force start'), Zap),
        run('recheck', t('Recheck'), h => qbitClient.recheckTorrents(h), t('Recheck started'), t('Failed to start recheck'), FileCheck),
        run('reannounce', t('Reannounce'), h => qbitClient.reannounceTorrents(h), t('Reannounce sent'), t('Failed to reannounce'), Megaphone),
      ],
    },
    {
      name: 'Organize',
      entries: [
        prompt('category', t('Set category...'), 'category', Folder),
        prompt('addTags', t('Add tags...'), 'addTags', Tag),
        prompt('removeTags', t('Remove tags...'), 'removeTags', TagX),
        prompt('location', t('Move files...'), 'location', FolderInput),
        prompt('limits', t('Speed limits...'), 'limits', Gauge),
        prompt('shareLimits', t('Seeding limits...'), 'shareLimits', Sprout),
      ],
    },
    {
      name: 'Queue',
      icons: true,
      entries: [
        run('queueTop', t('Move to top'), h => qbitClient.moveInQueue(h, 'top'), queue, queueFailed, ArrowUpToLine),
        run('queueUp', t('Move up'), h => qbitClient.moveInQueue(h, 'up'), queue, queueFailed, ArrowUp),
        run('queueDown', t('Move down'), h => qbitClient.moveInQueue(h, 'down'), queue, queueFailed, ArrowDown),
        run('queueBottom', t('Move to bottom'), h => qbitClient.moveInQueue(h, 'bottom'), queue, queueFailed, ArrowDownToLine),
      ],
    },
    {
      name: 'Options',
      entries: [
        run('sequential', t('Switch sequential download'), h => qbitClient.toggleSequentialDownload(h), t('Sequential download switched'), t('Failed to change sequential download'), ListOrdered),
        run('firstLast', t('Switch first and last pieces first'), h => qbitClient.toggleFirstLastPiecePrio(h), t('Piece order switched'), t('Failed to change piece order'), ArrowLeftRight),
        run('superSeedingOn', t('Super seeding on'), h => qbitClient.setSuperSeeding(h, true), t('Super seeding on'), t('Failed to change super seeding'), Rocket),
        run('superSeedingOff', t('Super seeding off'), h => qbitClient.setSuperSeeding(h, false), t('Super seeding off'), t('Failed to change super seeding'), Rocket),
        prompt('autoOn', t('Automatic management on'), 'autoOn', WandSparkles),
        run('autoOff', t('Automatic management off'), h => qbitClient.setAutoManagement(h, false), t('Automatic management off'), t('Failed to change automatic management'), WandSparkles),
      ],
    },
    {
      name: 'Copy',
      entries: [
        copy('copyName', one ? t('Copy name') : t('Copy names'), torrents.map(torrent => torrent.name), one ? t('Name copied') : t('Names copied'), one ? t("Couldn't copy the name") : t("Couldn't copy the names"), Type),
        copy('copyHash', one ? t('Copy hash') : t('Copy hashes'), hashes, one ? t('Hash copied') : t('Hashes copied'), one ? t("Couldn't copy the hash") : t("Couldn't copy the hashes"), Hash),
        copy('copyMagnet', one ? t('Copy magnet link') : t('Copy magnet links'), torrents.map(torrent => torrent.magnet_uri).filter(Boolean), one ? t('Magnet link copied') : t('Magnet links copied'), one ? t("Couldn't copy the magnet link") : t("Couldn't copy the magnet links"), Magnet),
      ],
    },
  ]
}
