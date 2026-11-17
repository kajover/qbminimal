import { describe, expect, it } from 'vitest'
import { DEFAULT_SEARCH_SORT, DEFAULT_SEARCH_HIDDEN, MIN_SEARCH_WIDTH, parseSearchHidden, parseSearchSort, parseSearchWidths } from './searchSettings'

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
  it('keeps only the widths set by hand, so the rest fit their content', () => {
    expect(parseSearchWidths(JSON.stringify({ fileSize: 150.4 }))).toEqual({ fileSize: 150 })
    expect(parseSearchWidths(JSON.stringify({ fileName: 600 }))).toEqual({ fileName: 600 })
  })

  it('drops widths below the minimum and anything unreadable', () => {
    expect(parseSearchWidths(JSON.stringify({ nbSeeders: MIN_SEARCH_WIDTH - 1, siteUrl: 'wide', fileName: MIN_SEARCH_WIDTH - 1 }))).toEqual({})
    expect(parseSearchWidths('[1,2]')).toEqual({})
  })
})

describe('parseSearchHidden', () => {
  it('keeps known columns in table order', () => {
    expect(parseSearchHidden(JSON.stringify(['pubDate', 'engineName']))).toEqual(['engineName', 'pubDate'])
  })

  it('never hides the name, and an empty list shows every column', () => {
    expect(parseSearchHidden(JSON.stringify(['fileName', 'colour']))).toEqual([])
  })

  it('starts with the date hidden and falls back to that', () => {
    expect(parseSearchHidden(null)).toEqual(DEFAULT_SEARCH_HIDDEN)
    expect(parseSearchHidden('{"a":1}')).toEqual(DEFAULT_SEARCH_HIDDEN)
    expect(parseSearchHidden('not json')).toEqual(DEFAULT_SEARCH_HIDDEN)
  })
})
