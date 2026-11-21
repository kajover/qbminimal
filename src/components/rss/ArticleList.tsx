import { Download, ExternalLink, Rss } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { RSSItem } from '@/types'
import { t } from '@/i18n'

interface ArticleListProps {
  articles: RSSItem[]
  // The feed's names, which the feed picker already shows, so they're left off the titles.
  feedNames?: string[]
  onOpened: (article: RSSItem) => void
  onDownload: (url: string) => void
}

// A feed's articles, unread ones in bold, as rows like the Logs page's. Opening one marks it read.
export function ArticleList({ articles, feedNames = [], onOpened, onDownload }: ArticleListProps) {
  // Some feeds start every title with their own name, like "Distro releases: item 1".
  const shown = (title: string) => {
    const lower = title.toLowerCase()
    for (const name of feedNames) {
      if (!name || !lower.startsWith(name.toLowerCase())) continue
      const rest = /^\s*[:\-–—|]\s*(.+)$/.exec(title.slice(name.length))
      if (rest) return rest[1]
    }
    return title
  }
  return (
    <ul className="divide-y">
      {articles.map(article => {
        const link = article.url || article.link
        return (
          <li key={article.id} className="flex items-start gap-2 px-2 py-2 transition-colors hover:bg-muted/60">
            <Rss className={cn('mt-0.5 size-4 shrink-0', article.isRead ? 'text-muted-foreground' : 'text-primary')} aria-label={article.isRead ? t('Read') : t('Unread')} />
            <div className="min-w-0 flex-1">
              {link ? (
                <a href={link} target="_blank" rel="noopener noreferrer" className={cn('text-sm hover:underline', !article.isRead && 'font-semibold')} title={article.title} onClick={() => onOpened(article)}>{shown(article.title)}</a>
              ) : (
                <p className={cn('text-sm', !article.isRead && 'font-semibold')} title={article.title}>{shown(article.title)}</p>
              )}
              {article.date && <p className="text-xs text-muted-foreground">{new Date(article.date).toLocaleString()}</p>}
              {article.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{article.description}</p>}
            </div>
            {article.torrentUrl && (
              <Button variant="ghost" size="icon" className="size-8" aria-label={t('Download {title}', { title: article.title })} title={t('Add the torrent')} onClick={() => onDownload(article.torrentUrl!)}>
                <Download className="size-4" />
              </Button>
            )}
            {link && (
              <Button variant="ghost" size="icon" className="size-8" asChild>
                <a href={link} target="_blank" rel="noopener noreferrer" aria-label={t('Open {title}', { title: article.title })} title={t('Open article')} onClick={() => onOpened(article)}><ExternalLink className="size-4" /></a>
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
