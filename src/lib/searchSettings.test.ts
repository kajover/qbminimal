import { describe, expect, it } from 'vitest'
import { DEFAULT_SEARCH_HIDDEN, MIN_SEARCH_WIDTH, parseSearchHidden, parseSearchWidths } from './searchSettings'

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
