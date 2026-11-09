import { useEffect, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Loader2, Upload, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/PageHeader'
import { FreeSpaceHint } from './FreeSpaceHint'
import { Checkbox } from '@/components/ui/checkbox'
import { TorrentFilePicker } from './TorrentFilePicker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCategories, useTags, useWebApiVersion } from '@/hooks/useApi'
import { supportsFeature } from '@/lib/apiVersion'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import {
  DEFAULT_ADD_OPTIONS,
  buildAddParams,
  describeAddResult,
  parseLinks,
  readMetadata,
  type AddTorrentOptions,
  type TorrentMetadata,
} from '@/lib/addTorrent'
import { onIncoming, takeIncoming } from '@/lib/incoming'
import { TorrentCreator } from './TorrentCreator'
import { t } from '@/i18n'

const selectClass = 'border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm'
const METADATA_POLL_MS = 1500
const METADATA_TIMEOUT_MS = 60000
const METADATA_DEBOUNCE_MS = 600

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function TriSelect({ id, value, onChange, labels }: { id: string; value: string; onChange: (value: '' | 'true' | 'false') => void; labels: [string, string, string] }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value as '' | 'true' | 'false')} className={selectClass}>
      <option value="">{labels[0]}</option>
      <option value="true">{labels[1]}</option>
      <option value="false">{labels[2]}</option>
    </select>
  )
}

function CheckField({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(!!value)} />
      <Label htmlFor={id} className="text-sm font-normal">{label}</Label>
    </div>
  )
}

