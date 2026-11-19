import { Ban, CircleArrowDown, CircleArrowUp, CircleCheck, CircleExclamationPoint, CirclePause, CirclePlay, CircleQuestionMark, Clock, type LucideIcon } from 'lucide-react'
import { CircleActivity, CircleFileX, CircleFlat, CircleFolderInput, CircleHardDrive, CircleHourglass, CircleListChecks, CircleServerAlert, CircleServerCrash, CircleServerOff } from './circledIcons'
import { isStoppedState } from './torrentState'
import type { StatusFilter } from './torrentFilters'

// The icons of the sidebar's statuses, which the table's status icons reuse, each inside a circle.
// Active and inactive are the same line, with and without a pulse; stalled is the same hourglass
// either way; a tracker warning is the tracker error's server with an exclamation mark.
export const STATUS_ICONS: Record<StatusFilter, LucideIcon> = {
  downloading: CircleArrowDown, seeding: CircleArrowUp, completed: CircleCheck, running: CirclePlay, stopped: CirclePause, active: CircleActivity, inactive: CircleFlat,
  stalled: CircleHourglass, stalledUploading: CircleHourglass, stalledDownloading: CircleHourglass, checking: CircleListChecks, moving: CircleFolderInput,
  errored: CircleExclamationPoint, trackerError: CircleServerCrash, unregistered: Ban, trackerDown: CircleServerOff, trackerWarning: CircleServerAlert,
}

// The icon for a torrent's own state, as in the table's status icon column.
export function getStateIcon(state: string, completedOn: number): LucideIcon {
  if (isStoppedState(state)) return completedOn > 0 ? STATUS_ICONS.completed : STATUS_ICONS.stopped
  switch (state) {
    case 'downloading': case 'forcedDL': case 'metaDL': case 'forcedMetaDL': return STATUS_ICONS.downloading
    case 'uploading': case 'forcedUP': return STATUS_ICONS.seeding
    case 'stalledDL': case 'stalledUP': return STATUS_ICONS.stalled
    case 'queuedDL': case 'queuedUP': return Clock
    case 'checkingDL': case 'checkingUP': case 'checkingResumeData': return STATUS_ICONS.checking
    case 'moving': return STATUS_ICONS.moving
    case 'error': return STATUS_ICONS.errored
    case 'missingFiles': return CircleFileX
    case 'allocating': return CircleHardDrive
    default: return CircleQuestionMark
  }
}
