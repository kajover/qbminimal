import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { ChevronDown, Download, ListFilter, Settings, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { PageHeader } from '@/components/PageHeader'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { SearchInput } from '@/components/SearchInput'
import { LogBadge, LogEntryDialog, type LogRow } from '@/components/logs/LogEntryDialog'
import { textWidth } from '@/components/TableColumns'
import { useLogs, usePeerLog } from '@/hooks/useApi'
import { t } from '@/i18n'
import { parseLogMessage } from '@/lib/logDetails'
import { buildLogText, formatLogTime, logFileName } from '@/lib/logExport'
import { FILL_BOTTOM, pageScroller } from '@/lib/pageScroll'
import { readStored, writeStored } from '@/lib/storage'
import { textScale } from '@/lib/textSize'

// qBittorrent's log levels. The badge always carries the word, so colour never says it alone.
const LEVELS = [
  { key: 'normal', type: 1, get label() { return t('Normal') }, badge: 'bg-muted text-muted-foreground' },
  { key: 'info', type: 2, get label() { return t('Info') }, badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  { key: 'warning', type: 4, get label() { return t('Warning') }, badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  { key: 'critical', type: 8, get label() { return t('Critical') }, badge: 'bg-red-500/15 text-red-700 dark:text-red-400' },
] as const

// The level column is as wide as its longest badge in this language (12px text and 12px padding),
// or its title.
const levelWidth = () => Math.ceil(Math.max(
  ...[...LEVELS.map(level => level.label), t('blocked'), t('banned')].map(label => textWidth(label, 12 * textScale()) + 12),
  textWidth(t('Level'), 12 * textScale()),
) + 2)

const PEER_BADGES = { blocked: 'bg-red-500/15 text-red-700 dark:text-red-400', banned: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' }

// The four levels, and the peer log's entries, which are left out until asked for.
type LevelKey = (typeof LEVELS)[number]['key']
type Shown = Record<LevelKey | 'peers', boolean>
const DEFAULT_SHOWN: Shown = { normal: true, info: true, warning: true, critical: true, peers: false }

// Every level is loaded, so each one's count shows even while it's hidden; the filter only
// chooses what's listed.
const ALL_LEVELS = { normal: true, info: true, warning: true, critical: true }

// Newest first, and only this many, so a long session stays quick to show.
const MAX_ROWS = 500

const AUTO_SCROLL_KEY = 'qbminimal.logsAutoScroll'
const HIDDEN_KEY = 'qbminimal.logsHidden'

function readHidden(): string[] {
  try {
    const list: unknown = JSON.parse(readStored(HIDDEN_KEY) ?? '[]')
    return Array.isArray(list) ? list.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

// What the filter button says: all, none, the one level, or how many.
function filterLabel(shown: Shown): string {
  const on = LEVELS.filter(level => shown[level.key])
  const levels = on.length === LEVELS.length ? t('All levels') : on.length === 1 ? on[0].label : on.length ? t('{count} levels', { count: on.length }) : null
  if (!shown.peers) return levels ?? t('None')
  return levels ? t('{levels} + peers', { levels }) : t('Blocked peers')
}

// The log window ends at the bottom of the screen, less the page's own room below it, so the page
// stays put and the entries scroll inside the window. It's never shorter than 12rem.
function useFitToScreen(box: RefObject<HTMLElement | null>): CSSProperties | undefined {
  const [room, setRoom] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = box.current
    const card = el?.closest<HTMLElement>('[data-slot="card"]')
    const main = el?.closest('main')
    if (!el || !card || !main) return
    const measure = () => {
      // From the top of the page, wherever it's scrolled to, so scrolling doesn't change it.
      const top = el.getBoundingClientRect().top + pageScroller().scrollTop
      // The card reaches into the page's bottom padding as far as its (negative) margin says.
      const below = card.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom + parseFloat(getComputedStyle(main).paddingBottom) + parseFloat(getComputedStyle(card).marginBottom)
      setRoom(Math.ceil(top + below))
    }
    measure()
    window.addEventListener('resize', measure)
    // Whatever above it changes size (a banner, the header) moves its top.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(card)
    if (main.firstElementChild) observer?.observe(main.firstElementChild)
    return () => {
      window.removeEventListener('resize', measure)
      observer?.disconnect()
    }
  }, [box])
  return room === null ? undefined : { height: `max(12rem, calc(100dvh - ${room}px))` }
}

// New entries come in at the top of the log window. With Auto Scroll, the window goes back up to
// show them; without it, the entries being read stay where they are as the new ones push the list
// down. With the window at its top, the new entries just show there either way. `latest` holds
// each log's newest id; a higher one in either means new entries.
function useNewEntries(scroller: RefObject<HTMLElement | null>, latest: (number | undefined)[], autoScroll: boolean) {
  const anchor = useRef<{ key: string; top: number } | null>(null)
  const seen = useRef(latest)

  // The first row in view, and where it is. Kept up to date as the window scrolls.
  const remember = () => {
    const box = scroller.current
    anchor.current = null
    if (!box || box.scrollTop <= 0) return
    const edge = box.getBoundingClientRect().top
    for (const row of box.querySelectorAll<HTMLElement>('[data-log-key]')) {
      const rect = row.getBoundingClientRect()
      if (rect.bottom > edge) {
        anchor.current = { key: row.dataset.logKey!, top: rect.top }
        return
      }
    }
  }

  useLayoutEffect(() => {
    const before = seen.current
    seen.current = latest
    const arrived = latest.some((id, i) => id !== undefined && before[i] !== undefined && id > before[i]!)
    const box = scroller.current
    if (box && anchor.current && arrived) {
      if (autoScroll) box.scrollTo({ top: 0 })
      else {
        const row = box.querySelector<HTMLElement>(`[data-log-key="${anchor.current.key}"]`)
        if (row) box.scrollBy({ top: row.getBoundingClientRect().top - anchor.current.top, behavior: 'instant' })
      }
    }
    remember()
  })
  return remember
}

// The sentence on one line, then its details on the next, quieter but the same size, as key=value.
// On phones a long entry stops after four lines; it opens in full.
function Message({ row }: { row: LogRow }) {
  return (
    <span className="min-w-0 basis-full [overflow-wrap:anywhere] @max-lg:line-clamp-4 @lg:basis-0 @lg:flex-1">
      {row.summary && <span className="block">{row.summary}</span>}
      {row.fields.length > 0 && (
        <span className="block text-muted-foreground">
          {row.fields.map((field, index) => (
            <span key={index} className="me-2">{field.key}<span className="opacity-60">=</span>{field.value}</span>
          ))}
        </span>
      )}
    </span>
  )
}

// A table on wide screens and a compact list on phones, from the same rows: time and badge on one
// line, the message below. The column titles stay while the entries scroll below them. A row
// opens the entry on its own.
function LogWindow({ rows, note, latest, autoScroll, onOpen }: { rows: LogRow[]; note: ReactNode; latest: (number | undefined)[]; autoScroll: boolean; onOpen: (row: LogRow) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const size = useFitToScreen(box)
  const onScroll = useNewEntries(scroller, latest, autoScroll)
  const levelColumn = useMemo(() => levelWidth(), [])
  return (
    // Columns with titles wherever the list has room for them, as on wide screens: it follows its
    // own width, so a tablet or a phone on its side gets them too.
    <div ref={box} style={size} className="@container flex flex-col text-sm">
      {note ?? (
        <>
          <div aria-hidden className="flex gap-3 border-b px-2 py-2 text-xs font-medium text-muted-foreground @max-lg:hidden">
            <span className="w-40 shrink-0">{t('Date and time')}</span>
            <span className="shrink-0" style={{ width: levelColumn }}>{t('Level')}</span>
            <span className="min-w-0 flex-1">{t('Message')}</span>
          </div>
          {/* The browser's own scroll anchoring is left out, as useNewEntries keeps the rows in place. */}
          <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto [overflow-anchor:none]">
            <ul className="divide-y">
              {rows.map(row => (
                <li key={row.key} data-log-key={row.key}>
                  <button type="button" onClick={() => onOpen(row)} className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 px-2 py-2 @lg:gap-x-3 text-start transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-hidden @lg:flex-nowrap @lg:items-start">
                    {/* Columns under the titles where they fit; elsewhere the level follows the time closely. */}
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground @lg:w-40 @lg:pt-0.5">{formatLogTime(row.timestamp)}</span>
                    <span className="shrink-0 @lg:w-(--level-width)" style={{ '--level-width': `${levelColumn}px` } as CSSProperties}><LogBadge row={row} /></span>
                    <Message row={row} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

// The levels, the peer log and the hidden messages, behind one button that says what's shown.
function LogFilter({ shown, onShownChange, counts, peerCount, hidden, onHiddenChange }: {
  shown: Shown
  onShownChange: (change: (shown: Shown) => Shown) => void
  counts: Record<number, number>
  peerCount: number | undefined
  hidden: string[]
  onHiddenChange: (hidden: string[]) => void
}) {
  const label = filterLabel(shown)
  const small = 'h-7 px-2 text-xs'
  const setLevels = (on: boolean) => onShownChange(prev => ({ ...prev, normal: on, info: on, warning: on, critical: on }))
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="min-w-0 max-w-48 shrink gap-1.5 px-2.5" aria-label={`${t('Levels')}: ${label}`}>
          <ListFilter className="size-4" />
          <span className="truncate">{label}</span>
          {hidden.length > 0 && <span className="shrink-0 text-muted-foreground max-sm:hidden">· {t('{count} hidden', { count: hidden.length })}</span>}
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="p-2">
          <div className="mb-1 flex items-center justify-between gap-2 ps-2">
            <span className="text-xs font-medium">{t('Levels')}</span>
            <span className="flex">
              <Button variant="ghost" size="sm" className={small} onClick={() => setLevels(true)}>{t('All')}</Button>
              <Button variant="ghost" size="sm" className={small} onClick={() => setLevels(false)}>{t('None')}</Button>
            </span>
          </div>
          {LEVELS.map(level => (
            <label key={level.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted">
              <Checkbox checked={shown[level.key]} onCheckedChange={(on) => onShownChange(prev => ({ ...prev, [level.key]: !!on }))} />
              <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${level.badge}`}>{level.label}</span>
              <span className="ms-auto text-xs tabular-nums text-muted-foreground">{counts[level.type] ?? 0}</span>
            </label>
          ))}
          <label className="mt-1 flex cursor-pointer items-center gap-2 rounded border-t px-2 pt-2.5 pb-1.5 hover:bg-muted">
            <Checkbox checked={shown.peers} onCheckedChange={(on) => onShownChange(prev => ({ ...prev, peers: !!on }))} />
            <span className="text-sm">{t('Blocked peers')}</span>
            {shown.peers && peerCount !== undefined && <span className="ms-auto text-xs tabular-nums text-muted-foreground">{peerCount}</span>}
          </label>
        </div>
        {hidden.length > 0 && (
          <div className="border-t p-2">
            <div className="mb-1 flex items-center justify-between gap-2 ps-2">
              <span className="text-xs font-medium">{t('Hidden entries')}</span>
              <Button variant="ghost" size="sm" className={small} onClick={() => onHiddenChange([])}>{t('Show all')}</Button>
            </div>
            <ul className="max-h-48 overflow-y-auto">
              {hidden.map(message => (
                <li key={message} className="flex items-center gap-2 rounded py-0.5 ps-2 hover:bg-muted">
                  <span className="min-w-0 flex-1 text-xs [overflow-wrap:anywhere]">{message}</span>
                  <Button variant="ghost" size="icon" className="size-7 shrink-0 text-muted-foreground hover:text-foreground" aria-label={t('Show {message} again', { message })} title={t('Show again')} onClick={() => onHiddenChange(hidden.filter(item => item !== message))}>
                    <X className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

const Note = ({ children }: { children: string }) => <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>

const newestId = (entries: { id: number }[] | undefined) => entries?.length ? Math.max(...entries.map(entry => entry.id)) : undefined

export function LogsView() {
  const [shown, setShown] = useState<Shown>(DEFAULT_SHOWN)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<LogRow | null>(null)
  const main = useLogs(ALL_LEVELS)
  // Only loaded while its entries are shown.
  const peers = usePeerLog(shown.peers)
  // On unless turned off, and remembered.
  const [autoScroll, setAutoScroll] = useState(() => readStored(AUTO_SCROLL_KEY) !== 'off')
  const changeAutoScroll = (on: boolean) => {
    writeStored(AUTO_SCROLL_KEY, on ? null : 'off')
    setAutoScroll(on)
  }
  // Messages hidden with "Hide similar entries", remembered.
  const [hidden, setHidden] = useState(readHidden)
  const changeHidden = (list: string[]) => {
    writeStored(HIDDEN_KEY, list.length ? JSON.stringify(list) : null)
    setHidden(list)
  }

  // Each general entry read once, as the log only grows.
  const mainRows = useMemo<LogRow[]>(() => (main.data ?? []).map(log => {
    const level = LEVELS.find(l => l.type === log.type) ?? LEVELS[0]
    const { summary, fields } = parseLogMessage(log.message)
    return { key: `m${log.id}`, id: log.id, timestamp: log.timestamp, label: level.label, level: level.key, badge: level.badge, message: log.message, summary, fields, hideKey: summary || log.message }
  }), [main.data])

  // Both logs in one list, newest first. The peer log is searched by address and reason.
  const rows = useMemo<LogRow[]>(() => {
    const needle = search.trim().toLowerCase()
    const matches = (text: string) => !needle || text.toLowerCase().includes(needle)
    const shownLevels = new Set<string>(LEVELS.filter(level => shown[level.key]).map(level => level.key))
    const hiddenSet = new Set(hidden)
    const all = mainRows.filter(row => shownLevels.has(row.level) && !hiddenSet.has(row.hideKey!) && matches(row.message))
    if (shown.peers) {
      for (const entry of peers.data ?? []) {
        const message = entry.reason ? `${entry.ip}: ${entry.reason}` : entry.ip
        if (!matches(message)) continue
        const level = entry.blocked ? 'blocked' : 'banned'
        all.push({
          key: `p${entry.id}`,
          id: entry.id,
          timestamp: entry.timestamp,
          label: entry.blocked ? t('blocked') : t('banned'),
          level,
          badge: PEER_BADGES[level],
          message,
          summary: '',
          fields: entry.reason ? [{ key: 'IP', value: entry.ip }, { key: 'Reason', value: entry.reason }] : [{ key: 'IP', value: entry.ip }],
        })
      }
    }
    // Same second: the general log's entries before the peers', then the later id first.
    return all.sort((a, b) => b.timestamp - a.timestamp || Number(a.key[0] === 'p') - Number(b.key[0] === 'p') || b.id - a.id).slice(0, MAX_ROWS)
  }, [mainRows, peers.data, search, shown, hidden])

  // Counts of every level's entries, before the search and whether or not the level is shown.
  const counts = useMemo(() => {
    const result: Record<number, number> = {}
    for (const log of main.data ?? []) result[log.type] = (result[log.type] ?? 0) + 1
    return result
  }, [main.data])

  const [exporting, setExporting] = useState(false)
  const exportLogs = () => {
    const text = buildLogText(rows.map(row => ({ timestamp: row.timestamp, level: row.level, message: row.message })))
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const link = document.createElement('a')
    link.href = url
    link.download = logFileName('main')
    link.click()
    URL.revokeObjectURL(url)
  }

  const loading = main.isLoading || (shown.peers && peers.isLoading)

  return (
    <div className="space-y-4">
      <PageHeader title={t('Logs')} />
      {/* It ends where the torrent table does on phones (see FILL_BOTTOM). */}
      <Card className={FILL_BOTTOM}>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-1">
            {/* The search keeps room to type in; on a phone the filter's label is cut short first. */}
            <SearchInput className="me-1 min-w-32 flex-1" aria-label={t('Filter log messages')} placeholder={t('Search')} value={search} onValueChange={setSearch} />
            <LogFilter shown={shown} onShownChange={setShown} counts={counts} peerCount={peers.data?.length} hidden={hidden} onHiddenChange={changeHidden} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0" title={t('Settings')} aria-label={t('Settings')}>
                  <Settings />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {/* Stays open when switched, so the change can be seen. The switch only shows the
                    state: the whole row is the control. */}
                <DropdownMenuItem role="menuitemcheckbox" aria-checked={autoScroll} className="justify-between" onSelect={(e) => { e.preventDefault(); changeAutoScroll(!autoScroll) }}>
                  {t('Auto Scroll')}
                  <Switch aria-hidden tabIndex={-1} readOnly checked={autoScroll} className="pointer-events-none" />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={rows.length === 0} onSelect={() => setExporting(true)}><Download />{t('Export logs')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <LogWindow
            rows={rows}
            latest={[newestId(main.data), shown.peers ? newestId(peers.data) : undefined]}
            autoScroll={autoScroll}
            onOpen={setOpen}
            note={loading ? <Note>{t('Loading logs...')}</Note>
              : main.isError && !main.data ? <Note>{t('Couldn\'t load the log')}</Note>
              : rows.length === 0 ? <Note>{t('No matching entries')}</Note>
              : null}
          />
        </CardContent>
      </Card>
      {/* Asks first, as the file is the entries shown; Enter exports. */}
      <Dialog open={exporting} onOpenChange={setExporting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Export logs?')}</DialogTitle>
            <DialogDescription>{t('Saves the {count} entries shown, with the search and filters applied, as {file}.', { count: rows.length, file: logFileName('main') })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExporting(false)}>{t('Cancel')}</Button>
            <Button onClick={() => { setExporting(false); exportLogs() }}><Download />{t('Export')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {open && <LogEntryDialog row={open} onClose={() => setOpen(null)} onHide={(key) => changeHidden([...new Set([...hidden, key])])} />}
    </div>
  )
}
