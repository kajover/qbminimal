import { useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUpdateNotice } from '@/hooks/useUpdateNotice'
import { checkForUpdates } from '@/lib/updateNotice'
import { QBITTORRENT_DOWNLOADS, QBMINIMAL_RELEASES } from '@/lib/updates'
import { t } from '@/i18n'

// Asks GitHub for the newest qbminimal and qBittorrent releases when the button is pressed, and
// only then. The last answer stays on this device until the next check.
export function UpdateCheck() {
  const notice = useUpdateNotice()
  const [checking, setChecking] = useState(false)

  const check = async () => {
    setChecking(true)
    await checkForUpdates()
    setChecking(false)
  }

  const rows: [string, string | undefined, boolean, string][] = [
    ['qbminimal', notice.latest?.qbminimal, notice.qbminimalNewer, QBMINIMAL_RELEASES],
    ['qBittorrent', notice.latest?.qbittorrent, notice.qbittorrentNewer, QBITTORRENT_DOWNLOADS],
  ]

  return (
    <div className="mt-4 space-y-3 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t('Asks GitHub for the latest releases.')}</p>
        <Button variant="outline" size="sm" disabled={checking} onClick={() => void check()}>
          <RefreshCw className={checking ? 'animate-spin' : undefined} />
          {checking ? t('Checking for updates...') : t('Check for updates')}
        </Button>
      </div>
      {notice.latest && (
        <dl className="space-y-1 text-sm" aria-live="polite">
          {rows.map(([name, latest, newer, link]) => (
            <div key={name} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{name}</dt>
              <dd className="text-end">
                {latest === 'failed' || latest === undefined ? (
                  <span className="text-destructive">{t('Couldn\'t check for updates')}</span>
                ) : newer ? (
                  <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2">
                    {t('Version {version} is available', { version: latest })}
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                ) : (
                  <span className="text-green-600 dark:text-green-500">{t('Up to date')}</span>
                )}
              </dd>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">{t('Last checked {time}', { time: new Date(notice.lastChecked).toLocaleString() })}</p>
        </dl>
      )}
    </div>
  )
}
