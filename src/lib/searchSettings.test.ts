import { describe, expect, it } from 'vitest'
import { DEFAULT_SEARCH_SORT, DEFAULT_SEARCH_WIDTHS, MIN_SEARCH_WIDTH, parseSearchSort, parseSearchWidths } from './searchSettings'

describe('parseSearchSort', () => {
  it('reads a saved sort', () => {
    expect(parseSearchSort(JSON.stringify({ key: 'fileSize', desc: false }))).toEqual({ key: 'fileSize', desc: false })
  })

  it('falls back to most seeds first', () => {
    expect(parseSearchSort(null)).toEqual(DEFAULT_SEARCH_SORT)
    expect(parseSearchSort('not json')).toEqual(DEFAULT_SEARCH_SORT)
    expect(parseSearchSort(JSON.stringify({ key: 'colour', desc: true }))).toEqual(DEFAULT_SEARCH_SORT)
    expect(parseSearchSort(JSON.stringify({ key: 'fileName' }))).toEqual(DEFAULT_SEARCH_SORT)
  })
})

describe('parseSearchWidths', () => {
  it('keeps saved widths and fills in the rest', () => {
    expect(parseSearchWidths(JSON.stringify({ fileSize: 150.4 }))).toEqual({ ...DEFAULT_SEARCH_WIDTHS, fileSize: 150 })
  })

  it('drops widths below the minimum and anything unreadable', () => {
    expect(parseSearchWidths(JSON.stringify({ nbSeeders: MIN_SEARCH_WIDTH - 1, siteUrl: 'wide', fileName: 400 }))).toEqual(DEFAULT_SEARCH_WIDTHS)
    expect(parseSearchWidths('[1,2]')).toEqual(DEFAULT_SEARCH_WIDTHS)
  })
})
