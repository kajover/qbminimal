import { describe, expect, it } from 'vitest'
import { parseFilterViews, sameFilters, upsertView, type FilterView } from './filterViews'

const movies: FilterView = { name: 'Movies', filters: { name: '', status: 'downloading', category: 'Movies', tag: '', tracker: '', columns: { size: { type: 'range', min: 1024 } } } }

describe('filter views', () => {
  it('reads saved views and drops broken ones', () => {
    const raw = JSON.stringify([movies, { name: '' }, 'junk', { name: 'Odd', filters: { status: 'nonsense', category: 3 } }])
    expect(parseFilterViews(raw)).toEqual([movies, { name: 'Odd', filters: { name: '', status: 'all', category: '', tag: '', tracker: '', columns: {} } }])
    expect(parseFilterViews('not json')).toEqual([])
    expect(parseFilterViews(null)).toEqual([])
  })

  it('compares filters, ignoring spaces around the name search', () => {
    expect(sameFilters(movies.filters, { ...movies.filters, name: '  ' })).toBe(true)
    expect(sameFilters(movies.filters, { ...movies.filters, tracker: undefined })).toBe(true)
    expect(sameFilters(movies.filters, { ...movies.filters, tag: 'hd' })).toBe(false)
  })

  it('replaces a view saved again under the same name', () => {
    const updated = { ...movies, filters: { ...movies.filters, status: 'seeding' as const } }
    expect(upsertView([movies], { ...updated, name: 'movies' })).toEqual([{ ...updated, name: 'movies' }])
    expect(upsertView([movies], { ...movies, name: 'Other' })).toHaveLength(2)
  })
})