export function AddTorrentView() {
  const queryClient = useQueryClient()
  const { data: categories } = useCategories()
  const { data: tags } = useTags()
  const [links, setLinks] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [options, setOptions] = useState<AddTorrentOptions>(DEFAULT_ADD_OPTIONS)
  const [showOptions, setShowOptions] = useState(false)
  const [showCreator, setShowCreator] = useState(false)
  const [adding, setAdding] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Choosing files before adding only works for a single link, as qBittorrent requires.
  const [metadata, setMetadata] = useState<TorrentMetadata | null>(null)
  const [metadataSource, setMetadataSource] = useState<string | null>(null)
  const [priorities, setPriorities] = useState<number[]>([])
  const [fetchingMetadata, setFetchingMetadata] = useState(false)
  const [metadataError, setMetadataError] = useState<string | null>(null)
  const fetchRun = useRef(0)
  const { data: webApiVersion } = useWebApiVersion()
  const metadataSupported = supportsFeature(webApiVersion, 'metadata')

  const linkList = parseLinks(links)
  const sourceCount = linkList.length + files.length
  // qBittorrent can apply a file choice to one torrent at a time, from a link or a .torrent file.
  const singleSource = linkList.length === 1 && files.length === 0 ? linkList[0] : linkList.length === 0 && files.length === 1 ? files[0] : null
  const canChooseFiles = singleSource !== null
  const sourceKey = typeof singleSource === 'string' ? singleSource : singleSource ? `file:${singleSource.name}:${singleSource.size}` : null
  // The file choice belongs to the source it was read from.
  const activeMetadata = metadata && metadataSource === sourceKey && canChooseFiles ? metadata : null

  // Stops a running file-list request when the page closes.
  useEffect(() => () => { fetchRun.current++ }, [])

  const set = <K extends keyof AddTorrentOptions>(key: K, value: AddTorrentOptions[K]) => setOptions(prev => ({ ...prev, [key]: value }))

  const keepFiles = (torrents: File[]) =>
    setFiles(prev => [...prev, ...torrents.filter(file => !prev.some(p => p.name === file.name && p.size === file.size))])
  const addFiles = (list: FileList | null) => {
    const torrents = Array.from(list ?? []).filter(file => file.name.toLowerCase().endsWith('.torrent'))
    if (list?.length && torrents.length < list.length) toast.error(t('Only .torrent files can be added'))
    keepFiles(torrents)
  }

  // Files dropped elsewhere on the page and magnet links opened with the app land here.
  useEffect(() => {
    const take = () => {
      const incoming = takeIncoming()
      if (incoming.links.length) setLinks(prev => [prev.trim(), ...incoming.links].filter(Boolean).join('\n'))
      if (incoming.files.length) keepFiles(incoming.files)
    }
    take()
    return onIncoming(take)
  }, [])

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const stopFetching = () => {
    fetchRun.current++
    setFetchingMetadata(false)
    setMetadataError(t('Stopped'))
  }

  const fetchFileList = async () => {
    const run = ++fetchRun.current
    setFetchingMetadata(true)
    setMetadata(null)
    setMetadataError(null)
    const started = Date.now()
    if (singleSource instanceof File) {
      try {
        // qBittorrent reads the file and keeps it, so it can be added by hash with the chosen files.
        const [parsed] = await qbitClient.parseMetadata([singleSource])
        const found = readMetadata(parsed)
        const hash = (parsed as { hash?: string } | undefined)?.hash
        if (fetchRun.current !== run) return
        if (!found || !hash) throw new Error(t('qBittorrent didn\'t return the file list'))
        setMetadata({ ...found, hash })
        setMetadataSource(sourceKey)
        setPriorities(found.files.map(() => 1))
      } catch (error) {
        if (fetchRun.current !== run) return
        const message = error instanceof Error ? error.message : ''
        setMetadataError(message.includes('404') ? t('This needs qBittorrent 5.2 or newer.') : message || t('Couldn\'t read the .torrent file'))
      } finally {
        if (fetchRun.current === run) setFetchingMetadata(false)
      }
      return
    }
    const source = linkList[0]
    try {
      while (fetchRun.current === run) {
        const found = readMetadata(await qbitClient.fetchMetadata(source))
        if (fetchRun.current !== run) return
        if (found) {
          setMetadata(found)
          setMetadataSource(source)
          setPriorities(found.files.map(() => 1))
          return
        }
        if (Date.now() - started > METADATA_TIMEOUT_MS) {
          setMetadataError(t('Couldn\'t get the file list in time. A magnet link needs peers to share it. You can still add the torrent without choosing files.'))
          return
        }
        await new Promise(resolve => setTimeout(resolve, METADATA_POLL_MS))
      }
    } catch (error) {
      if (fetchRun.current !== run) return
      const message = error instanceof Error ? error.message : ''
      setMetadataError(message.includes('404') ? t('This needs qBittorrent 5.2 or newer.') : message || t('Couldn\'t get the file list'))
    } finally {
      if (fetchRun.current === run) setFetchingMetadata(false)
    }
  }

  // Looks up the file list on its own once the single source stops changing.
  const fetchRef = useRef(fetchFileList)
  useEffect(() => { fetchRef.current = fetchFileList })
  useEffect(() => {
    fetchRun.current++
    setFetchingMetadata(false)
    setMetadataError(null)
    if (!metadataSupported || !sourceKey) return
    const timer = setTimeout(() => { void fetchRef.current() }, METADATA_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [sourceKey, metadataSupported])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (sourceCount === 0) {
      toast.error(t('Add a link or a .torrent file'))
      return
    }
    // A .torrent read for its file list is added by hash, which picks up the copy qBittorrent kept.
    const addByHash = activeMetadata?.hash && singleSource instanceof File ? activeMetadata.hash : null
    const params = buildAddParams(options, addByHash ? [addByHash] : linkList, sourceCount)
    if (typeof params === 'string') {
      toast.error(params)
      return
    }
    if (activeMetadata && priorities.every(priority => priority === 0)) {
      toast.error(t('Choose at least one file to download'))
      return
    }

    setAdding(true)
    try {
      const result = await qbitClient.addTorrents(params, addByHash ? [] : files, activeMetadata ? priorities : undefined)
      const { ok, message } = describeAddResult(result, sourceCount)
      if (ok) {
        toast.success(message)
        setLinks('')
        setFiles([])
        setMetadata(null)
        setOptions(prev => ({ ...prev, rename: '' }))
        if (fileInputRef.current) fileInputRef.current.value = ''
      } else {
        toast.error(message)
      }
      queryClient.invalidateQueries({ queryKey: ['torrents'] })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      toast.error(t('Couldn\'t add the torrent'), {
        description: message.includes('409') ? t('qBittorrent rejected it. It may already be in your list, or the link may be invalid.') : message || undefined,
      })
    } finally {
      setAdding(false)
    }
  }

  const categoryNames = Object.keys(categories ?? {}).sort()

  return (
    <div className="space-y-4">
      <PageHeader title={t('Add')} description={t('Add torrents, or create your own')} />
      <Card>
        <CardHeader>
          <CardTitle>{t('Add torrents')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <Field label={t('Magnet or torrent links, one per line')} htmlFor="add-links">
              <textarea
                id="add-links"
                rows={3}
                value={links}
                onChange={(e) => setLinks(e.target.value)}
                placeholder={t('magnet:?xt=...')}
                className="border-input dark:bg-input/30 w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              />
            </Field>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`space-y-2 rounded-md border border-dashed p-3 text-sm ${dragging ? 'border-primary bg-muted' : ''}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="me-2 h-4 w-4" />
                  {t('Choose .torrent files')}
                </Button>
                <span className="text-xs text-muted-foreground">{t('or drop them here')}</span>
                <input ref={fileInputRef} type="file" accept=".torrent,application/x-bittorrent" multiple className="hidden" aria-label={t('Torrent files')} onChange={(e) => addFiles(e.target.files)} />
              </div>
              {files.length > 0 && (
                <ul className="space-y-1">
                  {files.map(file => (
                    <li key={`${file.name}-${file.size}`} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate" title={file.name}>{file.name}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label={t('Remove {name}', { name: file.name })} onClick={() => setFiles(prev => prev.filter(f => f !== file))}>
                        <X className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {canChooseFiles && (
              <div className="space-y-2 rounded-md border p-3 text-sm">
                {!activeMetadata ? (
                  <div className="flex flex-wrap items-center gap-2" aria-live="polite">
                    {fetchingMetadata ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{t('Getting file list...')}</span>
                        <Button type="button" size="sm" variant="ghost" onClick={stopFetching}>{t('Cancel')}</Button>
                        {!(singleSource instanceof File) && <span className="w-full text-xs text-muted-foreground">{t('A magnet link needs peers to share the file list.')}</span>}
                      </>
                    ) : (
                      <>
                        {metadataError && <span className="text-xs text-destructive">{metadataError}</span>}
                        <Button type="button" size="sm" variant="outline" onClick={fetchFileList}>
                          {metadataError ? t('Retry') : t('Choose files first')}
                        </Button>
                        {!metadataError && <span className="text-xs text-muted-foreground">{singleSource instanceof File ? t('Optional.') : t('Optional. Magnet links need peers to share the list.')}</span>}
                      </>
                    )}
                  </div>
                ) : (
                  <TorrentFilePicker metadata={activeMetadata} priorities={priorities} onChange={setPriorities} />
                )}
              </div>
            )}

            <Button type="button" variant="ghost" size="sm" className="-ms-3" aria-expanded={showOptions} onClick={() => setShowOptions(!showOptions)}>
              {showOptions ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 rtl:rotate-180" />}
              {t('More options')}
            </Button>

            {showOptions && (
              <div className="space-y-3 rounded-md border p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label={t('Category')} htmlFor="add-category">
                    <select id="add-category" value={options.category} onChange={(e) => set('category', e.target.value)} className={selectClass}>
                      <option value="">{t('No category')}</option>
                      {categoryNames.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </Field>
                  <Field label={t('Tags, separated by commas')} htmlFor="add-tags">
                    <Input id="add-tags" list="add-tag-list" value={options.tags} onChange={(e) => set('tags', e.target.value)} className="h-9" />
                    <datalist id="add-tag-list">{(tags ?? []).map(tag => <option key={tag} value={tag} />)}</datalist>
                  </Field>
                </div>

                <Field label={t('Save path (blank = default)')} htmlFor="add-save-path">
                  <Input id="add-save-path" value={options.savePath} onChange={(e) => set('savePath', e.target.value)} className="h-9" />
                  <FreeSpaceHint path={options.savePath} />
                </Field>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label={t('When added')} htmlFor="add-start">
                    <TriSelect id="add-start" value={options.start} onChange={(value) => set('start', value)} labels={["qBittorrent's default", 'Start', "Don't start"]} />
                  </Field>
                  <Field label={t('Stop when')} htmlFor="add-stop-condition">
                    <select id="add-stop-condition" value={options.stopCondition} disabled={options.start === 'false'} onChange={(e) => set('stopCondition', e.target.value as AddTorrentOptions['stopCondition'])} className={selectClass}>
                      <option value="None">{t('Never')}</option>
                      <option value="MetadataReceived">{t('Metadata is received')}</option>
                      <option value="FilesChecked">{t('Files are checked')}</option>
                    </select>
                  </Field>
                  <Field label={t('Content layout')} htmlFor="add-layout">
                    <select id="add-layout" value={options.contentLayout} onChange={(e) => set('contentLayout', e.target.value as AddTorrentOptions['contentLayout'])} className={selectClass}>
                      <option value="">{t('qBittorrent\'s default')}</option>
                      <option value="Original">{t('Original')}</option>
                      <option value="Subfolder">{t('Create subfolder')}</option>
                      <option value="NoSubfolder">{t('Don\'t create subfolder')}</option>
                    </select>
                  </Field>
                  <Field label={t('Automatic management')} htmlFor="add-auto-tmm">
                    <TriSelect id="add-auto-tmm" value={options.autoTMM} onChange={(value) => set('autoTMM', value)} labels={["qBittorrent's default", 'On', 'Off']} />
                  </Field>
                  <Field label={t('Add to top of queue')} htmlFor="add-queue-top">
                    <TriSelect id="add-queue-top" value={options.addToTopOfQueue} onChange={(value) => set('addToTopOfQueue', value)} labels={["qBittorrent's default", 'Yes', 'No']} />
                  </Field>
                  <Field label={t('Separate folder for incomplete files')} htmlFor="add-use-download-path">
                    <TriSelect id="add-use-download-path" value={options.useDownloadPath} onChange={(value) => set('useDownloadPath', value)} labels={["qBittorrent's default", 'Yes', 'No']} />
                  </Field>
                </div>

                {options.useDownloadPath === 'true' && (
                  <Field label={t('Folder for incomplete files (blank = default)')} htmlFor="add-download-path">
                    <Input id="add-download-path" value={options.downloadPath} onChange={(e) => set('downloadPath', e.target.value)} className="h-9" />
                  </Field>
                )}

                {sourceCount <= 1 && (
                  <Field label={t('Rename torrent (blank = keep its name)')} htmlFor="add-rename">
                    <Input id="add-rename" value={options.rename} onChange={(e) => set('rename', e.target.value)} className="h-9" />
                  </Field>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('Download limit (KiB/s)')} htmlFor="add-dl-limit">
                    <Input id="add-dl-limit" type="number" min={0} placeholder={t('No limit')} value={options.dlLimitKiB} onChange={(e) => set('dlLimitKiB', e.target.value)} className="h-9" />
                  </Field>
                  <Field label={t('Upload limit (KiB/s)')} htmlFor="add-up-limit">
                    <Input id="add-up-limit" type="number" min={0} placeholder={t('No limit')} value={options.upLimitKiB} onChange={(e) => set('upLimitKiB', e.target.value)} className="h-9" />
                  </Field>
                </div>

                <Field label={t('Seeding limits')} htmlFor="add-share-mode">
                  <select id="add-share-mode" value={options.shareLimits.mode} onChange={(e) => set('shareLimits', { ...options.shareLimits, mode: e.target.value as AddTorrentOptions['shareLimits']['mode'] })} className={selectClass}>
                    <option value="global">{t('qBittorrent\'s global limits')}</option>
                    <option value="none">{t('No limit')}</option>
                    <option value="custom">{t('Custom limits')}</option>
                  </select>
                </Field>
                {options.shareLimits.mode === 'custom' && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <Field label={t('Ratio')} htmlFor="add-ratio">
                      <Input id="add-ratio" type="number" min={0} step="any" placeholder={t('No limit')} value={options.shareLimits.ratio} onChange={(e) => set('shareLimits', { ...options.shareLimits, ratio: e.target.value })} className="h-9" />
                    </Field>
                    <Field label={t('Seeding time (minutes)')} htmlFor="add-seeding-time">
                      <Input id="add-seeding-time" type="number" min={0} step={1} placeholder={t('No limit')} value={options.shareLimits.seedingMinutes} onChange={(e) => set('shareLimits', { ...options.shareLimits, seedingMinutes: e.target.value })} className="h-9" />
                    </Field>
                    <Field label={t('Inactive time (minutes)')} htmlFor="add-inactive-time">
                      <Input id="add-inactive-time" type="number" min={0} step={1} placeholder={t('No limit')} value={options.shareLimits.inactiveMinutes} onChange={(e) => set('shareLimits', { ...options.shareLimits, inactiveMinutes: e.target.value })} className="h-9" />
                    </Field>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <CheckField id="add-skip-check" label={t('Skip hash check')} checked={options.skipChecking} onChange={(value) => set('skipChecking', value)} />
                  <CheckField id="add-sequential" label={t('Sequential download')} checked={options.sequentialDownload} onChange={(value) => set('sequentialDownload', value)} />
                  <CheckField id="add-first-last" label={t('First and last pieces first')} checked={options.firstLastPiecePrio} onChange={(value) => set('firstLastPiecePrio', value)} />
                  <CheckField id="add-forced" label={t('Force start')} checked={options.forced} onChange={(value) => set('forced', value)} />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={adding}>
              {adding && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {sourceCount > 1 ? t('Add {sourceCount} torrents', { sourceCount }) : t('Add torrent')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Button type="button" variant="ghost" size="sm" className="-ms-3" aria-expanded={showCreator} onClick={() => setShowCreator(!showCreator)}>
        {showCreator ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 rtl:rotate-180" />}
        {t('Create a torrent')}
      </Button>
      {showCreator && <TorrentCreator />}
    </div>
  )
}
