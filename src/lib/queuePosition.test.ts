import { describe, expect, it } from 'vitest'
import { planQueueMoves } from './queuePosition'

describe('planQueueMoves', () => {
  it('moves one torrent the shortest way', () => {
    expect(planQueueMoves(5, 3, 1, 20)).toEqual(['up', 'up'])
    expect(planQueueMoves(5, 1, 1, 20)).toEqual(['top'])
    expect(planQueueMoves(5, 20, 1, 20)).toEqual(['bottom'])
    expect(planQueueMoves(15, 2, 1, 20)).toEqual(['top', 'down'])
    expect(planQueueMoves(3, 3, 1, 20)).toEqual([])
  })

  it('keeps the target inside the queue', () => {
    expect(planQueueMoves(2, 99, 1, 10)).toEqual(['bottom'])
    expect(planQueueMoves(4, 0, 1, 10)).toEqual(['top'])
  })

  it('moves several as a block from the top or bottom', () => {
    expect(planQueueMoves(null, 3, 2, 10)).toEqual(['top', 'down', 'down'])
    // Three torrents ending at 7, 8 and 9 of 10: from the bottom, one place up.
    expect(planQueueMoves(null, 7, 3, 10)).toEqual(['bottom', 'up'])
  })
})
