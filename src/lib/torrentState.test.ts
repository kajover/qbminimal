import { describe, expect, it } from 'vitest'
import { formatEta, getStateLabel, isStoppedState } from './torrentState'

describe('torrent state helpers', () => {
  it('shortens an ETA to its largest unit', () => {
    expect(formatEta(0)).toBe('0s')
    expect(formatEta(59)).toBe('59s')
    expect(formatEta(3599)).toBe('59m')
    expect(formatEta(7200)).toBe('2h')
    expect(formatEta(3 * 86400 + 5)).toBe('3d')
    expect(formatEta(8640000)).toBe('∞')
    expect(formatEta(-1)).toBe('∞')
  })

  it('treats paused and stopped alike, and calls a stopped finished torrent completed', () => {
    expect(isStoppedState('pausedUP')).toBe(true)
    expect(isStoppedState('stoppedDL')).toBe(true)
    expect(isStoppedState('uploading')).toBe(false)
    expect(getStateLabel('stoppedUP', 1700000000)).toBe('Completed')
    expect(getStateLabel('stoppedDL', 0)).toBe('Stopped')
  })
})
