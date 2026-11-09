import { useEffect, useState } from 'react'
import { Upload } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { isTorrentFile, sendToAdd } from '@/lib/incoming'
import { t } from '@/i18n'

const carriesFiles = (event: DragEvent) => !!event.dataTransfer?.types.includes('Files')

// .torrent files dropped anywhere on the page go to the Add page, with a hint while dragging.
export function DropOverlay() {
  const [over, setOver] = useState(false)

  useEffect(() => {
    // Entering and leaving fire for every element passed over, so they're counted.
    let depth = 0
    const enter = (event: DragEvent) => {
      if (!carriesFiles(event)) return
      depth++
      setOver(true)
    }
    const leave = (event: DragEvent) => {
      if (!carriesFiles(event)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setOver(false)
    }
    const overPage = (event: DragEvent) => {
      if (carriesFiles(event)) event.preventDefault()
    }
    const drop = (event: DragEvent) => {
      depth = 0
      setOver(false)
      // A drop zone of a page's own, like the Add page's, has dealt with it already.
      if (!carriesFiles(event) || event.defaultPrevented) return
      event.preventDefault()
      const files = Array.from(event.dataTransfer?.files ?? [])
      const torrents = files.filter(isTorrentFile)
      if (torrents.length < files.length) toast.error(t('Only .torrent files can be added'))
      if (torrents.length) sendToAdd({ files: torrents })
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', overPage)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', overPage)
      window.removeEventListener('drop', drop)
    }
  }, [])

  if (!over) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-background/70 p-6 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-primary bg-card px-10 py-8 text-center shadow-lg">
        <Upload className="size-8 text-primary" />
        <p className="font-medium">{t('Drop .torrent files to add them')}</p>
        <p className="text-sm text-muted-foreground">{t('You can choose options before they\'re added')}</p>
      </div>
    </div>
  )
}
