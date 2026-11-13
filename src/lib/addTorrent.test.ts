import { describe, expect, it } from 'vitest'
import { DEFAULT_ADD_OPTIONS, buildAddParams, describeAddResult, magnetHash, parseLinks, readMetadata, selectedSize } from './addTorrent'

describe('parseLinks', () => {
  it('keeps one link per non-blank line', () => {
    expect(parseLinks(' magnet:?a \n\nhttps://x.test/a.torrent\n')).toEqual(['magnet:?a', 'https://x.test/a.torrent'])
  })
})

describe('buildAddParams', () => {
  it('sends only the links when nothing else is chosen', () => {
    expect(buildAddParams(DEFAULT_ADD_OPTIONS, ['magnet:?a', 'magnet:?b'], 2)).toEqual({ urls: 'magnet:?a\nmagnet:?b' })
  })

  it('maps the chosen options to qBittorrent\'s names', () => {
    const params = buildAddParams({
      ...DEFAULT_ADD_OPTIONS,
      category: 'Linux',
      tags: 'iso, , stable',
      savePath: ' /srv ',
      useDownloadPath: 'true',
      downloadPath: '/tmp',
      contentLayout: 'NoSubfolder',
      start: 'false',
      stopCondition: 'FilesChecked',
      skipChecking: true,
      dlLimitKiB: '100',
      upLimitKiB: '0',
    }, ['magnet:?a'], 1)
    expect(params).toEqual({
      urls: 'magnet:?a',
      category: 'Linux',
      tags: 'iso,stable',
      savepath: '/srv',
      useDownloadPath: 'true',
      downloadPath: '/tmp',
      contentLayout: 'NoSubfolder',
      stopped: 'true',
      skip_checking: 'true',
      seedMode: 'true',
      dlLimit: '102400',
      upLimit: '-1',
    })
  })

  it('sends a stop condition only for torrents that start', () => {
    expect(buildAddParams({ ...DEFAULT_ADD_OPTIONS, start: 'true', stopCondition: 'MetadataReceived' }, ['m'], 1)).toMatchObject({ stopped: 'false', stopCondition: 'MetadataReceived' })
  })

  it('sends custom seeding limits with their action', () => {
    const params = buildAddParams({ ...DEFAULT_ADD_OPTIONS, shareLimits: { mode: 'custom', ratio: '2', seedingMinutes: '', inactiveMinutes: '', action: 'Stop' } }, ['m'], 1)
    expect(params).toMatchObject({ ratioLimit: '2', seedingTimeLimit: '-1', inactiveSeedingTimeLimit: '-1', shareLimitAction: 'Stop' })
  })

  it('refuses a new name for several torrents', () => {
    expect(typeof buildAddParams({ ...DEFAULT_ADD_OPTIONS, rename: 'x' }, ['a', 'b'], 2)).toBe('string')
  })

  it('refuses negative speed limits', () => {
    expect(typeof buildAddParams({ ...DEFAULT_ADD_OPTIONS, dlLimitKiB: '-5' }, ['a'], 1)).toBe('string')
  })
})

describe('describeAddResult', () => {
  it('reads qBittorrent 5.2 counts', () => {
    expect(describeAddResult({ success_count: 2, failure_count: 1, pending_count: 0 }, 3)).toEqual({ ok: false, message: '2 added, 1 failed' })
    expect(describeAddResult({ success_count: 0, failure_count: 0, pending_count: 1 }, 1)).toEqual({ ok: true, message: '1 still downloading the .torrent file' })
  })

  it('reads older plain-text answers', () => {
    expect(describeAddResult('Ok.', 1)).toEqual({ ok: true, message: 'Torrent added' })
    expect(describeAddResult('Fails.', 1).ok).toBe(false)
  })
})

describe('readMetadata', () => {
  it('waits while only the hash is known', () => {
    expect(readMetadata({ hash: 'abc' })).toBeNull()
    expect(readMetadata({})).toBeNull()
  })

  it('reads the file list once it arrives', () => {
    expect(readMetadata({ hash: 'abc', info: { name: 'Show', length: 30, files: [{ path: 'Show/a.mkv', length: 30 }] } })).toEqual({
      name: 'Show', size: 30, files: [{ path: 'Show/a.mkv', length: 30 }],
    })
  })
})

describe('selectedSize', () => {
  it('adds up the wanted files', () => {
    expect(selectedSize([{ length: 5 }, { length: 7 }, { length: 1 }], [1, 0, 7])).toBe(6)
  })
})


describe('magnetHash', () => {
  it('reads a hex btih in lower case', () => {
    expect(magnetHash('magnet:?xt=urn:btih:AA3156D6D0C719A83429D3DBA9918579360C217E&dn=x')).toBe('aa3156d6d0c719a83429d3dba9918579360c217e')
  })
  it('turns a base32 btih into hex', () => {
    // 32 base32 characters of "A" are 160 zero bits; "7" is 11111.
    expect(magnetHash('magnet:?xt=urn:btih:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7')).toBe('000000000000000000000000000000000000001f')
  })
  it('gives null for links without one', () => {
    expect(magnetHash('https://example.com/a.torrent')).toBeNull()
    expect(magnetHash('magnet:?xt=urn:btmh:1220abcd')).toBeNull()
  })
})
