// Download and upload speeds over the last minutes, kept while the page is open, for the graph
// in the statistics. Each sync/maindata reply adds one sample.

export interface SpeedSample {
  time: number
  down: number
  up: number
}

// Ten minutes at one sample every two seconds.
export const HISTORY_LENGTH = 300

let samples: SpeedSample[] = []
const listeners = new Set<() => void>()

export function recordSpeeds(sample: SpeedSample) {
  samples = [...samples.slice(-(HISTORY_LENGTH - 1)), sample]
  listeners.forEach(listener => listener())
}

export const getSpeedHistory = () => samples

// Each open torrent's own speeds, kept from when its details first open until the page closes.
// Only watched torrents are recorded, so a long list costs nothing.
const watched = new Map<string, number>()
const torrentSamples = new Map<string, SpeedSample[]>()
const EMPTY: SpeedSample[] = []

export function watchTorrentSpeeds(hash: string) {
  watched.set(hash, (watched.get(hash) ?? 0) + 1)
  return () => {
    const count = (watched.get(hash) ?? 1) - 1
    if (count > 0) watched.set(hash, count)
    else watched.delete(hash)
  }
}

export function recordTorrentSpeeds(time: number, torrents: Record<string, { dlspeed?: number; upspeed?: number }>) {
  if (!watched.size) return
  for (const hash of watched.keys()) {
    const torrent = torrents[hash]
    if (!torrent) continue
    const list = torrentSamples.get(hash) ?? []
    torrentSamples.set(hash, [...list.slice(-(HISTORY_LENGTH - 1)), { time, down: torrent.dlspeed ?? 0, up: torrent.upspeed ?? 0 }])
  }
  listeners.forEach(listener => listener())
}

export const getTorrentSpeedHistory = (hash: string) => torrentSamples.get(hash) ?? EMPTY

export function onSpeedHistory(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// A round top for the graph's scale: 1, 2, or 5 times a power of ten, at least the given value.
export function niceCeiling(value: number) {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 5, 10].find(multiple => multiple * power >= value) ?? 10
  return step * power
}
