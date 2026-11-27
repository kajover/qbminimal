import { describe, expect, it } from 'vitest'
import { supportsFeature } from './apiVersion'
import { getFileDownloadUrl } from './fileDownloads'

describe('file downloads by Web API version', () => {
  it.each([
    ['2.16.0', true], ['2.16', true], ['2.17.1', true], ['3.0', true],
    ['2.15.4', false], ['2.9.3', false], ['', false], ['nonsense', false],
  ])('%s is %s', (version, expected) => expect(supportsFeature(version, 'fileDownload')).toBe(expected))
})

describe('getFileDownloadUrl', () => {
  it('uses a relative path', () => {
    expect(getFileDownloadUrl('abc', 2)).toBe('api/v2/torrents/downloadFile?hash=abc&file=2')
  })
})
