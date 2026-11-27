import { useState, useSyncExternalStore } from 'react'
import { Download, ExternalLink, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmAction } from '@/components/ConfirmAction'
import { usePreferences } from '@/hooks/useApi'
import { toast } from '@/hooks/use-toast'
import { useUpdateNotice } from '@/hooks/useUpdateNotice'
import { qbitClient } from '@/lib/api'
import { canInstall, installUpdate, pageActions, UpdateError, type UpdateFailure } from '@/lib/selfUpdate'
import { checkForUpdates } from '@/lib/updateNotice'
import { cancelInstall, getInstallState, setInstallState, startInstallControl, subscribeInstall } from '@/lib/updateInstall'
import { countReleaseDownload, QBITTORRENT_DOWNLOADS, QBMINIMAL_RELEASES } from '@/lib/updates'
import { t } from '@/i18n'

// How long the full bar shows before the update counts as installed: its fill takes 300ms.
const FINISH_MS = 600

// Asks GitHub for the newest qbminimal and qBittorrent releases: by itself, in the background after
// signing in at most every 12 hours (see Layout), or when the button is pressed. The last answer
// stays on this device until the next check.
export function UpdateCheck() {
  const notice = useUpdateNotice()
  const { data: prefs } = usePreferences()
  const [checking, setChecking] = useState(false)
  // Outside this component: the install carries on while other pages are open.
  const { percent: installing, installed } = useSyncExternalStore(subscribeInstall, getInstallState)

  const torrentUrl = notice.latest?.qbminimalTorrent
  const latestVersion = notice.latest?.qbminimal
  const installable = notice.qbminimalNewer && canInstall(prefs, torrentUrl) && !!latestVersion

  const install = async () => {
    if (!installable || !torrentUrl || !latestVersion || getInstallState().percent !== null) return
    const control = startInstallControl()
    setInstallState({ percent: 0 })
    try {
      const oldPath = String(prefs?.alternative_webui_path)
      const { oldRemoved } = await installUpdate({
        client: qbitClient, torrentUrl, version: latestVersion, currentPath: oldPath,
        onProgress: percent => setInstallState({ percent }), signal: control.signal, currentVersion: __APP_VERSION__,
        onAdded: () => countReleaseDownload(latestVersion),
      })
      // The bar fills to the end and stays there a moment, so the notice never comes while it
      // still shows part of the download (the last steps often take less than one poll).
      setInstallState({ percent: 100 })
      await new Promise(resolve => setTimeout(resolve, FINISH_MS))
      setInstallState({ percent: null, installed: true })
      // Stays until it's answered, so nothing typed elsewhere is lost to a reload.
      // Short: only where the old version stays is worth saying.
      toast.success(t('Update installed'), {
        description: oldRemoved ? t('Reload to use it.') : t('Reload to use it. The old version stays in {folder}.', { folder: oldPath }),
        duration: Infinity,
        action: { label: t('Reload'), onClick: pageActions.reload },
      })
    } catch (error) {
      const messages: Record<UpdateFailure, string> = {
        add: t('Couldn\'t add the update to qBittorrent'),
        stalled: t('The update download isn\'t moving. Check that qBittorrent can reach github.com.'),
        failed: t('qBittorrent reported an error while downloading the update'),
        missing: t('The update was removed from qBittorrent before it finished'),
        switch: t('Couldn\'t switch qBittorrent to the new version'),
        canceled: t('Update canceled'),
      }
      const reason = error instanceof UpdateError ? error.reason : 'add'
      if (reason === 'canceled') toast(messages.canceled)
      else toast.error(messages[reason])
      setInstallState({ percent: null })
    }
  }

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
        <p className="text-xs text-muted-foreground">{t('Checks GitHub for new releases by itself every 12 hours.')}</p>
        {/* Installing sits beside checking, once there's something to install. At the end, also
            when they wrap below the text on phones. */}
        <div className="ms-auto flex flex-wrap items-center justify-end gap-2">
          {installed ? (
            <Button size="sm" onClick={pageActions.reload}><RefreshCw />{t('Reload')}</Button>
          ) : installing !== null ? (
            <>
              <span role="status" className="text-sm">{t('Downloading update... {percent}%', { percent: installing })}</span>
              <Button variant="outline" size="sm" onClick={cancelInstall}>{t('Cancel')}</Button>
            </>
          ) : installable && (
            <ConfirmAction
              safe
              label={t('Install update')}
              title={t('Install version {version}?', { version: latestVersion })}
              message={t('Installs it from GitHub, replacing this one.')}
              confirmLabel={t('Install')}
              buttonLabel={t('Install update')}
              buttonIcon={Download}
              onConfirm={() => void install()}
            />
          )}
          <Button variant="outline" size="sm" disabled={checking || installing !== null} onClick={() => void check()}>
            <RefreshCw className={checking ? 'animate-spin' : undefined} />
            {checking ? t('Checking for updates...') : t('Check for updates')}
          </Button>
        </div>
      </div>
      {installing !== null && (
        <div aria-hidden className="h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${installing}%` }} />
        </div>
      )}
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
