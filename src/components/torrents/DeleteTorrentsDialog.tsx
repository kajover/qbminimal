import { useState } from 'react'
import { Lock, LockOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { readStored, writeStored } from '@/lib/storage'
import type { Torrent } from '@/types'
import { t } from '@/i18n'

// Set only while the choice is locked: 'true' or 'false'.
const REMEMBER_KEY = 'qbminimal.deleteFiles'

function rememberedChoice(): boolean | null {
  const stored = readStored(REMEMBER_KEY)
  return stored === 'true' ? true : stored === 'false' ? false : null
}

interface DeleteTorrentsDialogProps {
  // Kept after closing, so the text doesn't vanish while the dialog fades out.
  torrents: Pick<Torrent, 'hash' | 'name'>[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (withFiles: boolean) => void
}

// One dialog for both kinds of delete. Whether files go too starts unticked each time, unless
// the lock keeps the last choice.
export function DeleteTorrentsDialog({ torrents, open, onOpenChange, onConfirm }: DeleteTorrentsDialogProps) {
  const [withFiles, setWithFiles] = useState(() => rememberedChoice() ?? false)
  const [locked, setLocked] = useState(() => rememberedChoice() !== null)
  const count = torrents.length

  const changeFiles = (value: boolean) => {
    setWithFiles(value)
    if (locked) writeStored(REMEMBER_KEY, String(value))
  }
  const toggleLock = () => {
    writeStored(REMEMBER_KEY, locked ? null : String(withFiles))
    setLocked(!locked)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{count === 1 ? t('Delete this torrent?') : t('Delete {count} torrents?', { count })}</DialogTitle>
          <DialogDescription>
            {withFiles
              ? t('The downloaded files are deleted from disk too. This can\'t be undone.')
              : t('Only the entry in qBittorrent goes. The downloaded files stay on disk.')}
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
          {torrents.map(torrent => <li key={torrent.hash} className="wrap-anywhere">{torrent.name}</li>)}
        </ul>
        <div className="flex items-center gap-1">
          <Checkbox id="delete-files" checked={withFiles} onCheckedChange={(checked) => changeFiles(checked === true)} />
          <label htmlFor="delete-files" className="ps-1 text-sm font-medium">{t('Also delete the downloaded files')}</label>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={locked ? 'size-8 text-foreground' : 'size-8 text-muted-foreground'}
            aria-pressed={locked}
            aria-label={locked ? t('Stop remembering this choice') : t('Remember this choice')}
            title={locked ? t('Remembered for next time. Click to stop remembering.') : t('Remember this choice for next time')}
            onClick={toggleLock}
          >
            {locked ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('Cancel')}</Button>
          <Button variant="destructive" onClick={() => onConfirm(withFiles)}>{withFiles ? t('Delete with files') : t('Delete')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
