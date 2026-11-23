// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { countReleaseDownload, isNewer, newestRelease, parseVersion, sendPendingCounts } from './updates'

describe('update check', () => {
  it('reads version numbers in their usual spellings', () => {
    expect(parseVersion('v1.2.3')).toEqual([1, 2, 3])
    expect(parseVersion('1.10.0')).toEqual([1, 10, 0])
    expect(parseVersion('release-5.1.2')).toEqual([5, 1, 2])
    expect(parseVersion('release-5.1.0beta1')).toBeNull()
    expect(parseVersion(undefined)).toBeNull()
  })

  it('compares each part as a number', () => {
    expect(isNewer([1, 10, 0], [1, 9, 9])).toBe(true)
    expect(isNewer([1, 1, 2], [1, 1, 2])).toBe(false)
    expect(isNewer([1, 1, 1], [1, 1, 2])).toBe(false)
  })

  it('finds the newest finished qBittorrent release among its tags', () => {
    expect(newestRelease(['release-5.0.4', 'release-5.1.2', 'release-5.2.0rc1', 'release-4.6.7', 'v2.0.0'])).toEqual([5, 1, 2])
    expect(newestRelease([])).toBeNull()
  })
})

describe('counting an update on the zip', () => {
  const URL_1617 = 'https://github.com/kajover/qbminimal/releases/download/v1.6.17/qbminimal-release.zip'
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('asks for the release zip once, without waiting for it, and forgets it once GitHub answers', async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response(null)))
    vi.stubGlobal('fetch', fetch)
    expect(countReleaseDownload('1.6.17')).toBeUndefined()
    expect(fetch).toHaveBeenCalledExactlyOnceWith(URL_1617, expect.objectContaining({ mode: 'no-cors' }))
    countReleaseDownload('not a version')
    expect(fetch).toHaveBeenCalledOnce()
    await vi.runAllTimersAsync()
    expect(localStorage.getItem('qbminimal.pendingCounts')).toBeNull()
    sendPendingCounts()
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('tries a blocked count again later, and when the app opens next', async () => {
    const fetch = vi.fn((): Promise<Response> => Promise.reject(new Error('blocked')))
    vi.stubGlobal('fetch', fetch)
    countReleaseDownload('1.6.17')
    await vi.runAllTimersAsync()
    expect(fetch).toHaveBeenCalledTimes(4)
    expect(localStorage.getItem('qbminimal.pendingCounts')).toBe('["1.6.17"]')

    fetch.mockImplementation(() => Promise.resolve(new Response(null)))
    sendPendingCounts()
    await vi.runAllTimersAsync()
    expect(fetch).toHaveBeenCalledTimes(5)
    expect(localStorage.getItem('qbminimal.pendingCounts')).toBeNull()
  })
})
