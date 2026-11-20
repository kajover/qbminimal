import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'
import type { RSSFeed } from '@/types'

// The last part of a backslash-separated RSS path.
export const rssName = (path: string) => path.split('\\').pop() ?? path

// One dialog covers every RSS action that needs typing or choosing something.
export type Prompt =
  | { kind: 'addFeed' }
  | { kind: 'addFolder' }
  | { kind: 'rename'; path: string; isFolder: boolean }
  | { kind: 'move'; path: string }
  | { kind: 'url'; feed: RSSFeed }
  | { kind: 'interval'; feed: RSSFeed }
  | { kind: 'remove'; path: string; isFolder: boolean }

// An RSS change that confirms itself with a notification and refreshes the feeds.
export function useRSSAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ work }: { work: () => Promise<unknown>; done: string; failed: string }) => work(),
    onSuccess: (_result, { done }) => {
      toast.success(done)
      queryClient.invalidateQueries({ queryKey: ['rss'] })
    },
    onError: (error, { failed }) => toast.error(failed, { description: error instanceof Error ? error.message : undefined }),
  })
}


// A section's list below its toolbar, as on the Logs page, scrolling on its own.
export const RSS_LIST = 'min-h-0 flex-1 overflow-y-auto'
// The toolbar: a short search, then the buttons at the end in a group as wide in every section, so
// the search is as wide in each as in Articles, where the feed picker shares the group on phones.
export const RSS_SEARCH = 'me-1 min-w-0 flex-1 sm:max-w-56'
export const RSS_TOOLS = 'ms-auto flex w-48 shrink-0 items-center justify-end gap-1 sm:w-auto'
