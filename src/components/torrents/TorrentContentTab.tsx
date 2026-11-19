import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Check, ChevronDown, ChevronRight, Download, File, Folder, Pencil, SquareMinus, SquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { NativeSelect } from '@/components/NativeSelect'
import { Input } from '@/components/ui/input'
import { useApiFeature, useSetFilePriority, useTorrentAction, useTorrentFiles } from '@/hooks/useApi'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import { getFileDownloadUrl } from '@/lib/fileDownloads'
import { getNameProblem, getRenamedPath } from '@/lib/filePaths'
import { allNodePaths, buildFileTree, filterFileTree, folderPaths, sortFileTree, type FileSortField, type FileTreeNode } from '@/lib/fileTree'
import { disguiseFiles, useIncognito } from '@/lib/incognito'
import { CopyButton } from '@/components/CopyButton'
import { SearchInput } from '@/components/SearchInput'
import { nextSort, SortMenu, SortTitle, type ListSort } from './DetailsSort'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { TorrentFile } from '@/types'
import { t } from '@/i18n'

const INDENT = 16
// Names from A, folders first, until another order is picked.
const DEFAULT_SORT: ListSort<FileSortField> = { field: 'name', descending: false }
// The columns after the name, shared by the title row and every file row so they line up.
// Numbers start at the start edge of their column, like the other tabs' tables. Phones show
// progress, size and priority under the name instead, which leaves the name room to show whole.
// A gap after the percentage, before the size.
const PROGRESS_COL = 'w-36 shrink-0 pe-4 tabular-nums max-sm:hidden'
const SIZE_COL = 'w-20 shrink-0 truncate tabular-nums max-sm:hidden'
const PRIORITY_COL = 'w-36 shrink-0'

// qBittorrent's file priorities, as its own file list offers them.
const PRIORITIES: [number, string][] = [[0, t("Don't download")], [1, t('Normal')], [6, t('High')], [7, t('Maximum')]]
const MIXED = -1

// Finished files can be saved straight from qBittorrent 5.3. Otherwise the button explains why not.
function DownloadLink({ hash, file, canServe }: { hash: string; file: TorrentFile; canServe: boolean }) {
  const reason = !canServe ? t('Downloading files needs qBittorrent 5.3 or newer.') : file.progress < 1 ? t('This file isn\'t fully downloaded yet.') : null
  if (reason) {
    // A disabled button ignores the pointer, so the wrapper carries the tooltip.
    return (
      <span className="inline-flex cursor-not-allowed" title={reason} onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="size-6" disabled aria-label={t('Download {name}: {reason}', { name: file.name, reason })}><Download className="size-3" /></Button>
      </span>
    )
  }
  return (
    <Button variant="ghost" size="icon" className="size-6" asChild>
      <a href={getFileDownloadUrl(hash, file.index)} download={file.name.split('/').pop()} target="_blank" rel="noopener" title={t('Download')} aria-label={t('Download {name}', { name: file.name })} onClick={(e) => e.stopPropagation()}>
        <Download className="size-3" />
      </a>
    </Button>
  )
}

// A bar and the whole percent, rounded down so only a finished file reads 100%.
function ProgressCell({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('flex items-center gap-1.5', className)}>
      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary">
        <span className="block h-full bg-primary" style={{ width: `${Math.min(1, Math.max(0, value)) * 100}%` }} />
      </span>
      <span className="w-8 shrink-0 text-end text-muted-foreground">{Math.floor(value * 100)}%</span>
    </span>
  )
}

function RenameRow({ path, depth, onSave, onCancel }: { path: string; depth: number; onSave: (name: string) => Promise<boolean>; onCancel: () => void }) {
  const current = path.split('/').pop() ?? path
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = String(new FormData(event.currentTarget).get('name') ?? '').trim()
    const problem = getNameProblem(name)
    if (problem) return void toast.error(problem)
    if (name === current) return onCancel()
    setBusy(true)
    if (!(await onSave(name))) setBusy(false)
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-2 px-2 py-1" style={{ paddingInlineStart: 8 + depth * INDENT }}>
      {/* Wide enough for a long name, not the whole row. */}
      <Input name="name" defaultValue={current} autoFocus aria-label={t('New name for {current}', { current })} wrapperClassName="max-w-md" className="h-7 text-xs" />
      <Button type="submit" size="sm" variant="outline" className="h-7 text-xs" disabled={busy}><Check />{t('Save')}</Button>
      <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>{t('Cancel')}</Button>
    </form>
  )
}

