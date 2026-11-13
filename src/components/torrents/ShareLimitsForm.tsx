import { useState, type FormEvent } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTorrentAction } from '@/hooks/useApi'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import { getShareLimitForm, parseShareLimits, type ShareLimitMode } from '@/lib/shareLimits'
import type { Torrent } from '@/types'
import { t } from '@/i18n'

const selectClass = 'border-input dark:bg-input/30 h-8 w-full rounded-md border bg-transparent px-2 text-xs'

const REMOVAL_WARNINGS: Record<string, string> = {
  Remove: t('qBittorrent will remove this torrent without asking once a limit is reached, or right away if it\'s already past one. Its files are kept.'),
  RemoveWithContent: t('qBittorrent will remove this torrent and permanently delete its files without asking once a limit is reached, or right away if it\'s already past one.'),
}

// Values start from the torrent and don't follow refreshes, so typing isn't overwritten.
export function ShareLimitsForm({ torrent }: { torrent: Torrent }) {
  const action = useTorrentAction()
  const [form, setForm] = useState(() => getShareLimitForm(torrent))
  // Older qBittorrent versions don't report this setting, so it can't be shown or kept.
  const supportsAction = torrent.share_limit_action !== undefined
  const warning = form.mode === 'custom' ? REMOVAL_WARNINGS[form.action] : undefined

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const limits = parseShareLimits(form)
    if (!limits) {
      toast.error(t('Check the seeding limits'), { description: t('Use 0 or higher, with whole minutes. Leave a box blank for no limit.') })
      return
    }
    action.mutateAsync({
      work: () => qbitClient.setShareLimits([torrent.hash], limits),
      failed: t('Failed to save seeding limits'),
    }).then(() => { toast.success(t('Seeding limits saved')) }, () => undefined)
  }

  return (
    <form onSubmit={submit} className="space-y-2 border-t pt-3">
      <div className="space-y-1">
        <Label htmlFor="torrent-share-mode" className="text-xs text-muted-foreground">{t('Seeding limits')}</Label>
        <select
          id="torrent-share-mode"
          value={form.mode}
          onChange={(e) => setForm({ ...form, mode: e.target.value as ShareLimitMode })}
          className={selectClass}
        >
          <option value="global">{t('Use qBittorrent\'s global limits')}</option>
          <option value="none">{t('No limit')}</option>
          <option value="custom">{t('Custom limits')}</option>
        </select>
      </div>

      {form.mode === 'custom' && (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="torrent-share-ratio" className="text-xs text-muted-foreground">{t('Ratio')}</Label>
              <Input id="torrent-share-ratio" type="number" min={0} step="any" placeholder={t('No limit')} value={form.ratio} onChange={(e) => setForm({ ...form, ratio: e.target.value })} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="torrent-share-seeding" className="text-xs text-muted-foreground">{t('Seeding time (minutes)')}</Label>
              <Input id="torrent-share-seeding" type="number" min={0} step={1} placeholder={t('No limit')} value={form.seedingMinutes} onChange={(e) => setForm({ ...form, seedingMinutes: e.target.value })} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="torrent-share-inactive" className="text-xs text-muted-foreground">{t('Inactive time (minutes)')}</Label>
              <Input id="torrent-share-inactive" type="number" min={0} step={1} placeholder={t('No limit')} value={form.inactiveMinutes} onChange={(e) => setForm({ ...form, inactiveMinutes: e.target.value })} className="h-8 text-xs" />
            </div>
          </div>

          {supportsAction && (
            <div className="space-y-1">
              <Label htmlFor="torrent-share-action" className="text-xs text-muted-foreground">{t('When a limit is reached')}</Label>
              <select
                id="torrent-share-action"
                value={form.action}
                onChange={(e) => setForm({ ...form, action: e.target.value })}
                className={selectClass}
              >
                <option value="Default">{t('Use qBittorrent\'s global setting')}</option>
                <option value="Stop">{t('Stop the torrent')}</option>
                <option value="EnableSuperSeeding">{t('Switch to super seeding')}</option>
                <option value="Remove">{t('Remove the torrent, keep its files')}</option>
                <option value="RemoveWithContent">{t('Remove the torrent and delete its files')}</option>
              </select>
            </div>
          )}

          {form.limitsMode !== undefined && (
            <div className="space-y-1">
              <Label htmlFor="torrent-share-limits-mode" className="text-xs text-muted-foreground">{t('Stop seeding when')}</Label>
              <select
                id="torrent-share-limits-mode"
                value={form.limitsMode}
                onChange={(e) => setForm({ ...form, limitsMode: e.target.value })}
                className={selectClass}
              >
                <option value="Default">{t('qBittorrent\'s global setting decides')}</option>
                <option value="MatchAny">{t('Any one limit is reached')}</option>
                <option value="MatchAll">{t('Every set limit is reached')}</option>
              </select>
            </div>
          )}

          {warning && <p role="alert" className="text-xs text-destructive">{warning}</p>}
        </>
      )}

      <Button type="submit" size="sm" variant="outline" className="h-8 text-xs" disabled={action.isPending}><Check />{t('Save seeding limits')}</Button>
    </form>
  )
}
