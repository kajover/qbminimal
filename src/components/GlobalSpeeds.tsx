import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTotalSpeeds, useTransferInfo } from '@/hooks/useApi'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import { formatBytes } from '@/lib/format'
import { t } from '@/i18n'

const toKiB = (bytes: number | undefined) => (bytes && bytes > 0 ? String(Math.round(bytes / 1024)) : '0')

// Current speeds, download above upload, in the plain text color. Each arrow keeps its place at the
// start of a slot with room for "999.9 KB/s", and the number ends at the slot's end, beside the
// speed limit button. A limit that's set shows faintly below its speed. Clicking sets the limits.
export function GlobalSpeeds() {
  const { data: speeds } = useTotalSpeeds()
  const { data: state } = useTransferInfo()
  const [open, setOpen] = useState(false)
  if (!speeds) return null

  const row = (arrow: string, speed: number, limit: number | undefined) => (
    <span className="flex flex-col items-stretch">
      <span className="flex min-w-[6.4em] items-center justify-between gap-1">
        <span>{arrow}</span>
        <span>{formatBytes(speed)}/s</span>
      </span>
      {!!limit && limit > 0 && <span className="text-end text-[0.8em] text-muted-foreground">≤ {formatBytes(limit)}/s</span>}
    </span>
  )
  const title = t('Set global speed limits')
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={title}
        aria-label={`${t('Current speeds')}: ↓ ${formatBytes(speeds.down)}/s, ↑ ${formatBytes(speeds.up)}/s. ${title}`}
        className="-mx-1 flex flex-col rounded-md [:root[data-header-speeds=off]_&]:hidden px-1 py-0.5 text-xs leading-tight tabular-nums whitespace-nowrap outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        {row('↓', speeds.down, state?.dl_rate_limit)}
        {row('↑', speeds.up, state?.up_rate_limit)}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {/* Keyed by opening, so it starts from the limits in force. */}
          {open && <LimitsForm alternative={state?.use_alt_speed_limits === true} download={state?.dl_rate_limit} upload={state?.up_rate_limit} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

function LimitsForm({ alternative, download, upload, onDone }: { alternative: boolean; download?: number; upload?: number; onDone: () => void }) {
  const queryClient = useQueryClient()
  const [down, setDown] = useState(() => toKiB(download))
  const [up, setUp] = useState(() => toKiB(upload))
  const [pending, setPending] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const values = [down, up].map(value => (value.trim() === '' ? 0 : Number(value)))
    if (values.some(value => !Number.isFinite(value) || value < 0)) {
      toast.error(t('Enter 0 or a higher number'))
      return
    }
    setPending(true)
    try {
      await qbitClient.setGlobalDownloadLimit(Math.round(values[0] * 1024))
      await qbitClient.setGlobalUploadLimit(Math.round(values[1] * 1024))
      await queryClient.invalidateQueries({ queryKey: ['torrents'] })
      await queryClient.invalidateQueries({ queryKey: ['preferences'] })
      toast.success(t('Speed limits saved'))
      onDone()
    } catch (error) {
      toast.error(t('Failed to save speed limits'), { description: error instanceof Error ? error.message : undefined })
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t('Global speed limits')}</DialogTitle>
        <DialogDescription>
          {alternative ? t('The alternative speed limits are on, so these change them.') : t('For all torrents together.')}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="global-dl-limit">{t('Download limit (KiB/s, 0 = unlimited)')}</Label>
        <Input id="global-dl-limit" type="number" min={0} inputMode="numeric" value={down} onChange={(e) => setDown(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="global-up-limit">{t('Upload limit (KiB/s, 0 = unlimited)')}</Label>
        <Input id="global-up-limit" type="number" min={0} inputMode="numeric" value={up} onChange={(e) => setUp(e.target.value)} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>{t('Cancel')}</Button>
        <Button type="submit" disabled={pending}>{t('Save')}</Button>
      </DialogFooter>
    </form>
  )
}
