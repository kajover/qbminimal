import { useMemo, useState, type FormEvent } from 'react'
import { Check, ChevronRight, Download, File, Folder, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { NativeSelect } from '@/components/NativeSelect'
import { Input } from '@/components/ui/input'
import { useApiFeature, useSetFilePriority, useTorrentAction, useTorrentFiles } from '@/hooks/useApi'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import { getFileDownloadUrl } from '@/lib/fileDownloads'
import { getNameProblem, getRenamedPath } from '@/lib/filePaths'
import { buildFileTree, type FileTreeNode } from '@/lib/fileTree'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { TorrentFile } from '@/types'
import { DetailsHeading } from './DetailsHeading'
import { t } from '@/i18n'

const INDENT = 16
// The columns after the name, shared by the title row and every file row so they line up.
// Numbers start at the start edge of their column, like the other tabs' tables. Phones show
// progress, size and priority under the name instead, which leaves the name room to show whole.
const PROGRESS_COL = 'w-24 shrink-0 truncate tabular-nums max-sm:hidden'
const SIZE_COL = 'w-20 shrink-0 truncate tabular-nums max-sm:hidden'
const PRIORITY_COL = 'w-32 shrink-0'
const ACTIONS_COL = 'flex w-12 shrink-0 justify-end'

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
      <Input name="name" defaultValue={current} autoFocus aria-label={t('New name for {current}', { current })} className="h-7 text-xs" />
      <Button type="submit" size="sm" variant="outline" className="h-7 text-xs" disabled={busy}><Check />{t('Save')}</Button>
      <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>{t('Cancel')}</Button>
    </form>
  )
}

// The torrent's files as folders and files, like qBittorrent's own list: the box beside each one
// downloads it or not, a folder's box everything inside it, and the priority sets how soon. Tapping
// a folder's row opens or closes it.
export function TorrentContentTab({ hash }: { hash: string }) {
  const { data: files, isLoading } = useTorrentFiles(hash)
  const setPriority = useSetFilePriority()
  const action = useTorrentAction()
  const canServe = useApiFeature('fileDownload')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const tree = useMemo(() => buildFileTree(files ?? []), [files])

  const prioritize = (indexes: number[], priority: number) =>
    setPriority.mutateAsync({ hash, id: indexes.join('|'), priority }).catch(() => toast.error(t('Couldn\'t change which files download')))
  const priorityOf = useMemo(() => new Map((files ?? []).map(file => [file.index, file.priority])), [files])
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
    <Button type="button" variant="ghost" size="icon" className="size-6" aria-label={t('Rename {name}', { name: node.name })} title={t('Rename')} onClick={(e) => { e.stopPropagation(); setRenaming(node.path) }}>
      <Pencil className="size-3" />
    </Button>
  )

  const render = (node: FileTreeNode, depth: number) => {
    if (renaming === node.path) return <RenameRow key={node.path} path={node.path} depth={depth} onSave={name => rename(node, name)} onCancel={() => setRenaming(null)} />
    const row = 'flex items-center gap-2 px-2 py-1 text-xs hover:bg-muted/50'
    const pad = { paddingInlineStart: 8 + depth * INDENT }
    // Names wrap rather than being cut off, so long ones can still be read.
    const nameClass = 'block wrap-anywhere'

    if (node.kind === 'file') {
      const { file } = node
      const progress = file.progress > 0 && file.progress < 1 ? `${Math.floor(file.progress * 100)}%` : file.progress >= 1 ? '100%' : ''
      return (
        <div key={node.path} className={row} style={pad}>
          {wantBox(node.name, file.priority > 0, [file.index])}
          <File className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <span className={nameClass}>{node.name}</span>
            <span className="mt-0.5 flex items-center gap-2 text-muted-foreground tabular-nums sm:hidden">
              {[progress, formatBytes(file.size)].filter(Boolean).join(' · ')}
              {prioritySelect(node.name, file.priority, [file.index])}
            </span>
          </div>
          <span className={cn(PROGRESS_COL, 'text-muted-foreground')}>{progress}</span>
          <span className={cn(SIZE_COL, 'text-muted-foreground')}>{formatBytes(file.size)}</span>
          {prioritySelect(node.name, file.priority, [file.index], 'max-sm:hidden')}
          <span className={ACTIONS_COL}>
            {renameButton(node)}
            <DownloadLink hash={hash} file={file} canServe={canServe} />
          </span>
        </div>
      )
    }

    const open = !closed.has(node.path)
    return (
      <div key={node.path}>
        <div className={cn(row, 'cursor-pointer font-medium')} style={pad} onClick={() => toggleOpen(node.path)}>
          {wantBox(node.name, node.wanted === 'all' ? true : node.wanted === 'some' ? 'indeterminate' : false, node.indexes)}
          <button type="button" className="rounded p-0.5 hover:bg-muted" aria-label={open ? t('Collapse {name}', { name: node.name }) : t('Expand {name}', { name: node.name })} aria-expanded={open} onClick={(e) => { e.stopPropagation(); toggleOpen(node.path) }}>
            <ChevronRight className={cn('size-3.5 transition-transform', open ? 'rotate-90' : 'rtl:rotate-180')} />
          </button>
          <Folder className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <span className={nameClass}>{node.name}</span>
            <span className="mt-0.5 flex items-center gap-2 font-normal text-muted-foreground tabular-nums sm:hidden">
              {formatBytes(node.size)}
              {prioritySelect(node.name, folderPriority(node.indexes), node.indexes)}
            </span>
          </div>
          <span className={PROGRESS_COL} aria-hidden />
          <span className={cn(SIZE_COL, 'font-normal text-muted-foreground')}>{formatBytes(node.size)}</span>
          {prioritySelect(node.name, folderPriority(node.indexes), node.indexes, 'max-sm:hidden')}
          <span className={ACTIONS_COL}>
            {renameButton(node)}
          </span>
        </div>
        {open && node.children.map(child => render(child, depth + 1))}
      </div>
    )
  }

  const all = files ?? []
  const wanted = all.filter(file => file.priority > 0)
  const bytes = (list: TorrentFile[]) => formatBytes(list.reduce((sum, file) => sum + file.size, 0))

  const titleCell = 'text-xs font-medium tracking-wide text-muted-foreground uppercase'

  return (
    <div className="flex min-h-0 flex-col pt-1">
      <div className="px-2">
        <DetailsHeading end={<span className="text-xs text-muted-foreground tabular-nums">{t('Downloading {count} ({size} of {total})', { count: wanted.length, size: bytes(wanted), total: bytes(all) })}</span>}>
          {all.length === 1 ? t('1 file') : t('{count} files', { count: all.length })}
        </DetailsHeading>
      </div>
      <div className="flex items-center gap-2 border-b px-2 pb-1" style={{ paddingInlineStart: 8 }}>
        <span className={cn('min-w-0 flex-1', titleCell)}>{t('Name')}</span>
        <span className={cn(PROGRESS_COL, titleCell)}>{t('Progress')}</span>
        <span className={cn(SIZE_COL, titleCell)}>{t('Size')}</span>
        <span className={cn(PRIORITY_COL, titleCell, 'truncate max-sm:hidden')}>{t('Priority')}</span>
        <span className="w-12 shrink-0" aria-hidden />
      </div>
      <div className="flex-1 overflow-y-auto pb-1">
        {isLoading ? <p className="py-8 text-center text-xs text-muted-foreground">{t('Loading files...')}</p>
          : tree.length === 0 ? <p className="py-8 text-center text-xs text-muted-foreground">{t('No files yet')}</p>
          : tree.map(node => render(node, 0))}
      </div>
    </div>
  )
}
