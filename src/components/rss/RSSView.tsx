import { useState } from 'react'
import { FolderPlus, Plus, RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/PageHeader'
import { useRSSFeeds, useRSSItems } from '@/hooks/useApi'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import { ArticleList } from './ArticleList'
import { FeedTree } from './FeedTree'
import { RSSPromptDialog } from './RSSPromptDialog'
import { useRSSAction, type Prompt } from './rssActions'
import { RSSRules } from './RSSRules'
import { t } from '@/i18n'

export function RSSView() {
  const queryClient = useQueryClient()
  const feedsQuery = useRSSFeeds()
  const [openFeed, setOpenFeed] = useState<string | null>(null)
  const articlesQuery = useRSSItems(openFeed ?? '')
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const action = useRSSAction()

  const feeds = feedsQuery.data?.feeds ?? []
  const folders = feedsQuery.data?.folders ?? []
  const feed = feeds.find(f => f.uid === openFeed)

  // Read state is a convenience, so a failure to save it isn't worth a message.
  const markRead = (path: string, articleId?: string) =>
    qbitClient.markAsRead(path, articleId).then(() => queryClient.invalidateQueries({ queryKey: ['rss'] }), () => undefined)

  const refresh = (path: string, label: string) => action.mutate({ work: () => qbitClient.refreshRSSItem(path), done: label, failed: t('Failed to refresh') })

  const addTorrent = async (url: string) => {
    try {
      await qbitClient.addTorrentUrl(url)
      toast.success(t('Torrent added'))
      void queryClient.invalidateQueries({ queryKey: ['torrents'] })
    } catch (error) {
      toast.error(t('Couldn\'t add the torrent'), { description: error instanceof Error ? error.message : undefined })
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('RSS')} description={t('Feeds, articles, and rules that download new episodes')} />

      {feedsQuery.isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">{t('Loading feeds...')}</p> : (
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <Card className="gap-2 md:w-80">
            <CardHeader className="flex items-center justify-between gap-1">
              <CardTitle>{t('Feeds')}</CardTitle>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" aria-label={t('Refresh all feeds')} title={t('Refresh all feeds')} disabled={feeds.length === 0} onClick={() => refresh('', t('Refreshing all feeds'))}><RefreshCw className="size-4" /></Button>
                <Button size="sm" variant="outline" aria-label={t('New folder')} title={t('New folder')} onClick={() => setPrompt({ kind: 'addFolder' })}><FolderPlus className="size-4" /></Button>
                <Button size="sm" variant="outline" aria-label={t('Add feed')} title={t('Add feed')} onClick={() => setPrompt({ kind: 'addFeed' })}><Plus className="size-4" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <FeedTree feeds={feeds} folders={folders} selected={openFeed} onSelect={setOpenFeed} onRefresh={refresh} onMarkRead={markRead} onPrompt={setPrompt} />
            </CardContent>
          </Card>

          <Card className="min-w-0 flex-1 gap-2">
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="min-w-0 truncate">{feed?.title ?? t('Articles')}</CardTitle>
              {feed && <Button size="sm" variant="ghost" disabled={feed.unreadCount === 0} onClick={() => markRead(feed.path)}>{t('Mark all as read')}</Button>}
            </CardHeader>
            <CardContent>
              {!feed ? <p className="py-8 text-center text-sm text-muted-foreground">{t('Pick a feed to see its articles')}</p>
                : articlesQuery.isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">{t('Loading articles...')}</p>
                : <ArticleList articles={articlesQuery.data?.articles ?? []} onOpened={a => { if (!a.isRead) void markRead(feed.path, a.id) }} onDownload={addTorrent} />}
            </CardContent>
          </Card>
        </div>
      )}

      <RSSRules />
      {prompt && <RSSPromptDialog prompt={prompt} folders={folders} onClose={() => setPrompt(null)} />}
    </div>
  )
}
