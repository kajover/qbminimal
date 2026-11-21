import { useState } from 'react'
import { CheckCheck, FolderPlus, Plus, RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { NativeSelect } from '@/components/NativeSelect'
import { PageHeader } from '@/components/PageHeader'
import { SearchInput } from '@/components/SearchInput'
import { useRSSFeeds, useRSSItems } from '@/hooks/useApi'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import { FILL_PAGE } from '@/lib/pageScroll'
import { ArticleList } from './ArticleList'
import { FeedTree } from './FeedTree'
import { RSSPromptDialog } from './RSSPromptDialog'
import { RSS_LIST, RSS_SEARCH, RSS_TOOLS, rssName, useRSSAction, type Prompt } from './rssActions'
import { RSSRules } from './RSSRules'
import { withKeys } from '@/lib/shortcutKeys'
import { t } from '@/i18n'

type Section = 'articles' | 'feeds' | 'rules'

// One section at a time, picked like the Settings sections, so no list runs on below another.
const SECTIONS: { id: Section; title: string }[] = [
  { id: 'articles', get title() { return t('Articles') } },
  { id: 'feeds', get title() { return t('Feeds') } },
  { id: 'rules', get title() { return t('Download rules') } },
]

export function RSSView() {
  const queryClient = useQueryClient()
  const feedsQuery = useRSSFeeds()
  const [section, setSection] = useState<Section>('articles')
  const [chosenFeed, setChosenFeed] = useState<string | null>(null)
  const [articleSearch, setArticleSearch] = useState('')
  const [feedSearch, setFeedSearch] = useState('')
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  // The feed or folder whose articles are about to be marked read, asked about first.
  const [readAll, setReadAll] = useState<string | null>(null)
  const action = useRSSAction()

  const feeds = feedsQuery.data?.feeds ?? []
  const folders = feedsQuery.data?.folders ?? []
  // The chosen feed, or else the first, so the articles show something straight away.
  const feed = feeds.find(f => f.uid === chosenFeed) ?? feeds[0]
  const articlesQuery = useRSSItems(feed?.uid ?? '')

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

  const needle = articleSearch.trim().toLowerCase()
  const articles = (articlesQuery.data?.articles ?? []).filter(a => !needle || a.title.toLowerCase().includes(needle) || a.description?.toLowerCase().includes(needle))
  const note = (text: string) => <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>

  return (
    // The page fills the screen and the section's list scrolls on its own.
    <div className={FILL_PAGE}>
      <PageHeader title={t('RSS')} />
      <nav aria-label={t('RSS sections')} className="flex flex-wrap gap-0.5">
        {SECTIONS.map(item => (
          <Button key={item.id} size="sm" variant={section === item.id ? 'secondary' : 'ghost'} className="px-2" aria-current={section === item.id ? 'page' : undefined} onClick={() => setSection(item.id)}>
            {item.title}
          </Button>
        ))}
      </nav>

      <Card className="min-h-0 flex-1">
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
          {section === 'articles' && (
            <>
              <div className="flex items-center gap-1">
                <SearchInput className={RSS_SEARCH} aria-label={t('Filter articles')} placeholder={t('Search')} title={withKeys(t('Search'), 'S')} data-key="s" value={articleSearch} onValueChange={setArticleSearch} />
                <div className={RSS_TOOLS}>
                <NativeSelect className="min-w-0 flex-1 sm:w-56 sm:flex-none" aria-label={t('Feed')} value={feed?.uid ?? ''} disabled={feeds.length === 0} onChange={(e) => setChosenFeed(e.target.value)}>
                  {feeds.map(f => <option key={f.uid} value={f.uid}>{f.unreadCount > 0 ? `${f.title} (${f.unreadCount})` : f.title}</option>)}
                </NativeSelect>
                <Button variant="outline" size="icon" className="shrink-0" aria-label={t('Mark all as read')} title={t('Mark all as read')} disabled={!feed || feed.unreadCount === 0} onClick={() => feed && setReadAll(feed.path)}><CheckCheck /></Button>
                <Button variant="outline" size="icon" className="shrink-0" aria-label={t('Refresh')} title={t('Refresh')} disabled={!feed} onClick={() => feed && refresh(feed.path, t('Refreshing feed'))}><RefreshCw /></Button>
                </div>
              </div>
              <div className={RSS_LIST}>
                {feedsQuery.isLoading ? note(t('Loading feeds...'))
                  : !feed ? note(t('No feeds yet. Add one with +.'))
                  : articlesQuery.isLoading ? note(t('Loading articles...'))
                  : articles.length === 0 ? note(needle ? t('No matching entries') : t('No articles'))
                  : <ArticleList articles={articles} feedNames={[feed.title, feed.path.split('\\').at(-1) ?? '']} onOpened={a => { if (!a.isRead) void markRead(feed.path, a.id) }} onDownload={addTorrent} />}
              </div>
            </>
          )}
          {section === 'feeds' && (
            <>
              <div className="flex items-center gap-1">
                <SearchInput className={RSS_SEARCH} aria-label={t('Filter feeds')} placeholder={t('Search')} title={withKeys(t('Search'), 'S')} data-key="s" value={feedSearch} onValueChange={setFeedSearch} />
                <div className={RSS_TOOLS}>
                <Button variant="outline" size="icon" className="shrink-0" aria-label={t('Refresh all feeds')} title={t('Refresh all feeds')} disabled={feeds.length === 0} onClick={() => refresh('', t('Refreshing all feeds'))}><RefreshCw /></Button>
                <Button variant="outline" size="icon" className="shrink-0" aria-label={t('New folder')} title={t('New folder')} onClick={() => setPrompt({ kind: 'addFolder' })}><FolderPlus /></Button>
                <Button variant="outline" size="icon" className="shrink-0" aria-label={t('Add feed')} title={withKeys(t('Add feed'), 'N')} data-key="n" onClick={() => setPrompt({ kind: 'addFeed' })}><Plus /></Button>
                </div>
              </div>
              <div className={RSS_LIST}>
                {feedsQuery.isLoading ? note(t('Loading feeds...')) : (
                  // Picking a feed shows its articles.
                  <FeedTree feeds={feeds} folders={folders} search={feedSearch} selected={feed?.uid ?? null} onSelect={(uid) => { setChosenFeed(uid); setSection('articles') }} onRefresh={refresh} onMarkRead={setReadAll} onPrompt={setPrompt} />
                )}
              </div>
            </>
          )}
          {section === 'rules' && <RSSRules />}
        </CardContent>
      </Card>
      {prompt && <RSSPromptDialog prompt={prompt} folders={folders} onClose={() => setPrompt(null)} />}
      <Dialog open={readAll !== null} onOpenChange={(open) => { if (!open) setReadAll(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Mark all as read?')}</DialogTitle>
            <DialogDescription>{t('Every article in {name} is marked as read.', { name: rssName(readAll ?? '') })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReadAll(null)}>{t('Cancel')}</Button>
            <Button onClick={() => { if (readAll !== null) void markRead(readAll); setReadAll(null) }}><CheckCheck />{t('Mark all as read')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
