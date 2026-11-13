import { useState, type FormEvent } from 'react'
import { Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import { getRSSParent, joinRSSPath } from '@/lib/rss'
import { rssName, useRSSAction, type Prompt } from './rssActions'
import { t } from '@/i18n'

const selectClass = 'border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm'

// One dialog covers every action that needs typing or choosing something.
export function RSSPromptDialog({ prompt, folders, onClose }: { prompt: Prompt; folders: string[]; onClose: () => void }) {
  const action = useRSSAction()
  const initial = (() => {
    switch (prompt.kind) {
      case 'rename': return rssName(prompt.path)
      case 'move': return getRSSParent(prompt.path)
      case 'url': return prompt.feed.url
      case 'interval': return prompt.feed.refreshInterval ? String(Math.round(prompt.feed.refreshInterval / 60)) : ''
      default: return ''
    }
  })()
  const [value, setValue] = useState(initial)
  const [folder, setFolder] = useState('')

  const run = (work: () => Promise<unknown>, done: string, failed: string) =>
    action.mutateAsync({ work, done, failed }).then(onClose, () => undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const text = value.trim()
    switch (prompt.kind) {
      case 'addFeed':
        if (!text) return
        return run(() => qbitClient.addRSSFeed(text, folder), t('Feed added'), t('Failed to add feed'))
      case 'addFolder':
        if (!text || text.includes('\\')) return toast.error(t('Enter a name without \\'))
        return run(() => qbitClient.addRSSFolder(joinRSSPath(folder, text)), t('Folder created'), t('Failed to create folder'))
      case 'rename':
        if (!text || text.includes('\\')) return toast.error(t('Enter a name without \\'))
        return run(() => qbitClient.moveRSSItem(prompt.path, joinRSSPath(getRSSParent(prompt.path), text)), 'Renamed', t('Failed to rename'))
      case 'move':
        return run(() => qbitClient.moveRSSItem(prompt.path, joinRSSPath(value, rssName(prompt.path))), 'Moved', t('Failed to move'))
      case 'url':
        if (!text) return
        return run(() => qbitClient.setRSSFeedURL(prompt.feed.path, text), t('Feed address changed'), t('Failed to change the feed address'))
      case 'interval': {
        const minutes = text === '' ? 0 : Number(text)
        if (!Number.isInteger(minutes) || minutes < 0) return toast.error(t('Enter whole minutes, or leave it blank'))
        return run(() => qbitClient.setRSSFeedRefreshInterval(prompt.feed.path, minutes * 60), t('Refresh time saved'), t('Failed to save the refresh time'))
      }
      case 'remove':
        return run(() => qbitClient.removeRSSFeed(prompt.path), prompt.isFolder ? t('Folder removed') : t('Feed removed'), t('Failed to remove'))
    }
  }

  const titles: Record<Prompt['kind'], string> = {
    addFeed: t('Add feed'),
    addFolder: t('New folder'),
    rename: t('Rename'),
    move: t('Move to folder'),
    url: t('Change feed address'),
    interval: t('Refresh time'),
    remove: prompt.kind === 'remove' && prompt.isFolder ? t('Remove this folder?') : t('Remove this feed?'),
  }
  const movableFolders = prompt.kind === 'move' ? folders.filter(f => f !== prompt.path && !f.startsWith(`${prompt.path}\\`)) : folders

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titles[prompt.kind]}</DialogTitle>
          {prompt.kind === 'remove' && (
            <DialogDescription>
              {prompt.isFolder ? t('{rssName} and every feed in it will be removed.', { rssName: rssName(prompt.path) }) : t('{rssName} will be removed. Torrents it already added stay.', { rssName: rssName(prompt.path) })}
            </DialogDescription>
          )}
          {prompt.kind === 'interval' && <DialogDescription>{t('Leave it blank to use the time set in Settings > RSS.')}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          {prompt.kind === 'move' ? (
            <select aria-label={t('Folder')} value={value} onChange={(e) => setValue(e.target.value)} className={selectClass}>
              <option value="">{t('Top level')}</option>
              {movableFolders.map(f => <option key={f} value={f}>{f.replaceAll('\\', ' / ')}</option>)}
            </select>
          ) : prompt.kind !== 'remove' && (
            <div className="space-y-1">
              <Label htmlFor="rss-prompt" className="text-xs text-muted-foreground">
                {prompt.kind === 'addFeed' || prompt.kind === 'url' ? t('Feed address') : prompt.kind === 'interval' ? t('Minutes') : t('Name')}
              </Label>
              <Input id="rss-prompt" autoFocus type={prompt.kind === 'interval' ? 'number' : 'text'} min={0} value={value} placeholder={prompt.kind === 'interval' ? t('Default') : undefined} onChange={(e) => setValue(e.target.value)} />
            </div>
          )}
          {(prompt.kind === 'addFeed' || prompt.kind === 'addFolder') && folders.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor="rss-prompt-folder" className="text-xs text-muted-foreground">{t('In folder')}</Label>
              <select id="rss-prompt-folder" value={folder} onChange={(e) => setFolder(e.target.value)} className={selectClass}>
                <option value="">{t('Top level')}</option>
                {folders.map(f => <option key={f} value={f}>{f.replaceAll('\\', ' / ')}</option>)}
              </select>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('Cancel')}</Button>
            <Button type="submit" variant={prompt.kind === 'remove' ? 'destructive' : 'default'} disabled={action.isPending}>
              {prompt.kind === 'remove' ? <Trash2 /> : <Save />}
              {prompt.kind === 'remove' ? t('Remove') : t('Save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

