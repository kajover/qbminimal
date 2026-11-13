import { CheckCheck, Clock, Folder, FolderInput, Link, MoreVertical, Pencil, RefreshCw, Trash2, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { getRSSParent } from '@/lib/rss'
import { cn } from '@/lib/utils'
import type { RSSFeed } from '@/types'
import { rssName, type Prompt } from './rssActions'
import { t } from '@/i18n'

const STEP = 12

interface FeedTreeProps {
  feeds: RSSFeed[]
  folders: string[]
  selected: string | null
  onSelect: (uid: string) => void
  onRefresh: (path: string, label: string) => void
  onMarkRead: (path: string) => void
  onPrompt: (prompt: Prompt) => void
}

// qBittorrent's feed folders as a tree, each feed and folder with its own menu.
export function FeedTree({ feeds, folders, selected, onSelect, onRefresh, onMarkRead, onPrompt }: FeedTreeProps) {
  const menu = (label: string, items: [string, LucideIcon, () => void, boolean?][]) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label={t('Actions for {label}', { label })} title={t('Actions')} onClick={(e) => e.stopPropagation()}>
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {items.map(([text, Icon, run, danger]) => <DropdownMenuItem key={text} className={cn(danger && 'text-destructive')} onClick={run}><Icon className="size-4" />{text}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const feedRow = (feed: RSSFeed, depth: number) => (
    <li key={feed.uid}>
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected === feed.uid}
        onClick={() => onSelect(feed.uid)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(feed.uid) } }}
        className={cn('flex cursor-pointer items-start gap-1 rounded-md border p-2.5 hover:bg-accent', selected === feed.uid && 'border-primary')}
        style={{ marginLeft: depth * STEP }}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{feed.title}</span>
          <span className="block truncate text-xs text-muted-foreground">{feed.url}</span>
          <span className="mt-1 flex flex-wrap gap-1 text-xs">
            {feed.unreadCount > 0 && <span className="rounded bg-primary px-1.5 py-0.5 text-primary-foreground">{t('{count} new', { count: feed.unreadCount })}</span>}
            {feed.isLoading && <span className="text-muted-foreground">{t('Refreshing...')}</span>}
            {feed.hasError && <span className="text-destructive">{t('Couldn\'t fetch')}</span>}
          </span>
        </span>
        {menu(feed.title, [
          [t('Refresh'), RefreshCw, () => onRefresh(feed.path, t('Refreshing feed'))],
          [t('Mark all as read'), CheckCheck, () => onMarkRead(feed.path)],
          [t('Rename'), Pencil, () => onPrompt({ kind: 'rename', path: feed.path, isFolder: false })],
          [t('Move to folder'), FolderInput, () => onPrompt({ kind: 'move', path: feed.path })],
          [t('Change address'), Link, () => onPrompt({ kind: 'url', feed })],
          [t('Refresh time'), Clock, () => onPrompt({ kind: 'interval', feed })],
          [t('Remove'), Trash2, () => onPrompt({ kind: 'remove', path: feed.path, isFolder: false }), true],
        ])}
      </div>
    </li>
  )

  // `parent` is '' for the top level. Folders come before feeds at each level.
  const level = (parent: string, depth: number) => (
    <>
      {folders.filter(path => getRSSParent(path) === parent).map(path => (
        <li key={`folder:${path}`} className="space-y-2">
          <div className="flex items-center gap-1 text-sm font-medium" style={{ marginLeft: depth * STEP }}>
            <Folder className="size-4 text-yellow-500" />
            <span className="min-w-0 flex-1 truncate">{rssName(path)}</span>
            {menu(t('folder {name}', { name: rssName(path) }), [
              [t('Refresh'), RefreshCw, () => onRefresh(path, t('Refreshing folder'))],
              [t('Mark all as read'), CheckCheck, () => onMarkRead(path)],
              [t('Rename'), Pencil, () => onPrompt({ kind: 'rename', path, isFolder: true })],
              [t('Move to folder'), FolderInput, () => onPrompt({ kind: 'move', path })],
              [t('Remove'), Trash2, () => onPrompt({ kind: 'remove', path, isFolder: true }), true],
            ])}
          </div>
          <ul className="space-y-2">{level(path, depth + 1)}</ul>
        </li>
      ))}
      {feeds.filter(feed => getRSSParent(feed.path) === parent).map(feed => feedRow(feed, depth))}
    </>
  )

  if (feeds.length === 0 && folders.length === 0) return <p className="text-sm text-muted-foreground">{t('No feeds yet. Add one with +.')}</p>
  return <ul className="space-y-2">{level('', 0)}</ul>
}
