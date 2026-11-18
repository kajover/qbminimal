import { describe, expect, it } from 'vitest'
import { buildLogText, formatLogTime, logFileName } from './logExport'

const at = (y: number, mo: number, d: number, h: number, mi: number, s: number) => new Date(y, mo - 1, d, h, mi, s).getTime() / 1000

describe('formatLogTime', () => {
  it('pads to a fixed width in local time', () => {
    expect(formatLogTime(at(2026, 3, 4, 5, 6, 7))).toBe('2026-03-04 05:06:07')
  })
})

describe('buildLogText', () => {
  it('writes one tab-separated line per entry', () => {
    const text = buildLogText([
      { timestamp: at(2026, 1, 2, 3, 4, 5), level: 'warning', message: 'Slow disk' },
      { timestamp: at(2026, 1, 2, 3, 4, 6), level: 'Banned', message: '192.0.2.1: bad peer' },
    ])
    expect(text).toBe('2026-01-02 03:04:05\tWARNING\tSlow disk\n2026-01-02 03:04:06\tBANNED\t192.0.2.1: bad peer\n')
  })

  it('keeps a message with line breaks on one line', () => {
    expect(buildLogText([{ timestamp: at(2026, 1, 2, 3, 4, 5), level: 'info', message: 'a\nb\r\nc' }])).toBe('2026-01-02 03:04:05\tINFO\ta b c\n')
  })

  it('is empty for no entries', () => {
    expect(buildLogText([])).toBe('')
  })
})

describe('logFileName', () => {
  it('names the main log and the peers log by date', () => {
    const now = new Date(2026, 10, 18, 12)
    expect(logFileName('main', now)).toBe('qbminimal-log-2026-11-18.txt')
    expect(logFileName('peers', now)).toBe('qbminimal-peers-2026-11-18.txt')
  })
})
