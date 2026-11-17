import { useEffect, useState, type FormEvent } from 'react'
import { Loader2, Plus, Puzzle, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { NativeSelect } from '@/components/NativeSelect'
import { SearchInput } from '@/components/SearchInput'
import { PageHeader } from '@/components/PageHeader'
import { useSearchPlugins } from '@/hooks/useApi'
import { useSearchJob } from '@/hooks/useSearchJob'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import { formatBytes } from '@/lib/format'
import type { SavedSearch } from '@/lib/searchPatterns'
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
  const [toolbarSlot, setToolbarSlot] = useState<HTMLDivElement | null>(null)
  const [adding, setAdding] = useState<SearchResult | null>(null)
  const [addBusy, setAddBusy] = useState(false)

  // S or / goes to the search field, as on the torrent list. Not while typing or in a window.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.metaKey || event.ctrlKey || event.altKey || target.closest?.('input, textarea, select, [contenteditable="true"]') || document.querySelector('[role="dialog"], [role="menu"]')) return
      if (event.key === '/' || event.key.toLowerCase() === 's') {
        event.preventDefault()
        document.getElementById('search-pattern')?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const enabled = (plugins ?? []).filter(plugin => plugin.enabled)
  // A chosen plugin that's been turned off or removed since falls back to all of them.
  const plugin = enabled.some(p => p.name === pluginChoice) ? pluginChoice : 'enabled'

  const submit = (event: FormEvent) => {
    event.preventDefault()
    // The same button stops a running search, and ignores a click that lands just after it ended.
    if (search.running) void search.cancel()
    else if (pattern.trim() && !search.justEnded()) void search.start(pattern.trim(), plugin, category)
  }

  // Runs a saved search with its own plugin and category, shown in the form too.
  const runAgain = (saved: SavedSearch) => {
    const plugins = enabled.some(p => p.name === saved.plugins) ? saved.plugins : 'enabled'
    setPattern(saved.pattern)
    setPluginChoice(plugins)
    setCategory(saved.category)
    return search.start(saved.pattern, plugins, saved.category)
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
      {/* The results put their filter, columns and view buttons here, as the torrent list does,
          shown before a search too so the view can be picked first. */}
      <PageHeader title={t('Search')} actions={<div ref={setToolbarSlot} className="flex items-center gap-1" />} />
      <Card>
        <CardContent className="space-y-3">
          {/* One row on wide screens. On phones the field and button come first, then the rest. */}
          <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
            <SearchInput id="search-pattern" aria-label={t('Search for')} placeholder={t('Search for...')} value={pattern} onValueChange={setPattern} required className="min-w-0 flex-1 basis-48" />
            {/* While searching, the spinner turns into a stop button under the pointer. */}
            <Button type="submit" className="group max-sm:order-2" aria-label={search.running ? t('Stop search') : t('Search')} title={search.running ? t('Stop search') : t('Search')}>
              {search.running ? (
                <>
                  <Loader2 className="size-4 animate-spin group-hover:hidden group-focus-visible:hidden" />
                  <X className="hidden size-4 group-hover:block group-focus-visible:block" />
                </>
              ) : <Search className="size-4" />}
            </Button>
            <NativeSelect aria-label={t('Search plugin')} value={plugin} onChange={(e) => setPluginChoice(e.target.value)} className="max-w-48 truncate max-sm:order-3">
              <option value="enabled">{t('All enabled plugins')}</option>
              {enabled.map(p => <option key={p.name} value={p.name}>{p.fullName || p.name}</option>)}
            </NativeSelect>
            <NativeSelect aria-label={t('Search category')} value={category} onChange={(e) => setCategory(e.target.value)} className="max-w-48 truncate max-sm:order-3">
              {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
            </NativeSelect>
            <Button type="button" variant="outline" size="icon" className="max-sm:order-3" aria-label={t('Manage plugins')} title={t('Manage plugins')} onClick={() => setPluginsOpen(true)}><Puzzle className="size-4" /></Button>
          </form>
          <SearchHistory activeId={search.jobId} busy={search.running} onOpen={(id) => { if (!search.running) search.open(id) }} onRun={runAgain} onCleared={search.close} />
        </CardContent>
      </Card>

      {/* Keyed by search, so each starts on its first page without the last one's filters. */}
      <SearchResults key={search.jobId ?? 'none'} results={search.results} onAdd={setAdding} toolbarSlot={toolbarSlot} />
      {search.results.length === 0 && search.searched && !search.running && <p className="py-8 text-center text-sm text-muted-foreground">{t('Nothing found')}</p>}

      <SearchPluginsDialog open={pluginsOpen} onOpenChange={setPluginsOpen} />

      <Dialog open={!!adding} onOpenChange={(open) => !open && setAdding(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Add this torrent?')}</DialogTitle>
            <DialogDescription>{t('qBittorrent downloads it with your default settings.')}</DialogDescription>
          </DialogHeader>
          {adding && (
            <div className="space-y-1 text-sm">
              <p className="font-medium wrap-anywhere">{adding.fileName}</p>
              <p className="text-muted-foreground">{formatBytes(adding.fileSize)} · {t('{seeds} seeds · {leeches} leeches', { seeds: adding.nbSeeders, leeches: adding.nbLeechers })}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(null)}>{t('Cancel')}</Button>
            <Button disabled={addBusy} onClick={() => adding && void add(adding)} className="gap-2">
              {addBusy ? <Loader2 className="size-4 animate-spin" /> : <Plus />}
              {t('Add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
