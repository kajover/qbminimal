import { describe, expect, it } from 'vitest'
import { jsonTokens, parseLogMessage } from './logDetails'

describe('parseLogMessage', () => {
  it('splits the sentence from its quoted details', () => {
    expect(parseLogMessage('Successfully listening on IP. IP: "0.0.0.0". Port: "TCP/51413"')).toEqual({
      summary: 'Successfully listening on IP.',
      fields: [{ key: 'IP', value: '0.0.0.0' }, { key: 'Port', value: 'TCP/51413' }],
    })
  })

  it('reads a message that is only a detail', () => {
    expect(parseLogMessage('Peer ID: "-qB5230-"')).toEqual({ summary: '', fields: [{ key: 'Peer ID', value: '-qB5230-' }] })
    expect(parseLogMessage('UPnP / NAT-PMP support: ON')).toEqual({ summary: '', fields: [{ key: 'UPnP / NAT-PMP support', value: 'ON' }] })
  })

  it('keeps a plain sentence whole', () => {
    expect(parseLogMessage('qBittorrent v5.2.3 started')).toEqual({ summary: 'qBittorrent v5.2.3 started', fields: [] })
    expect(parseLogMessage('Torrent download finished.')).toEqual({ summary: 'Torrent download finished.', fields: [] })
  })

  it('keeps escaped quotes inside a value', () => {
    expect(parseLogMessage('Failed. Error: "bad \\"name\\""').fields).toEqual([{ key: 'Error', value: 'bad "name"' }])
  })
})

describe('jsonTokens', () => {
  it('marks keys, strings, numbers and literals, and keeps every character', () => {
    const json = JSON.stringify({ id: 3, level: 'info', ok: true, note: null }, null, 2)
    const tokens = jsonTokens(json)
    expect(tokens.map(token => token.text).join('')).toBe(json)
    const kinds = Object.fromEntries(tokens.filter(token => token.kind !== 'plain').map(token => [token.text, token.kind]))
    expect(kinds).toEqual({ '"id"': 'key', '3': 'number', '"level"': 'key', '"info"': 'string', '"ok"': 'key', true: 'literal', '"note"': 'key', null: 'literal' })
  })
})
