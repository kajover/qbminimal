import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { formatBytes } from '@/lib/format'
import { selectedSize, type TorrentMetadata } from '@/lib/addTorrent'
import { t } from '@/i18n'

// qBittorrent's file priorities: 0 skips the file.
const FILE_PRIORITIES = [
  { value: 1, label: t('Normal') },
  { value: 6, label: t('High') },
  { value: 7, label: t('Maximum') },
  { value: 0, label: t('Don\'t download') },
]

interface Props {
  metadata: TorrentMetadata
  priorities: number[]
  onChange: (priorities: number[]) => void
}

// Release names rarely have spaces, so this offers line breaks after dots, dashes, underscores
// and slashes instead of cutting a name mid-word.
function Breakable({ text }: { text: string }) {
  return <>{text.split(/(?<=[._\-/])/).map((part, i) => <Fragment key={i}>{i > 0 && <wbr />}{part}</Fragment>)}</>
}

// Splits a file's path into its name and the folders above it, leaving out the torrent's own
// top folder, which the heading already names.
function splitPath(path: string, root: string) {
  const inner = path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path
  const cut = inner.lastIndexOf('/')
  return cut < 0 ? { name: inner, folder: '' } : { name: inner.slice(cut + 1), folder: inner.slice(0, cut) }
}

// Lists the files of a torrent that is not added yet, so some can be skipped. Each file shows its
// whole name, wrapped if long, and below it its folder and size.
export function TorrentFilePicker({ metadata, priorities, onChange }: Props) {
  // Folded away at first: everything is downloaded unless the list is opened and changed.
  const [open, setOpen] = useState(false)
  const setOne = (index: number, value: number) => onChange(priorities.map((p, j) => (j === index ? value : p)))
  return (
    <>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="-mx-1 flex w-[calc(100%+0.5rem)] items-start gap-1.5 rounded-md px-1 py-0.5 text-start outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
        {open ? <ChevronDown className="mt-0.5 size-4 shrink-0" /> : <ChevronRight className="mt-0.5 size-4 shrink-0 rtl:rotate-180" />}
        <span className="min-w-0 flex-1">
          <span className="block font-medium [overflow-wrap:anywhere]"><Breakable text={metadata.name} /></span>
          <span className="block text-xs text-muted-foreground">
            {t('{size} of {total} selected', { size: formatBytes(selectedSize(metadata.files, priorities)), total: formatBytes(metadata.size) })}
          </span>
        </span>
      </button>
      {open && (
      <>
      <div className="-ms-3 flex gap-1">
        <Button type="button" size="sm" variant="ghost" onClick={() => onChange(metadata.files.map(() => 1))}>{t('Select all')}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => onChange(metadata.files.map(() => 0))}>{t('Select none')}</Button>
      </div>
      <ul className="max-h-64 space-y-1 overflow-y-auto pe-1.5">
        {metadata.files.map((file, i) => {
          const { name, folder } = splitPath(file.path, metadata.name)
          return (
          // The name gets the whole width; its folder, size and priority share the line below.
          <li key={file.path} className="flex items-start gap-2 py-1">
            <Checkbox
              className="mt-0.5"
              aria-label={t('Download {path}', { path: file.path })}
              checked={priorities[i] > 0}
              onCheckedChange={(checked) => setOne(i, checked ? 1 : 0)}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs [overflow-wrap:anywhere]" title={file.path} dir="ltr"><Breakable text={name} /></p>
              <div className="mt-0.5 flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-[0.625rem] text-muted-foreground tabular-nums" dir="ltr">{folder ? `${folder} · ` : ''}{formatBytes(file.length)}</p>
                <select
                  aria-label={t('Priority for {path}', { path: file.path })}
                  value={priorities[i]}
                  onChange={(e) => setOne(i, Number(e.target.value))}
                  className="border-input dark:bg-input/30 h-6 flex-shrink-0 rounded-md border bg-transparent px-1 text-xs"
                >
                  {FILE_PRIORITIES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>
          </li>
          )
        })}
      </ul>
      </>
      )}
    </>
  )
}
