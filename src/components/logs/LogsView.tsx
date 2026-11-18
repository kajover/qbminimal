import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'
import { Checkbox } from '@/components/ui/checkbox'
import { SearchInput } from '@/components/SearchInput'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLogs, usePeerLog } from '@/hooks/useApi'
import { t } from '@/i18n'
import { buildLogText, formatLogTime, logFileName } from '@/lib/logExport'
import { cn } from '@/lib/utils'

// qBittorrent's log levels. The badge always carries the word, so colour never says it alone.
const LEVELS = [
  { key: 'normal', type: 1, label: t('Normal'), badge: 'bg-muted text-muted-foreground' },
  { key: 'info', type: 2, label: t('Info'), badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  { key: 'warning', type: 4, label: t('Warning'), badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  { key: 'critical', type: 8, label: t('Critical'), badge: 'bg-red-500/15 text-red-700 dark:text-red-400' },
] as const

type Levels = Record<(typeof LEVELS)[number]['key'], boolean>

// Every level is loaded, so each one's count shows even while it's hidden; the tick boxes only
// choose what's listed.
const ALL_LEVELS: Levels = { normal: true, info: true, warning: true, critical: true }

// Newest first, and only this many, so a long session stays quick to show.
const MAX_ROWS = 500

// One shape for both logs.
interface Row {
  id: number
  timestamp: number
  // The word shown in the badge, and the one written to an export.
  label: string
  // The English word for the export file, so it reads the same in every language.
  level: string
  badge: string
  message: string
}

const BADGE_BASE = 'inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium'

function Badge({ row }: { row: Row }) {
  return <span className={cn(BADGE_BASE, row.badge)}>{row.label}</span>
}

// A table on wide screens and a compact list on phones, from the same rows: time and badge on one
// line, the message below. The message wraps instead of being cut off.
function LogRows({ rows }: { rows: Row[] }) {
  return (
    <div className="text-sm">
      <div aria-hidden className="flex gap-3 border-b px-2 py-2 text-xs font-medium text-muted-foreground max-md:hidden">
        <span className="w-40 shrink-0">{t('Date and time')}</span>
        <span className="w-20 shrink-0">{t('Level')}</span>
        <span className="min-w-0 flex-1">{t('Message')}</span>
      </div>
      <ul className="divide-y">
        {rows.map(row => (
          <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-2 md:flex-nowrap md:items-start">
            <span className="w-40 shrink-0 text-xs tabular-nums text-muted-foreground md:pt-0.5">{formatLogTime(row.timestamp)}</span>
            <span className="w-20 shrink-0"><Badge row={row} /></span>
            <span className="min-w-0 basis-full break-words md:basis-0 md:flex-1">{row.message}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const Note = ({ children }: { children: string }) => <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>

export function LogsView() {
  const [tab, setTab] = useState<'main' | 'peers'>('main')
  const [levels, setLevels] = useState<Levels>({ normal: true, info: true, warning: true, critical: true })
  const [search, setSearch] = useState('')
  const main = useLogs(ALL_LEVELS)
  const peers = usePeerLog(tab === 'peers')

  const mainRows = useMemo<Row[]>(() => {
    const needle = search.trim().toLowerCase()
    const shownTypes = new Set<number>(LEVELS.filter(level => levels[level.key]).map(level => level.type))
    return [...(main.data ?? [])]
      .filter(log => shownTypes.has(log.type) && (!needle || log.message.toLowerCase().includes(needle)))
      .reverse()
      .slice(0, MAX_ROWS)
      .map(log => {
        const level = LEVELS.find(l => l.type === log.type) ?? LEVELS[0]
        return { id: log.id, timestamp: log.timestamp, label: level.label, level: level.key, badge: level.badge, message: log.message }
      })
  }, [main.data, search, levels])

  // Searched by address and reason, like the general log by message.
  const peerRows = useMemo<Row[]>(() => [...(peers.data ?? [])].filter(entry => {
    const needle = search.trim().toLowerCase()
    return !needle || `${entry.ip} ${entry.reason ?? ''}`.toLowerCase().includes(needle)
  }).reverse().slice(0, MAX_ROWS).map(entry => ({
    id: entry.id,
    timestamp: entry.timestamp,
    label: entry.blocked ? t('blocked') : t('banned'),
    level: entry.blocked ? 'blocked' : 'banned',
    badge: entry.blocked ? 'bg-red-500/15 text-red-700 dark:text-red-400' : 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    message: entry.reason ? `${entry.ip}: ${entry.reason}` : entry.ip,
  })), [peers.data, search])

  // Counts of every level's entries, before the search and whether or not the level is shown.
  const counts = useMemo(() => {
    const result: Record<number, number> = {}
    for (const log of main.data ?? []) result[log.type] = (result[log.type] ?? 0) + 1
    return result
  }, [main.data])

  const shown = tab === 'main' ? mainRows : peerRows

  const exportLogs = () => {
    const text = buildLogText(shown.map(row => ({ timestamp: row.timestamp, level: row.level, message: row.message })))
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const link = document.createElement('a')
    link.href = url
    link.download = logFileName(tab)
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Logs')}
        actions={
          <Button variant="outline" size="icon" title={t('Export logs')} aria-label={t('Export logs')} disabled={shown.length === 0} onClick={exportLogs}>
            <Download />
          </Button>
        }
      />
      <Card>
        <CardContent>
          <Tabs value={tab} onValueChange={(value) => setTab(value as 'main' | 'peers')}>
            <TabsList className="mb-3 grid w-full grid-cols-2">
              <TabsTrigger value="main">{t('General')}</TabsTrigger>
              <TabsTrigger value="peers">{t('Blocked peers')}</TabsTrigger>
            </TabsList>
            <TabsContent value="main" className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {LEVELS.map(level => (
                  <div key={level.key} className="flex items-center gap-1.5">
                    <Checkbox id={`log-${level.key}`} checked={levels[level.key]} onCheckedChange={(checked) => setLevels(prev => ({ ...prev, [level.key]: !!checked }))} />
                    <Label htmlFor={`log-${level.key}`} className="text-xs font-normal">
                      {level.label}
                      <span className="ms-1 tabular-nums text-muted-foreground">{counts[level.type] ?? 0}</span>
                    </Label>
                  </div>
                ))}
              </div>
              <SearchInput aria-label={t('Filter log messages')} placeholder={t('Search')} value={search} onValueChange={setSearch} />
              {main.isLoading ? <Note>{t('Loading logs...')}</Note>
                : main.isError && !main.data ? <Note>{t('Couldn\'t load the log')}</Note>
                : mainRows.length === 0 ? <Note>{t('No matching entries')}</Note>
                : <LogRows rows={mainRows} />}
            </TabsContent>
            <TabsContent value="peers" className="space-y-3">
              <SearchInput aria-label={t('Search')} placeholder={t('Search')} value={search} onValueChange={setSearch} />
              {peers.isLoading ? <Note>{t('Loading peer log...')}</Note>
                : peers.isError && !peers.data ? <Note>{t('Couldn\'t load the peer log')}</Note>
                : peerRows.length === 0 ? <Note>{search.trim() && peers.data?.length ? t('No matching entries') : t('No blocked or banned peers yet')}</Note>
                : <LogRows rows={peerRows} />}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
