import { describe, expect, it } from 'vitest'
import { CircleQuestionMark, Clock } from 'lucide-react'
import { CircleFileX, CircleHardDrive } from './circledIcons'
import { getStateIcon, STATUS_ICONS } from './stateIcons'

describe('getStateIcon', () => {
  it('gives each of qBittorrent\'s states the icon of its status', () => {
    const cases: [state: string, completedOn: number, icon: unknown][] = [
      ['downloading', 0, STATUS_ICONS.downloading], ['forcedDL', 0, STATUS_ICONS.downloading], ['metaDL', 0, STATUS_ICONS.downloading], ['forcedMetaDL', 0, STATUS_ICONS.downloading],
      ['uploading', 1, STATUS_ICONS.seeding], ['forcedUP', 1, STATUS_ICONS.seeding],
      ['stalledDL', 0, STATUS_ICONS.stalled], ['stalledUP', 1, STATUS_ICONS.stalled],
      ['stoppedDL', 0, STATUS_ICONS.stopped], ['pausedDL', 0, STATUS_ICONS.stopped], ['stoppedUP', 1, STATUS_ICONS.completed], ['pausedUP', 1, STATUS_ICONS.completed],
      ['queuedDL', 0, Clock], ['queuedUP', 1, Clock],
      ['checkingDL', 0, STATUS_ICONS.checking], ['checkingUP', 1, STATUS_ICONS.checking], ['checkingResumeData', 0, STATUS_ICONS.checking],
      ['moving', 0, STATUS_ICONS.moving], ['error', 0, STATUS_ICONS.errored], ['missingFiles', 0, CircleFileX], ['allocating', 0, CircleHardDrive],
      ['somethingNew', 0, CircleQuestionMark],
    ]
    for (const [state, completedOn, icon] of cases) expect(getStateIcon(state, completedOn), state).toBe(icon)
  })

  it('uses the same hourglass for every stalled status', () => {
    expect(STATUS_ICONS.stalledUploading).toBe(STATUS_ICONS.stalled)
    expect(STATUS_ICONS.stalledDownloading).toBe(STATUS_ICONS.stalled)
  })
})

describe('getStateBadge', () => {
  it('fills only downloading, seeding, stalled, queued and error states, as qui does', async () => {
    const { getStateBadge } = await import('./torrentState')
    for (const state of ['downloading', 'uploading', 'stalledDL', 'stalledUP', 'queuedDL', 'queuedUP', 'error', 'missingFiles']) expect(getStateBadge(state, 0), state).toMatch(/bg-/)
    for (const state of ['forcedDL', 'forcedUP', 'metaDL', 'checkingDL', 'checkingResumeData', 'moving', 'allocating', 'stoppedDL', 'pausedDL']) expect(getStateBadge(state, 0), state).not.toMatch(/bg-/)
    // Completed: stopped after finishing, green and outlined.
    expect(getStateBadge('stoppedUP', 1)).toMatch(/ring-green/)
  })
})
