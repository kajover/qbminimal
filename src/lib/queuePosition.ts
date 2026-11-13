import { qbitClient, type QueueMove } from './api'

// qBittorrent can only move torrents one place up or down, or to the top or bottom of the queue.
// To put them at a position, these are the fewest moves that get them there.

// `current` is the position of the one torrent moved, or null when several move as a block, which
// keeps their order. Positions start at 1, the top; `length` is how many torrents are queued.
export function planQueueMoves(current: number | null, target: number, count: number, length: number): QueueMove[] {
  const last = Math.max(1, length - count + 1)
  const goal = Math.min(Math.max(1, Math.round(target)), last)
  const repeat = (move: QueueMove, times: number): QueueMove[] => Array.from({ length: Math.max(0, times) }, () => move)
  const plans: QueueMove[][] = [
    ['top', ...repeat('down', goal - 1)],
    ['bottom', ...repeat('up', last - goal)],
  ]
  if (current !== null) plans.push(current > goal ? repeat('up', current - goal) : repeat('down', goal - current))
  return plans.reduce((best, plan) => (plan.length < best.length ? plan : best))
}

// Makes the moves one after another, as each starts where the last one left the torrents.
export async function moveToQueuePosition(hashes: string[], moves: QueueMove[]): Promise<void> {
  for (const move of moves) await qbitClient.moveInQueue(hashes, move)
}

// How many torrents are in the queue: those with a position, as the rest report 0.
export const queueLength = (torrents: { priority: number }[]) => torrents.filter(torrent => torrent.priority > 0).length
