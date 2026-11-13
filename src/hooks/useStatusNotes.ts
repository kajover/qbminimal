import { useErroredCount, useTransferInfo } from '@/hooks/useApi'
import { statisticsNotes, torrentNotes, type StatusNote } from '@/lib/statusNotes'

// The dots on the menu button and beside pages in the menu, sidebar and tab bar, so what's out of
// the ordinary is seen from every page: torrents with errors on Torrents, and on Statistics what it
// shows (lib/statusNotes). The menu button takes the colour of the first of all of them.
export function usePageNotes(): { torrents: StatusNote[]; statistics: StatusNote[]; all: StatusNote[] } {
  const { data: state } = useTransferInfo()
  const { data: errored = 0 } = useErroredCount()
  const torrents = torrentNotes(errored)
  const statistics = statisticsNotes(state)
  return { torrents, statistics, all: [...torrents, ...statistics] }
}
