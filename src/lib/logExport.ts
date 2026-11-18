export interface LogLine {
  timestamp: number
  level: string
  message: string
}

const pad = (n: number) => String(n).padStart(2, '0')

// Local date, as YYYY-MM-DD.
export function formatLogDate(timestamp: number): string {
  const d = new Date(timestamp * 1000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Local date and time, as YYYY-MM-DD HH:MM:SS. Fixed width, so the rows line up.
export function formatLogTime(timestamp: number): string {
  const d = new Date(timestamp * 1000)
  return `${formatLogDate(timestamp)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// One line per entry: time, level and message, split by tabs. A message with line breaks is put on one line.
export function buildLogText(lines: LogLine[]): string {
  return lines.map(line => `${formatLogTime(line.timestamp)}\t${line.level.toUpperCase()}\t${line.message.replace(/\s*[\r\n]+\s*/g, ' ')}`).join('\n') + (lines.length ? '\n' : '')
}

export function logFileName(kind: 'main' | 'peers', now: Date = new Date()): string {
  return `qbminimal-${kind === 'main' ? 'log' : 'peers'}-${formatLogDate(now.getTime() / 1000)}.txt`
}
