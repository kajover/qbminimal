import { describe, expect, it } from 'vitest'
import { isApiAtLeast, supportsFeature } from './apiVersion'

describe('isApiAtLeast', () => {
  it('compares each part as a number', () => {
    expect(isApiAtLeast('2.15.1', [2, 15, 1])).toBe(true)
    expect(isApiAtLeast('2.15.1', [2, 15, 2])).toBe(false)
    expect(isApiAtLeast('2.16', [2, 15, 3])).toBe(true)
    expect(isApiAtLeast('2.9.3', [2, 15, 0])).toBe(false)
    expect(isApiAtLeast('3.0.0', [2, 16, 2])).toBe(true)
  })

  it('treats unknown versions as too old', () => {
    expect(isApiAtLeast(undefined, [2, 0, 0])).toBe(false)
    expect(isApiAtLeast('v2', [2, 0, 0])).toBe(false)
  })
})

describe('supportsFeature', () => {
  it('knows which features qBittorrent 5.2.3 lacks', () => {
    expect(supportsFeature('2.15.1', 'fileDownload')).toBe(false)
    expect(supportsFeature('2.11.4', 'setComment')).toBe(false)
    expect(supportsFeature('2.12.1', 'setComment')).toBe(true)
    expect(supportsFeature('2.15.1', 'sessionPause')).toBe(false)
    expect(supportsFeature('2.17.0', 'sessionPause')).toBe(true)
  })
})
