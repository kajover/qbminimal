import { describe, expect, it } from 'vitest'
import { parseFilterViews, sameFilters, upsertView, type FilterView } from './filterViews'

const movies: FilterView = { name: 'Movies', filters: { name: '', statuses: ['downloading'], categories: ['Movies', 'Films'], tags: [], trackers: [], excluded: {}, columns: { size: { type: 'range', min: 1024 } } } }

describe('filter views', () => {
  it('reads saved views and drops broken ones', () => {
    const raw = JSON.stringify([movies, { name: '' }, 'junk', { name: 'Odd', filters: { status: 'nonsense', category: 3 } }])
    expect(parseFilterViews(raw)).toEqual([movies, { name: 'Odd', filters: { name: '', statuses: [], categories: [], tags: [], trackers: [], excluded: {}, columns: {} } }])
    expect(parseFilterViews('not json')).toEqual([])
    expect(parseFilterViews(null)).toEqual([])
  })

  it('turns views saved with one choice each into lists', () => {
    const old = JSON.stringify([{ name: 'Old', filters: { name: 'x', status: 'seeding', category: 'Linux', tag: '', tracker: 'a.test' } }, { name: 'All', filters: { status: 'all' } }])
    expect(parseFilterViews(old)).toEqual([
      { name: 'Old', filters: { name: 'x', statuses: ['seeding'], categories: ['Linux'], tags: [], trackers: ['a.test'], excluded: {}, columns: {} } },
      { name: 'All', filters: { name: '', statuses: [], categories: [], tags: [], trackers: [], excluded: {}, columns: {} } },
    ])
  })

  it('compares filters, ignoring spaces around the name search and the order of choices', () => {
    expect(sameFilters(movies.filters, { ...movies.filters, name: '  ' })).toBe(true)
    expect(sameFilters(movies.filters, { ...movies.filters, categories: ['Films', 'Movies'] })).toBe(true)
    expect(sameFilters(movies.filters, { ...movies.filters, tags: ['hd'] })).toBe(false)
  })

  it('replaces a view saved again under the same name', () => {
    const updated = { ...movies, filters: { ...movies.filters, statuses: ['seeding' as const] } }
    expect(upsertView([movies], { ...updated, name: 'movies' })).toEqual([{ ...updated, name: 'movies' }])
    expect(upsertView([movies], { ...movies, name: 'Other' })).toHaveLength(2)
  })
})
