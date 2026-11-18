import { describe, expect, it } from 'vitest'
import { moveInOrder } from './TableColumns'

describe('moveInOrder', () => {
  it('puts a column where another one is', () => {
    expect(moveInOrder(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd'])
    expect(moveInOrder(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c'])
  })
  it('leaves the order alone for an unknown column', () => {
    expect(moveInOrder(['a', 'b'], 'x', 'a')).toEqual(['a', 'b'])
    expect(moveInOrder(['a', 'b'], 'a', 'a')).toEqual(['a', 'b'])
  })
})
