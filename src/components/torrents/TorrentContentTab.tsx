import { useMemo, useState, type FormEvent } from 'react'
import { ChevronRight, Download, File, Pencil, Square, SquareCheck, SquareMinus } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { t } from '@/i18n'

const INDENT = 16

function WantedIcon({ state }: { state: 'all' | 'some' | 'none' }) {
  if (state === 'all') return <SquareCheck className="h-4 w-4 flex-shrink-0 text-green-500" />
  if (state === 'some') return <SquareMinus className="h-4 w-4 flex-shrink-0 text-green-500" />
  return <Square className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
}

// Finished files can be saved straight from qBittorrent 5.3. Otherwise the button explains why not.
function DownloadLink({ hash, file, canServe }: { hash: string; file: TorrentFile; canServe: boolean }) {
  const reason = !canServe ? t('Downloading files needs qBittorrent 5.3 or newer.') : file.progress < 1 ? t('This file isn\'t fully downloaded yet.') : null
  if (reason) {
    // A disabled button ignores the pointer, so the wrapper carries the tooltip.
    return (
      <span className="inline-flex cursor-not-allowed" title={reason} onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="h-6 w-6" disabled aria-label={t('Download {name}: {reason}', { name: file.name, reason })}><Download className="h-3 w-3" /></Button>
      </span>
    )
  }
  return (
    <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
      <a href={getFileDownloadUrl(hash, file.index)} download={file.name.split('/').pop()} target="_blank" rel="noopener" title={t('Download')} aria-label={t('Download {name}', { name: file.name })} onClick={(e) => e.stopPropagation()}>
        <Download className="h-3 w-3" />
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
    <form onSubmit={submit} className="flex items-center gap-2 px-2 py-1" style={{ paddingLeft: 8 + depth * INDENT }}>
      <Input name="name" defaultValue={current} autoFocus aria-label={t('New name for {current}', { current })} className="h-7 text-sm" />
      <Button type="submit" size="sm" variant="outline" className="h-7" disabled={busy}>{t('Save')}</Button>
      <Button type="button" size="sm" variant="ghost" className="h-7" onClick={onCancel}>{t('Cancel')}</Button>
    </form>
  )
}

// The torrent's files as folders and files. Tapping a row includes or skips it, a folder for
// everything inside it.
export function TorrentContentTab({ hash }: { hash: string }) {
  const { data: files, isLoading } = useTorrentFiles(hash)
  const setPriority = useSetFilePriority()
  const action = useTorrentAction()
  const canServe = useApiFeature('fileDownload')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const tree = useMemo(() => buildFileTree(files ?? []), [files])

  const want = (indexes: number[], wanted: boolean) =>
    setPriority.mutateAsync({ hash, id: indexes.join('|'), priority: wanted ? 1 : 0 }).catch(() => toast.error(t('Couldn\'t change which files download')))

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
    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label={t('Rename {name}', { name: node.name })} title={t('Rename')} onClick={(e) => { e.stopPropagation(); setRenaming(node.path) }}>
      <Pencil className="h-3 w-3" />
    </Button>
  )

  const render = (node: FileTreeNode, depth: number) => {
    if (renaming === node.path) return <RenameRow key={node.path} path={node.path} depth={depth} onSave={name => rename(node, name)} onCancel={() => setRenaming(null)} />
    const row = 'flex cursor-pointer items-center gap-2 px-2 py-1 hover:bg-muted/50'
    const pad = { paddingLeft: 8 + depth * INDENT }

    if (node.kind === 'file') {
      const { file } = node
      return (
        <div key={node.path} className={row} style={pad} onClick={() => want([file.index], file.priority === 0)}>
          <WantedIcon state={file.priority > 0 ? 'all' : 'none'} />
          <File className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm" title={node.name}>{node.name}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{file.progress > 0 && file.progress < 1 ? `${Math.floor(file.progress * 100)}% · ` : ''}{formatBytes(file.size)}</span>
          {renameButton(node)}
          <DownloadLink hash={hash} file={file} canServe={canServe} />
        </div>
      )
    }

    const open = !closed.has(node.path)
    return (
      <div key={node.path}>
        <div className={cn(row, 'font-medium')} style={pad} onClick={() => want(node.indexes, node.wanted !== 'all')}>
          <WantedIcon state={node.wanted} />
          <button type="button" className="rounded p-0.5 hover:bg-muted" aria-label={open ? t('Collapse {name}', { name: node.name }) : t('Expand {name}', { name: node.name })} aria-expanded={open} onClick={(e) => { e.stopPropagation(); toggleOpen(node.path) }}>
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open ? 'rotate-90' : 'rtl:rotate-180')} />
          </button>
          <span className="min-w-0 flex-1 truncate text-sm" title={node.name}>{node.name}</span>
          <span className="text-xs font-normal text-muted-foreground tabular-nums">{formatBytes(node.size)}</span>
          {renameButton(node)}
          <span className="w-6" aria-hidden />
        </div>
        {open && node.children.map(child => render(child, depth + 1))}
      </div>
    )
  }

  const all = files ?? []
  const wanted = all.filter(file => file.priority > 0)
  const bytes = (list: TorrentFile[]) => formatBytes(list.reduce((sum, file) => sum + file.size, 0))

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex justify-between border-b px-4 py-2 text-sm text-muted-foreground">
        <span>{all.length === 1 ? t('1 file') : t('{count} files', { count: all.length })}</span>
        <span>{t('Downloading {count} ({size} of {total})', { count: wanted.length, size: bytes(wanted), total: bytes(all) })}</span>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">{t('Loading files...')}</p>
          : tree.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{t('No files yet')}</p>
          : tree.map(node => render(node, 0))}
      </div>
    </div>
  )
}
