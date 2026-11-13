import { describe, expect, it } from 'vitest'
import { isErrored, statisticsNotes, torrentNotes } from './statusNotes'

const dots = (notes: { dot: string }[]) => notes.map(note => note.dot)

describe('statisticsNotes', () => {
  it('says nothing while all is as usual', () => {
    expect(statisticsNotes(undefined)).toEqual([])
    expect(statisticsNotes({ connection_status: 'connected', use_alt_speed_limits: false, session_state: false })).toEqual([])
  })

  it('colours a connection problem like the statistics do', () => {
    expect(dots(statisticsNotes({ connection_status: 'firewalled' }))).toEqual(['bg-amber-500'])
    expect(dots(statisticsNotes({ connection_status: 'disconnected' }))).toEqual(['bg-red-500'])
  })

  it('puts paused transfers before the connection, and the alternative limits last', () => {
    const notes = statisticsNotes({ connection_status: 'disconnected', session_state: true, use_alt_speed_limits: true })
    expect(notes.map(note => note.label)).toEqual(['All transfers paused', 'Alternative speed limits are on'])
  })
})

describe('torrentNotes', () => {
  it('marks torrents with errors in red, and none without', () => {
    expect(torrentNotes(0)).toEqual([])
    expect(torrentNotes(2)).toEqual([{ dot: 'bg-red-500', label: 'Torrents with errors: 2' }])
  })

  it('counts errors and missing files as errored', () => {
    expect(['error', 'missingFiles', 'stalledDL', 'uploading'].filter(isErrored)).toEqual(['error', 'missingFiles'])
  })
})
