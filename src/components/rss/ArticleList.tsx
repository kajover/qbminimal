import { Download, ExternalLink, Rss } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { RSSItem } from '@/types'
import { t } from '@/i18n'

interface ArticleListProps {
  articles: RSSItem[]
  onOpened: (article: RSSItem) => void
  onDownload: (url: string) => void
}

// A feed's articles, unread ones in bold. Opening one marks it read.
export function ArticleList({ articles, onOpened, onDownload }: ArticleListProps) {
  if (articles.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">{t('No articles')}</p>
  return (
    <ul className="space-y-2">
      {articles.map(article => {
        const link = article.url || article.link
        return (
          <li key={article.id} className="flex items-start gap-2 rounded-md border p-3">
            <Rss className={cn('mt-1 h-4 w-4 flex-shrink-0', article.isRead ? 'text-muted-foreground' : 'text-primary')} aria-label={article.isRead ? t('Read') : t('Unread')} />
            <div className="min-w-0 flex-1">
              {link ? (
                <a href={link} target="_blank" rel="noopener noreferrer" className={cn('text-sm hover:underline', !article.isRead && 'font-semibold')} onClick={() => onOpened(article)}>{article.title}</a>
              ) : (
                <p className={cn('text-sm', !article.isRead && 'font-semibold')}>{article.title}</p>
              )}
              {article.date && <p className="text-xs text-muted-foreground">{new Date(article.date).toLocaleString()}</p>}
              {article.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{article.description}</p>}
            </div>
            {article.torrentUrl && (
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t('Download {title}', { title: article.title })} title={t('Add the torrent')} onClick={() => onDownload(article.torrentUrl!)}>
                <Download className="h-4 w-4" />
              </Button>
            )}
            {link && (
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                <a href={link} target="_blank" rel="noopener noreferrer" aria-label={t('Open {title}', { title: article.title })} title={t('Open article')} onClick={() => onOpened(article)}><ExternalLink className="h-4 w-4" /></a>
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
