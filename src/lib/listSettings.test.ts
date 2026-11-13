import { describe, expect, it } from 'vitest'
import { DEFAULT_LIST_SETTINGS, parseListSettings } from './listSettings'

describe('parseListSettings', () => {
  it('reads saved settings', () => {
    const saved = { sortField: 'added_on', sortDirection: 'desc', view: 'table', pageSize: 100 }
    expect(parseListSettings(JSON.stringify({ ...saved, version: 2 }))).toEqual(saved)
  })

  it('leaves filters saved by older versions behind', () => {
    expect(parseListSettings(JSON.stringify({ status: 'seeding', category: 'Linux', version: 2 }))).toEqual(DEFAULT_LIST_SETTINGS)
  })

  it('sorts by queue position, as qBittorrent does, unless chosen otherwise since', () => {
    expect(DEFAULT_LIST_SETTINGS.sortField).toBe('priority')
    const older = parseListSettings(JSON.stringify({ sortField: 'name', sortDirection: 'desc', view: 'cards' }))
    expect(older).toMatchObject({ sortField: 'priority', sortDirection: 'asc', view: 'cards' })
  })

  it('uses defaults for missing, broken, or unknown values', () => {
    expect(parseListSettings(null)).toEqual(DEFAULT_LIST_SETTINGS)
    expect(parseListSettings('not json')).toEqual(DEFAULT_LIST_SETTINGS)
    expect(parseListSettings(JSON.stringify({ sortField: 'colour', status: 'gone', category: 5, view: 'grid', pageSize: 7 }))).toEqual(DEFAULT_LIST_SETTINGS)
  })
})
