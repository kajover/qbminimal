import { useState, type FormEvent } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/NativeSelect'
import { PageHeader } from '@/components/PageHeader'
import { useSearchPlugins } from '@/hooks/useApi'
import { useSearchJob } from '@/hooks/useSearchJob'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import { formatBytes } from '@/lib/format'
import type { SearchResult } from '@/types'
import { SearchHistory } from './SearchHistory'
import { SearchPluginsDialog } from './SearchPluginsDialog'
import { SearchResults } from './SearchResults'
import { t } from '@/i18n'

// qBittorrent's own search categories.
const CATEGORIES: [value: string, label: string][] = [
  ['all', 'All categories'], ['anime', 'Anime'], ['books', 'Books'], ['games', 'Games'], ['movies', 'Movies'],
  ['music', 'Music'], ['pictures', 'Pictures'], ['software', 'Software'], ['tv', 'TV shows'],
]

export function SearchView() {
  const search = useSearchJob()
  const { data: plugins } = useSearchPlugins()
  const [pattern, setPattern] = useState('')
  const [pluginChoice, setPluginChoice] = useState('enabled')
  const [category, setCategory] = useState('all')
  const [pluginsOpen, setPluginsOpen] = useState(false)
  const [adding, setAdding] = useState<SearchResult | null>(null)
  const [addBusy, setAddBusy] = useState(false)

  const enabled = (plugins ?? []).filter(plugin => plugin.enabled)
  // A chosen plugin that's been turned off or removed since falls back to all of them.
  const plugin = enabled.some(p => p.name === pluginChoice) ? pluginChoice : 'enabled'

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (pattern.trim()) void search.start(pattern.trim(), plugin, category)
  }

  const add = async (result: SearchResult) => {
    setAddBusy(true)
    try {
      // The plugin fetches the .torrent itself when it can, for sites that need its login.
      await (result.engineName ? qbitClient.downloadSearchTorrent(result.fileUrl, result.engineName) : qbitClient.addTorrentUrl(result.fileUrl))
      toast.success(t('Added to qBittorrent'))
      setAdding(null)
    } catch (error) {
      toast.error(t('Couldn\'t add the torrent'), { description: error instanceof Error ? error.message : undefined })
    } finally {
      setAddBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('Search')} description={t('Find torrents with qBittorrent\'s search plugins')} />
      <Card>
        <CardContent className="space-y-3">
          <form onSubmit={submit} className="space-y-2">
            <div className="flex gap-2">
              <Input type="search" aria-label={t('Search for')} placeholder={t('Search for...')} value={pattern} onChange={(e) => setPattern(e.target.value)} required />
              <Button type="submit" disabled={search.running} aria-label={t('Search')} title={t('Search')}>
                {search.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
              {search.running && (
                <Button type="button" variant="ghost" size="icon" aria-label={t('Stop search')} title={t('Stop search')} onClick={() => void search.cancel()}><X className="h-4 w-4" /></Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NativeSelect aria-label={t('Search plugin')} value={plugin} onChange={(e) => setPluginChoice(e.target.value)}>
                <option value="enabled">{t('All enabled plugins')}</option>
                {enabled.map(p => <option key={p.name} value={p.name}>{p.fullName || p.name}</option>)}
              </NativeSelect>
              <NativeSelect aria-label={t('Search category')} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
              </NativeSelect>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPluginsOpen(true)}>{t('Manage plugins')}</Button>
          </form>
          <SearchHistory activeId={search.jobId} onOpen={(id) => { if (!search.running) search.open(id) }} />
        </CardContent>
      </Card>

      {search.results.length > 0 ? <SearchResults results={search.results} onAdd={setAdding} />
        : search.searched && !search.running && <p className="py-8 text-center text-sm text-muted-foreground">{t('Nothing found')}</p>}

      <SearchPluginsDialog open={pluginsOpen} onOpenChange={setPluginsOpen} />

      <Dialog open={!!adding} onOpenChange={(open) => !open && setAdding(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Add this torrent?')}</DialogTitle>
            <DialogDescription>{t('qBittorrent downloads it with your default settings.')}</DialogDescription>
          </DialogHeader>
          {adding && (
            <div className="space-y-1 text-sm">
              <p className="font-medium [overflow-wrap:anywhere]">{adding.fileName}</p>
              <p className="text-muted-foreground">{formatBytes(adding.fileSize)} · {t('{seeds} seeds · {leeches} leeches', { seeds: adding.nbSeeders, leeches: adding.nbLeechers })}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(null)}>{t('Cancel')}</Button>
            <Button disabled={addBusy} onClick={() => adding && void add(adding)} className="gap-2">
              {addBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('Add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
