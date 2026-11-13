import { useState, type ReactNode } from 'react'
import { Bell, History, Magnet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import { magnetHandlerUrl } from '@/lib/incoming'
import { keepSearchesOn, setKeepSearches } from '@/lib/searchPatterns'
import { finishNoticesOn, needsHomeScreen, notificationsSupported, setFinishNotices } from '@/lib/notify'
import { t } from '@/i18n'

// Browsers only let secure pages handle magnet links, and Safari doesn't let pages do it at all.
const canHandleMagnets = () => window.isSecureContext && typeof navigator.registerProtocolHandler === 'function'

function Row({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 gap-3">
        <span className="mt-0.5 text-muted-foreground">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

// Choices that belong to this browser rather than to qBittorrent.
export function BrowserSettings() {
  const [notices, setNotices] = useState(finishNoticesOn)
  const [keepSearches, setKeepSearchesState] = useState(keepSearchesOn)

  const toggleNotices = async () => {
    const on = await setFinishNotices(!notices)
    setNotices(on)
    if (on && notificationsSupported() && Notification.permission === 'denied') {
      toast.info(t('Shown on this page only'), { description: t('The browser blocks notifications for this site, so finished downloads show here while the page is open.') })
    }
  }

  const registerMagnets = () => {
    try {
      navigator.registerProtocolHandler('magnet', magnetHandlerUrl(window.location))
      toast.success(t('Asked the browser'), { description: t('Confirm in the browser if it asks. Magnet links then open the Add page here.') })
    } catch (e) {
      toast.error(t('The browser didn\'t allow it'), { description: e instanceof Error ? e.message : undefined })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('This browser')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Row icon={<Bell className="size-4" />} title={t('Finished downloads')} description={notificationsSupported()
            ? needsHomeScreen()
              ? t('Get a notification when a torrent finishes downloading. On iPhone and iPad this only works while the app is open: iOS pauses it soon after you switch to another app.')
              : t('Get a notification when a torrent finishes downloading, as long as this page is open in a tab. The browser asks for permission first.')
            : needsHomeScreen()
              ? t('On iPhone and iPad, notifications only work in the app added to the Home Screen (Share, then Add to Home Screen, iOS 16.4 or later), and only while it is open. In Safari, finished downloads show on this page.')
              : t('This browser can\'t show notifications, so finished downloads show on this page while it is open.')}>
          <Switch aria-label={t('Finished downloads')} checked={notices} onCheckedChange={() => void toggleNotices()} />
        </Row>
        <Row icon={<History className="size-4" />} title={t('Keep past searches')} description={t('Earlier searches stay in qBittorrent, so they can be opened or run again. When off, each new search deletes the ones before it.')}>
          <Switch aria-label={t('Keep past searches')} checked={keepSearches} onCheckedChange={(on) => { setKeepSearches(on); setKeepSearchesState(on) }} />
        </Row>
        <Row
          icon={<Magnet className="size-4" />}
          title={t('Magnet links')}
          description={canHandleMagnets()
            ? t('Magnet links you click on other websites open here, on the Add page.')
            : t('This browser can\'t open magnet links with a web page. It needs a secure (https) address, and Safari doesn\'t offer it.')}
        >
          <Button variant="outline" size="sm" disabled={!canHandleMagnets()} onClick={registerMagnets}><Magnet />{t('Open them here')}</Button>
        </Row>
      </CardContent>
    </Card>
  )
}
