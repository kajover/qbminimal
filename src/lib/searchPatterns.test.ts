import { describe, expect, it } from 'vitest'
import { parseSavedSearches } from './searchPatterns'

describe('parseSavedSearches', () => {
  it('reads saved searches with their plugin and category', () => {
    expect(parseSavedSearches(JSON.stringify({ 3: { pattern: 'linux', plugins: 'demo', category: 'software' } })))
      .toEqual({ 3: { pattern: 'linux', plugins: 'demo', category: 'software' } })
  })

  it('reads the text-only entries of older versions', () => {
    expect(parseSavedSearches(JSON.stringify({ 1: 'debian' }))).toEqual({ 1: { pattern: 'debian', plugins: 'enabled', category: 'all' } })
  })

  it('drops anything unreadable', () => {
    expect(parseSavedSearches(JSON.stringify({ 1: 5, 2: { plugins: 'x' } }))).toEqual({})
    expect(parseSavedSearches('not json')).toEqual({})
    expect(parseSavedSearches(null)).toEqual({})
  })
})