// The torrent's files as folders and files, like qBittorrent's own list: the box beside each one
// downloads it or not, a folder's box everything inside it, and the priority sets how soon. Tapping
// a folder's row opens or closes it.
export function TorrentContentTab({ hash, savePath }: { hash: string; savePath?: string }) {
  const { data: files, isLoading } = useTorrentFiles(hash)
  const setPriority = useSetFilePriority()
  const action = useTorrentAction()
  const canServe = useApiFeature('fileDownload')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  // Rows opened on phones for their details.
  const [details, setDetails] = useState<Set<string>>(new Set())
  const toggleDetails = (path: string) => setDetails(current => {
    const next = new Set(current)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    return next
  })
  // Names from A until a column is picked; the titles mark only an order picked.
  const [picked, setPicked] = useState<ListSort<FileSortField> | null>(null)
  const sort = picked ?? DEFAULT_SORT
  const noSort = { field: '' as FileSortField, descending: false }
  const sortBy = (field: FileSortField) => setPicked(nextSort(picked ?? noSort, field, field !== 'name'))
  // In incognito mode the names are made up, so renaming, which works from them, is off.
  const incognito = useIncognito()
  const fullTree = useMemo(() => buildFileTree(incognito ? disguiseFiles(files ?? [], hash) : files ?? []), [files, incognito, hash])

  const prioritize = (indexes: number[], priority: number) =>
    setPriority.mutateAsync({ hash, id: indexes.join('|'), priority }).catch(() => toast.error(t('Couldn\'t change which files download')))
  const priorityOf = useMemo(() => new Map((files ?? []).map(file => [file.index, file.priority])), [files])
  // Searched, then sorted inside each folder. While searching, the folders leading to a match open.
  const nodePriority = (node: FileTreeNode) => (node.kind === 'file' ? node.file.priority : folderPriority(node.indexes))
  const tree = sortFileTree(filterFileTree(fullTree, search), sort.field, sort.descending, nodePriority)
  const searching = search.trim() !== ''
  const allFolders = useMemo(() => folderPaths(fullTree), [fullTree])
  // Opening or closing everything. On phones it goes a step at a time: expanding opens every folder,
  // then every row's details; collapsing closes the details, then the folders.
  const phone = !useMediaQuery('(min-width: 640px)')
  const [collapsing, setCollapsing] = useState(false)
  const allPaths = useMemo(() => allNodePaths(fullTree), [fullTree])
  const foldersOpen = closed.size === 0
  const detailsOpen = details.size > 0
  const everythingOpen = foldersOpen && details.size >= allPaths.length
  // The minus shows once everything is open, and stays while collapsing still has a step to go.
  const allOpen = phone ? everythingOpen || (collapsing && (detailsOpen || closed.size < allFolders.length)) : foldersOpen
  const toggleAll = () => {
    if (!phone) return setClosed(allOpen ? new Set(allFolders) : new Set())
    if (!allOpen) {
      if (!foldersOpen) {
        setClosed(new Set())
      } else {
        setDetails(new Set(allPaths))
        setCollapsing(true)
      }
    } else if (detailsOpen) {
      setDetails(new Set())
      if (!allFolders.length) setCollapsing(false)
    } else {
      setClosed(new Set(allFolders))
      setCollapsing(false)
    }
  }
  const pathOnDisk = (path: string) => (savePath ? `${savePath.replace(/[\\/]+$/, '')}/${path}` : path)
  // A folder's priority, when all its files share one.
  const folderPriority = (indexes: number[]) => {
    const values = new Set(indexes.map(index => priorityOf.get(index) ?? 1))
    return values.size === 1 ? [...values][0] : MIXED
  }
  const prioritySelect = (name: string, value: number, indexes: number[], className?: string) => (
    <NativeSelect
      aria-label={t('Priority of {name}', { name })}
      className={cn(PRIORITY_COL, 'h-7 px-1.5 text-xs', value === 0 && 'text-muted-foreground', className)}
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => void prioritize(indexes, Number(e.target.value))}
    >
      {value === MIXED && <option value={MIXED} disabled>{t('Mixed')}</option>}
      {PRIORITIES.map(([priority, label]) => <option key={priority} value={priority}>{label}</option>)}
    </NativeSelect>
  )
  const wantBox = (name: string, state: boolean | 'indeterminate', indexes: number[]) => (
    <Checkbox
      aria-label={t('Download {name}', { name })}
      checked={state}
      onClick={(e) => e.stopPropagation()}
      onCheckedChange={(checked) => void prioritize(indexes, checked === true ? 1 : 0)}
    />
  )

  const rename = (node: FileTreeNode, name: string) => {
    const newPath = getRenamedPath(node.path, name)
    return action.mutateAsync({
      work: () => (node.kind === 'file' ? qbitClient.renameFile(hash, node.path, newPath) : qbitClient.renameFolder(hash, node.path, newPath)),
      failed: node.kind === 'file' ? t('Failed to rename file') : t('Failed to rename folder'),
    }).then(() => { setRenaming(null); toast.success(t('Renamed')); return true }, () => false)
  }

  const toggleOpen = (path: string) => setClosed(current => {
    const next = new Set(current)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    return next
  })

  const renameButton = (node: FileTreeNode) => (
    <Button type="button" variant="ghost" size="icon" className="size-6" disabled={incognito} aria-label={t('Rename {name}', { name: node.name })} title={incognito ? t('Renaming is off in incognito mode') : t('Rename')} onClick={(e) => { e.stopPropagation(); setRenaming(node.path) }}>
      <Pencil className="size-3" />
    </Button>
  )

  // Copies where the file or folder is on qBittorrent's machine.
  const copyPath = (node: FileTreeNode) => (
    <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
      <CopyButton text={pathOnDisk(node.path)} label={t('Path')} className="size-6" iconClassName="size-3" />
    </span>
  )

  // Right after the name: rename, copy its path, and for a file download. On phones they're in the
  // row's opened part instead.
  const nameButtons = (node: FileTreeNode, download?: ReactNode) => (
    <span className="ms-1 inline-flex align-middle font-normal max-sm:hidden">
      {renameButton(node)}
      {copyPath(node)}
      {download}
    </span>
  )

  // Phones show each row like the Peers tab's cards: the name only, and an arrow at the end that
  // opens its details below it: progress, size, priority, and renaming, copying and downloading.
  const moreButton = (node: FileTreeNode) => {
    const open = details.has(node.path)
    const label = open ? t('Show less') : t('Show more')
    const progress = node.kind === 'file' ? node.file.progress : node.size > 0 ? node.done / node.size : 0
    return (
      <>
      {/* The percentage beside the arrow, so it shows while the row is closed. */}
      <span className="shrink-0 font-normal leading-6 text-muted-foreground tabular-nums sm:hidden">{Math.floor(progress * 100)}%</span>
      <Button type="button" variant="ghost" size="icon" className="size-6 shrink-0 font-normal sm:hidden" aria-expanded={open} aria-label={label} title={label} onClick={(e) => { e.stopPropagation(); toggleDetails(node.path) }}>
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </Button>
      </>
    )
  }
  const phoneDetails = (node: FileTreeNode, progress: number, size: number, priority: ReactNode, download?: ReactNode) => details.has(node.path) && (
    <div className="mt-1.5 space-y-2 rounded-md bg-muted/30 p-2 font-normal sm:hidden">
      <div className="flex items-center gap-3 text-muted-foreground tabular-nums">
        <ProgressCell value={progress} className="min-w-0 flex-1" />
        <span className="shrink-0">{formatBytes(size)}</span>
      </div>
      <div className="flex items-center gap-1">
        {priority}
        <span className="ms-auto flex items-center">
          {renameButton(node)}
          {copyPath(node)}
          {download}
        </span>
      </div>
    </div>
  )

  const render = (node: FileTreeNode, depth: number) => {
    if (renaming === node.path) return <RenameRow key={node.path} path={node.path} depth={depth} onSave={name => rename(node, name)} onCancel={() => setRenaming(null)} />
    const row = 'flex items-center gap-2 px-2 py-1 text-xs hover:bg-muted/50 max-sm:items-start'
    const pad = { paddingInlineStart: 8 + depth * INDENT }
    // Names wrap rather than being cut off, so long ones can still be read.
    const nameClass = 'block wrap-anywhere'

    if (node.kind === 'file') {
      const { file } = node
      return (
        <div key={node.path} className={row} style={pad}>
          {wantBox(node.name, file.priority > 0, [file.index])}
          <File className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <span className={nameClass}>{node.name}{nameButtons(node, <DownloadLink hash={hash} file={file} canServe={canServe} />)}</span>
            {phoneDetails(node, file.progress, file.size, prioritySelect(node.name, file.priority, [file.index], 'w-auto'), <DownloadLink hash={hash} file={file} canServe={canServe} />)}
          </div>
          {moreButton(node)}
          <ProgressCell value={file.progress} className={PROGRESS_COL} />
          <span className={cn(SIZE_COL, 'text-muted-foreground')}>{formatBytes(file.size)}</span>
          {prioritySelect(node.name, file.priority, [file.index], 'max-sm:hidden')}
        </div>
      )
    }

    const open = searching || !closed.has(node.path)
    return (
      <div key={node.path}>
        {/* Only the arrow opens or closes the folder, so a click elsewhere on the row does nothing by accident. */}
        <div className={cn(row, 'font-medium')} style={pad}>
          {wantBox(node.name, node.wanted === 'all' ? true : node.wanted === 'some' ? 'indeterminate' : false, node.indexes)}
          <button type="button" className="rounded p-0.5 hover:bg-muted" aria-label={open ? t('Collapse {name}', { name: node.name }) : t('Expand {name}', { name: node.name })} aria-expanded={open} onClick={(e) => { e.stopPropagation(); toggleOpen(node.path) }}>
            <ChevronRight className={cn('size-3.5 transition-transform', open ? 'rotate-90' : 'rtl:rotate-180')} />
          </button>
          <Folder className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <span className={nameClass}>{node.name}{nameButtons(node)}</span>
            {phoneDetails(node, node.size > 0 ? node.done / node.size : 0, node.size, prioritySelect(node.name, folderPriority(node.indexes), node.indexes, 'w-auto'))}
          </div>
          {moreButton(node)}
          <ProgressCell value={node.size > 0 ? node.done / node.size : 0} className={cn(PROGRESS_COL, 'font-normal')} />
          <span className={cn(SIZE_COL, 'font-normal text-muted-foreground')}>{formatBytes(node.size)}</span>
          {prioritySelect(node.name, folderPriority(node.indexes), node.indexes, 'max-sm:hidden')}
        </div>
        {open && node.children.map(child => render(child, depth + 1))}
      </div>
    )
  }

  const all = files ?? []
  const bytes = (list: TorrentFile[]) => formatBytes(list.reduce((sum, file) => sum + file.size, 0))

  const titleCell = 'text-xs font-medium tracking-wide text-muted-foreground uppercase'

  return (
    <div className="flex min-h-0 flex-col pt-1">
      {/* The search, how many files there are and their size, and the sorting, on one row. */}
      <div className="flex items-center gap-2 px-2 pb-1.5">
        <SearchInput aria-label={t('Search')} placeholder={t('Search')} value={search} onValueChange={setSearch} className="min-w-0 max-w-64 flex-1" inputClassName="h-7 text-xs" />
        <span className="ms-auto shrink-0 text-xs text-muted-foreground tabular-nums">
          {all.length === 1 ? t('1 file ({size})', { size: bytes(all) }) : t('{count} files ({size})', { count: all.length, size: bytes(all) })}
        </span>
        <SortMenu fields={[['name', t('Name')], ['progress', t('Progress')], ['size', t('Size')], ['priority', t('Priority')]]} sort={sort} onSort={sortBy} onReset={() => setPicked(null)} isDefault={!picked} />
      </div>
      <div className="flex items-center gap-2 border-b px-2 pb-1" style={{ paddingInlineStart: 8 }}>
        {/* Opens or closes every folder, before the Name title. */}
        {(allFolders.length > 0 || phone) && (
          <Button type="button" variant="ghost" size="icon" className="-my-1 size-6 shrink-0 text-muted-foreground" aria-label={allOpen ? t('Collapse all') : t('Expand all')} title={allOpen ? t('Collapse all') : t('Expand all')} onClick={toggleAll}>
            {allOpen ? <SquareMinus className="size-3.5" /> : <SquarePlus className="size-3.5" />}
          </Button>
        )}
        <span className={cn('min-w-0 flex-1', titleCell)}><SortTitle field="name" sort={picked ?? noSort} onSort={sortBy}>{t('Name')}</SortTitle></span>
        <span className={cn(PROGRESS_COL, titleCell)}><SortTitle field="progress" sort={picked ?? noSort} onSort={sortBy}>{t('Progress')}</SortTitle></span>
        <span className={cn(SIZE_COL, titleCell)}><SortTitle field="size" sort={picked ?? noSort} onSort={sortBy}>{t('Size')}</SortTitle></span>
        <span className={cn(PRIORITY_COL, titleCell, 'max-sm:hidden')}><SortTitle field="priority" sort={picked ?? noSort} onSort={sortBy}>{t('Priority')}</SortTitle></span>
      </div>
      <div className="flex-1 overflow-y-auto pb-1">
        {isLoading ? <p className="py-8 text-center text-xs text-muted-foreground">{t('Loading files...')}</p>
          : fullTree.length === 0 ? <p className="py-8 text-center text-xs text-muted-foreground">{t('No files yet')}</p>
          : tree.length === 0 ? <p className="py-8 text-center text-xs text-muted-foreground">{t('Nothing matches')}</p>
          : tree.map(node => render(node, 0))}
      </div>

    </div>
  )
}
