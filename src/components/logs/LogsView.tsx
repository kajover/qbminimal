import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/PageHeader'
import { Checkbox } from '@/components/ui/checkbox'
import { SearchInput } from '@/components/SearchInput'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLogs, usePeerLog } from '@/hooks/useApi'
import { t } from '@/i18n'

// qBittorrent's log levels.
const LEVELS = [
  { key: 'normal', type: 1, label: t('Normal'), className: '' },
  { key: 'info', type: 2, label: t('Info'), className: 'text-blue-500' },
  { key: 'warning', type: 4, label: t('Warning'), className: 'text-amber-500' },
  { key: 'critical', type: 8, label: t('Critical'), className: 'text-red-500' },
] as const

type Levels = Record<(typeof LEVELS)[number]['key'], boolean>

// Newest first, and only this many, so a long session stays quick to show.
const MAX_ROWS = 500

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString()
}

function MainLog() {
  const [levels, setLevels] = useState<Levels>({ normal: true, info: true, warning: true, critical: true })
  const [search, setSearch] = useState('')
  const { data: logs, isLoading, isError } = useLogs(levels)

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return [...(logs ?? [])]
      .filter(log => !needle || log.message.toLowerCase().includes(needle))
      .reverse()
      .slice(0, MAX_ROWS)
  }, [logs, search])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {LEVELS.map(level => (
          <div key={level.key} className="flex items-center gap-1.5">
            <Checkbox id={`log-${level.key}`} checked={levels[level.key]} onCheckedChange={(checked) => setLevels(prev => ({ ...prev, [level.key]: !!checked }))} />
            <Label htmlFor={`log-${level.key}`} className={`text-xs font-normal ${level.className}`}>{level.label}</Label>
          </div>
        ))}
      </div>
      <SearchInput aria-label={t('Filter log messages')} placeholder={t('Filter messages')} value={search} onValueChange={setSearch} />

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t('Loading logs...')}</p>
      ) : isError && !logs ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t('Couldn\'t load the log')}</p>
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t('No matching entries')}</p>
      ) : (
        <ul className="space-y-1">
          {shown.map(log => {
            const level = LEVELS.find(l => l.type === log.type)
            return (
              <li key={log.id} className="flex flex-col gap-0.5 py-1 text-xs sm:flex-row sm:gap-2">
                <span className="whitespace-nowrap text-muted-foreground">{formatTimestamp(log.timestamp)}</span>
                <span className={`break-all ${level?.className ?? ''}`}>{log.message}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function PeerLog() {
  const { data: entries, isLoading, isError } = usePeerLog(true)
  const shown = useMemo(() => [...(entries ?? [])].reverse().slice(0, MAX_ROWS), [entries])

  if (isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">{t('Loading peer log...')}</p>
  if (isError && !entries) return <p className="py-8 text-center text-sm text-muted-foreground">{t('Couldn\'t load the peer log')}</p>
  if (shown.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">{t('No blocked or banned peers yet')}</p>

  return (
    <ul className="space-y-1">
      {shown.map(entry => (
        <li key={entry.id} className="flex flex-col gap-0.5 py-1 text-xs sm:flex-row sm:gap-2">
          <span className="whitespace-nowrap text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
          <span className="break-all">
            <span className={entry.blocked ? 'text-red-500' : ''}>{entry.ip}</span>
            {' '}{entry.blocked ? t('blocked') : t('banned')}{entry.reason ? `: ${entry.reason}` : ''}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function LogsView() {
  return (
    <div className="space-y-4">
      <PageHeader title={t('Logs')} />
      <Card>
      <CardContent>
        <Tabs defaultValue="main">
          <TabsList className="mb-3 grid w-full grid-cols-2">
            <TabsTrigger value="main">{t('General')}</TabsTrigger>
            <TabsTrigger value="peers">{t('Blocked peers')}</TabsTrigger>
          </TabsList>
          <TabsContent value="main"><MainLog /></TabsContent>
          <TabsContent value="peers"><PeerLog /></TabsContent>
        </Tabs>
      </CardContent>
      </Card>
    </div>
  )
}
