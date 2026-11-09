import { useState } from 'react'
import { Turtle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { usePreferences, useTransferInfo } from '@/hooks/useApi'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import { cn } from '@/lib/utils'
import { formatBytes } from '@/lib/format'
import { t } from '@/i18n'

const formatRate = (bytesPerSecond: unknown) => {
  const value = Number(bytesPerSecond)
  return value > 0 ? `${formatBytes(value)}/s` : t('unlimited')
}

// Switches qBittorrent between its normal and alternative ("slow") speed limits.
export function SpeedLimitToggle() {
  const queryClient = useQueryClient()
  const { data: state } = useTransferInfo()
  const { data: prefs } = usePreferences()
  const [pending, setPending] = useState(false)

  const enabled = state?.use_alt_speed_limits
  if (enabled === undefined) return null

  const rates = prefs ? `↓ ${formatRate(prefs.alt_dl_limit)} · ↑ ${formatRate(prefs.alt_up_limit)}` : undefined
  const title = `${enabled ? t('Alternative speed limits are on') : t('Alternative speed limits are off')}${rates ? ` (${rates})` : ''}`

  const toggle = async () => {
    setPending(true)
    try {
      await qbitClient.toggleSpeedLimitsMode()
      await queryClient.invalidateQueries({ queryKey: ['torrents'] })
      if (enabled) toast.success(t('Alternative speed limits off'), { description: t('Your normal speed limits apply') })
      else toast.success(t('Alternative speed limits on'), { description: rates })
    } catch (e) {
      toast.error(t('Failed to change speed limits'), { description: e instanceof Error ? e.message : undefined })
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('h-8 w-8 [:root[data-speed-limit-button=off]_&]:hidden', enabled && 'bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-400')}
      aria-label={t('Alternative speed limits')}
      aria-pressed={enabled}
      title={title}
      disabled={pending}
      onClick={toggle}
    >
      <Turtle className="h-5 w-5" />
    </Button>
  )
}
