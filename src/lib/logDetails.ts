// qBittorrent writes most log messages as a sentence followed by quoted details, such as
// 'Detected external IP. IP: "203.0.113.7"'. These split them apart for the entry's window.

export interface LogField {
  key: string
  value: string
}

export interface ParsedLogMessage {
  // The sentence before the details, or '' when the message is only a detail.
  summary: string
  fields: LogField[]
}

// A detail's name starts the message or follows the end of a sentence (". ").
const QUOTED = /(?:^|(?<=\.\s))([A-Za-z][\w /()-]{0,40}?):\s*"((?:[^"\\]|\\.)*)"/g
// A short label and a value with nothing quoted, as in 'UPnP / NAT-PMP support: ON'.
const PLAIN = /^([A-Za-z][^:."]{0,40}):\s+(\S.*)$/

export function parseLogMessage(message: string): ParsedLogMessage {
  const text = message.trim()
  const fields: LogField[] = []
  let first = -1
  for (const match of text.matchAll(QUOTED)) {
    if (first < 0) first = match.index
    fields.push({ key: match[1].trim(), value: match[2].replace(/\\(.)/g, '$1') })
  }
  if (fields.length) return { summary: text.slice(0, first).trim(), fields }
  const plain = PLAIN.exec(text)
  if (plain) return { summary: '', fields: [{ key: plain[1].trim(), value: plain[2].trim() }] }
  return { summary: text, fields: [] }
}

export type JsonTokenKind = 'key' | 'string' | 'number' | 'literal' | 'plain'

export interface JsonToken {
  text: string
  kind: JsonTokenKind
}

const TOKENS = /("(?:\\.|[^"\\])*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g

// JSON text cut into pieces to colour: keys, strings, numbers, and true, false and null.
export function jsonTokens(json: string): JsonToken[] {
  const tokens: JsonToken[] = []
  let at = 0
  for (const match of json.matchAll(TOKENS)) {
    if (match.index > at) tokens.push({ text: json.slice(at, match.index), kind: 'plain' })
    if (match[1] !== undefined) {
      tokens.push({ text: match[1], kind: match[2] ? 'key' : 'string' })
      if (match[2]) tokens.push({ text: match[2], kind: 'plain' })
    } else tokens.push({ text: match[0], kind: /^[-\d]/.test(match[0]) ? 'number' : 'literal' })
    at = match.index + match[0].length
  }
  if (at < json.length) tokens.push({ text: json.slice(at), kind: 'plain' })
  return tokens
}
