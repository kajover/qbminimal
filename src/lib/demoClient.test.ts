import { afterEach, describe, expect, it, vi } from 'vitest'

const { demoClient } = await import('./demoClient')
const all = { normal: true, info: true, warning: true, critical: true }

describe('demo log', () => {
  afterEach(() => { vi.useRealTimers() })

  // As qBittorrent: each entry is written in the language set at that moment, so a change shows in
  // the entries that follow and the earlier ones stay as they were.
  it('writes the entries after a change of language in that language', async () => {
    expect((await demoClient.getPreferences() as Record<string, unknown>).locale).toBe('en')
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 60_000 })
    await demoClient.setPreferences({ locale: 'de' })
    const changed = Date.now() / 1000
    vi.setSystemTime(Date.now() + 120_000)

    const logs = await demoClient.getLogs(all)
    const before = logs.filter(entry => entry.timestamp < changed)
    const after = logs.filter(entry => entry.timestamp > changed)
    expect(before.length).toBeGreaterThan(0)
    expect(after.length).toBeGreaterThan(3)
    // German puts its own quotes around names, and ON reads EIN.
    expect(before.some(entry => /„|: EIN/.test(entry.message))).toBe(false)
    expect(after.every(entry => !/: ON$|"/.test(entry.message))).toBe(true)
    expect(logs.some(entry => entry.message === 'Load qBittorrent translation successful. Locale: de.' || entry.message.includes('Locale: de'))).toBe(true)
  })
})
