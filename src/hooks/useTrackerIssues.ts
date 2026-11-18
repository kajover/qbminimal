import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { qbitClient } from '@/lib/api'
import { torrentsToCheck, trackerIssue } from '@/lib/trackerIssues'
import type { Torrent } from '@/types'

// The torrents with a tracker problem, each marked with what their trackers' messages say: no
// longer registered, or the tracker is down. Only those qBittorrent marks are asked about, once a
// minute, so a large list doesn't mean a request per torrent.
export function useMarkedTorrents(torrents: Torrent[]): Torrent[] {
  const hashes = torrentsToCheck(torrents)
  const { data: issues } = useQuery({
    queryKey: ['torrents', 'trackerIssues', hashes.join()],
    enabled: hashes.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const answers = await Promise.allSettled(hashes.map(hash => qbitClient.getTorrentTrackers(hash)))
      const found = new Map<string, NonNullable<Torrent['tracker_issue']>>()
      answers.forEach((answer, i) => {
        const issue = answer.status === 'fulfilled' ? trackerIssue(answer.value) : null
        if (issue) found.set(hashes[i], issue)
      })
      return found
    },
  })
  return useMemo(() => (issues?.size ? torrents.map(torrent => (issues.has(torrent.hash) ? { ...torrent, tracker_issue: issues.get(torrent.hash) } : torrent)) : torrents), [torrents, issues])
}
