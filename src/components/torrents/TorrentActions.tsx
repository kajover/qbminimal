import { useState, type FormEvent, type ReactNode } from 'react'
import { changeTags } from '@/lib/tagChanges'
import { ArrowDown, ArrowDownToLine, ArrowLeftRight, ArrowUp, ArrowUpToLine, Check, FileCheck, List, FolderInput, Megaphone, Pause, Play, Trash2, Rocket, WandSparkles, Zap, type LucideIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useApiFeature, useCategories, useTorrentAction, useTorrents } from '@/hooks/useApi'
import { moveToQueuePosition, planQueueMoves, queueLength } from '@/lib/queuePosition'
import { qbitClient, type QueueMove } from '@/lib/api'
import { parseTags } from '@/lib/torrentFilters'
import { toast } from '@/hooks/use-toast'
import { DetailsHeading } from './DetailsHeading'
import { ShareLimitsForm } from './ShareLimitsForm'
import { SSLParametersForm } from './SSLParametersForm'
import type { Torrent } from '@/types'
import { ConfirmAction } from '@/components/ConfirmAction'
import { recheckMessage } from './BulkPromptDialog'
import { perLanguage, t } from '@/i18n'

// One headed part of the tab. All but the first are set off by a rule, as in the Details tab.
function Section({ title, first, children }: { title: string; first?: boolean; children: ReactNode }) {
  return (
    <section className={first ? undefined : 'border-t pt-3'}>
      <DetailsHeading>{title}</DetailsHeading>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

// The on/off options, as the torrent reports them.
type Flag = 'force_start' | 'seq_dl' | 'f_l_piece_prio' | 'super_seeding' | 'auto_tmm'

// One on/off option, as a button: its icon and name, and a check mark after them while it's on.
// The mark's room is kept while off, so the buttons don't shift.
function OptionButton({ label, icon: Icon, on, hint, onFlip }: { label: string; icon: LucideIcon; on: boolean; hint?: string; onFlip: () => void }) {
  return (
    <Button type="button" size="sm" variant="outline" className={SMALL} aria-pressed={on} title={hint} onClick={onFlip}>
      <Icon />
      {label}
      <Check className={cn('text-foreground', !on && 'invisible')} />
    </Button>
  )
}

// What each option's notification says once it's on, or off.
const FLAG_DONE = perLanguage((): Record<Flag, [on: string, off: string]> => ({
  force_start: [t('Force start on'), t('Force start off')],
  seq_dl: [t('Sequential download on'), t('Sequential download off')],
  f_l_piece_prio: [t('First and last pieces first on'), t('First and last pieces first off')],
  super_seeding: [t('Super seeding on'), t('Super seeding off')],
  auto_tmm: [t('Automatic management on'), t('Automatic management off')],
}))

// Buttons as small as Add peers in the Peers tab, so the tab stays compact.
const SMALL = 'h-7 gap-1 px-2 text-xs [&_svg:not([class*=size-])]:size-3.5'

const toKiB = (bytes: number) => (bytes > 0 ? String(Math.round(bytes / 1024)) : '0')

function FieldForm({ id, label, value, onChange, onSave, type = 'text', placeholder, pending, className, saveLabel, saveIcon: SaveIcon = Check }: {
  id: string
  // The button's name and icon, when saving does more than save, such as moving files.
  saveLabel?: string
  saveIcon?: LucideIcon
  // Its width: each field is only as wide as what it holds needs, so the Save button stays close.
  className?: string
  label: string
  value: string
  onChange: (value: string) => void
  onSave: () => Promise<void>
  type?: string
  placeholder?: string
  pending: boolean
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault()
    void onSave()
  }

  return (
    <form onSubmit={submit} className={cn('space-y-1', className)}>
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-2">
        <Input id={id} type={type} min={type === 'number' ? 0 : undefined} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="h-7 text-xs" />
        <Button type="submit" size="sm" variant="outline" className={SMALL} disabled={pending}><SaveIcon />{saveLabel ?? t('Save')}</Button>
      </div>
    </form>
  )
}

// Field values start from the torrent and don't follow refreshes, so typing isn't overwritten.
export function TorrentActions({ torrent, onDelete }: { torrent: Torrent; onDelete?: () => void }) {
  const hashes = [torrent.hash]
  const stopped = /^(stopped|paused)/.test(torrent.state)
  const action = useTorrentAction()
  const { data: categories } = useCategories()
  const canComment = useApiFeature('setComment')
  const [name, setName] = useState(torrent.name)
  const [location, setLocation] = useState(torrent.save_path)
  const [tags, setTags] = useState(parseTags(torrent.tags).join(', '))
  const [dlLimit, setDlLimit] = useState(toKiB(torrent.dl_limit))
  const [upLimit, setUpLimit] = useState(toKiB(torrent.up_limit))
  const [comment, setComment] = useState(torrent.comment ?? '')
  const [downloadPath, setDownloadPath] = useState(torrent.download_path ?? '')
  // qBittorrent reports 0 for torrents outside the queue, including all of them when queueing is off.
  const queued = torrent.priority > 0
  const { data: allTorrents } = useTorrents()
  const length = queueLength(allTorrents ?? [])
  // The field follows the torrent's position until something else is typed.
  const [position, setPosition] = useState(String(torrent.priority))
  const [shownFor, setShownFor] = useState(torrent.priority)
  if (shownFor !== torrent.priority) {
    setShownFor(torrent.priority)
    setPosition(String(torrent.priority))
  }
  const applyPosition = () => {
    if (!queued || position.trim() === '' || Number(position) === torrent.priority) return
    const target = Number(position)
    if (!Number.isInteger(target) || target < 1) {
      toast.error(t('Enter a whole number from 1'))
      setPosition(String(torrent.priority))
      return
    }
    void run(() => moveToQueuePosition(hashes, planQueueMoves(torrent.priority, target, 1, length)), t('Queue order changed'), t('Failed to change queue order'))
  }

  const run = (work: () => Promise<unknown>, done: string, failed: string) =>
    action.mutateAsync({ work, failed }).then(() => { toast.success(done) }, () => undefined)

  // An option shows its new state as soon as it's switched, before qBittorrent's next refresh, and
  // goes back if the change fails. The switch says it worked, so there's no notification.
  const [switched, setSwitched] = useState<Partial<Record<Flag, boolean>>>({})
  const settled = (Object.keys(switched) as Flag[]).filter(key => !!torrent[key] === switched[key])
  if (settled.length) setSwitched(current => Object.fromEntries(Object.entries(current).filter(([key]) => !settled.includes(key as Flag))))
  const isOn = (key: Flag) => switched[key] ?? !!torrent[key]
  // Its own change, so the other fields don't grey out while an option is switched. Once it's done
  // the torrent has been fetched again, so it shows what qBittorrent has from then on, including
  // changes made from the right-click menu.
  const optionAction = useTorrentAction()
  const forget = (key: Flag) => setSwitched(current => Object.fromEntries(Object.entries(current).filter(([other]) => other !== key)))
  // The button changes at once; the notification says when qBittorrent has made the change.
  const flip = (key: Flag, work: (on: boolean) => Promise<unknown>, failed: string) => {
    const on = !isOn(key)
    setSwitched(current => ({ ...current, [key]: on }))
    void optionAction.mutateAsync({ work: () => work(on), failed }).then(() => toast.success(on ? FLAG_DONE()[key][0] : FLAG_DONE()[key][1]), () => undefined).finally(() => forget(key))
  }
  const [confirmAuto, setConfirmAuto] = useState(false)

  const saveLimit = (value: string, set: typeof qbitClient.setDownloadLimit, done: string, failed: string) => {
    const kib = Number(value)
    if (!Number.isFinite(kib) || kib < 0) {
      toast.error(t('Enter 0 or a higher number'))
      return Promise.resolve()
    }
    return run(() => set.call(qbitClient, hashes, Math.round(kib * 1024)), done, failed)
  }

  const saveTags = () => {
    const current = parseTags(torrent.tags)
    const next = parseTags(tags)
    const added = next.filter(tag => !current.includes(tag))
    const removed = current.filter(tag => !next.includes(tag))
    return run(() => changeTags(hashes, added, removed), t('Tags saved'), t('Failed to save tags'))
  }

  return (
    // Laid out by the panel's own width, which differs from the window's.
    <div className="@container space-y-4 px-2 pt-1 pb-3">
      <Section title={t('Transfer')} first>
      {/* In the same order as the torrent menus: Start, Stop, Force start, Recheck, Reannounce. */}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" className={SMALL} disabled={!stopped} onClick={() => run(() => qbitClient.resumeTorrents(hashes), t('Started {name}', { name: torrent.name }), t('Failed to resume'))}>
          <Play />{t('Start')}
        </Button>
        <Button type="button" size="sm" variant="outline" className={SMALL} disabled={stopped} onClick={() => run(() => qbitClient.pauseTorrents(hashes), t('Stopped {name}', { name: torrent.name }), t('Failed to pause'))}>
          <Pause />{t('Stop')}
        </Button>
        <OptionButton label={t('Force start')} icon={Zap} on={isOn('force_start')} onFlip={() => flip('force_start', on => qbitClient.setForceStart(hashes, on), t('Failed to change force start'))} />
        <ConfirmAction
          label={t('Recheck')} buttonLabel={t('Recheck')} buttonIcon={FileCheck} buttonClassName={SMALL} safe
          title={t('Recheck the data?')} message={recheckMessage(1)} confirmLabel={t('Recheck')}
          onConfirm={() => run(() => qbitClient.recheckTorrents(hashes), t('Recheck started'), t('Failed to start recheck'))}
        />
        {/* A disabled button shows no tooltip, so the wrapper carries it. */}
        <span className={stopped ? 'cursor-not-allowed' : undefined} title={stopped ? t('Start the torrent first: stopped torrents don\'t contact trackers') : t('Ask the trackers for more peers now')}>
          <Button type="button" size="sm" variant="outline" className={SMALL} disabled={stopped} onClick={() => run(() => qbitClient.reannounceTorrents(hashes), t('Reannounce sent'), t('Failed to reannounce'))}>
            <Megaphone />{t('Reannounce')}
          </Button>
        </span>
      </div>
      </Section>

      <Section title={t('Options')}>
        {/* Every option shows, whether or not the torrent is complete. Side by side where there's room. */}
        <div className="flex flex-wrap gap-2">
          <OptionButton label={t('Sequential download')} icon={List} on={isOn('seq_dl')} onFlip={() => flip('seq_dl', () => qbitClient.toggleSequentialDownload(hashes), t('Failed to change sequential download'))} />
          <OptionButton label={t('Download first and last pieces first')} icon={ArrowLeftRight} on={isOn('f_l_piece_prio')} onFlip={() => flip('f_l_piece_prio', () => qbitClient.toggleFirstLastPiecePrio(hashes), t('Failed to change piece order'))} />
          <OptionButton label={t('Super seeding')} icon={Rocket} hint={t('Sends each peer different pieces, to spread a new torrent faster')} on={isOn('super_seeding')} onFlip={() => flip('super_seeding', on => qbitClient.setSuperSeeding(hashes, on), t('Failed to change super seeding'))} />
          {/* Turning it on can move files, so that asks first. */}
          <OptionButton label={t('Automatic management')} icon={WandSparkles} hint={t('qBittorrent sets this torrent\'s location from its category')} on={isOn('auto_tmm')} onFlip={() => (isOn('auto_tmm') ? flip('auto_tmm', on => qbitClient.setAutoManagement(hashes, on), t('Failed to change automatic management')) : setConfirmAuto(true))} />
        </div>
        <Dialog open={confirmAuto} onOpenChange={setConfirmAuto}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('Turn on automatic management?')}</DialogTitle>
              <DialogDescription>{t('qBittorrent will set this torrent\'s location from its category, and may move its files to the category\'s save path.')}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmAuto(false)}>{t('Cancel')}</Button>
              <Button type="button" onClick={() => { setConfirmAuto(false); flip('auto_tmm', on => qbitClient.setAutoManagement(hashes, on), t('Failed to change automatic management')) }}>{t('Turn on')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Section>

      <Section title={t('Queue')}>
        <div className="text-xs text-muted-foreground tabular-nums">
          {queued ? t('Queue position: {position}', { position: torrent.priority }) : t('Queue position: not queued')}
        </div>
        <div className="flex gap-2" title={queued ? undefined : t('Only queued torrents can be moved. Queueing must be on in Settings > Queueing.')}>
          {([
            ['top', 'Move to top', ArrowUpToLine],
            ['up', 'Move up', ArrowUp],
            ['down', 'Move down', ArrowDown],
            ['bottom', 'Move to bottom', ArrowDownToLine],
          ] as [QueueMove, string, typeof ArrowUp][]).map(([direction, label, Icon]) => (
            <Button key={direction} type="button" size="icon" variant="outline" className="size-7" aria-label={t(label)} title={queued ? t(label) : undefined} disabled={action.isPending || !queued} onClick={() => run(() => qbitClient.moveInQueue(hashes, direction), t('Queue order changed'), t('Failed to change queue order'))}>
              <Icon className="size-4" />
            </Button>
          ))}
          {/* Or a position, typed in: applied with Enter, or on leaving the field. */}
          <form className="flex" onSubmit={(e) => { e.preventDefault(); applyPosition() }}>
            <Input aria-label={t('Queue position')} title={queued ? t('Set queue position') : undefined} type="number" inputMode="numeric" enterKeyHint="done" min={1} max={length} step={1} className="h-7 w-20 text-xs" disabled={!queued || action.isPending} value={queued ? position : ''} placeholder="-" onChange={(e) => setPosition(e.target.value)} onBlur={applyPosition} />
          </form>
        </div>
      </Section>

      {/* Side by side where there's room, each only as wide as it needs, so the fields and their
          Save buttons don't stretch across a wide panel. */}
      <Section title={t('Organize')}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
      <div className="w-full space-y-1 @md:w-56">
        <Label htmlFor="torrent-category" className="text-xs text-muted-foreground">{t('Category')}</Label>
        <select
          id="torrent-category"
          value={torrent.category}
          disabled={action.isPending}
          onChange={(e) => {
            // Read now: the controlled select goes back to the current category until the refresh.
            const category = e.target.value
            run(() => qbitClient.setCategory(hashes, category), t('Category saved'), t('Failed to save category'))
          }}
          className="border-input dark:bg-input/30 h-7 w-full rounded-md border bg-transparent px-2 text-xs"
        >
          <option value="">{t('No category')}</option>
          {torrent.category && !categories?.[torrent.category] && <option value={torrent.category}>{torrent.category}</option>}
          {Object.keys(categories ?? {}).map(category => <option key={category} value={category}>{category}</option>)}
        </select>
      </div>

      <FieldForm id="torrent-tags" className="w-full @md:w-80" label={t('Tags, separated by commas')} value={tags} onChange={setTags} onSave={saveTags} pending={action.isPending} />
      <FieldForm id="torrent-name" className="w-full @md:w-[26rem]" label={t('Name')} value={name} onChange={setName} pending={action.isPending} onSave={() => run(() => qbitClient.renameTorrent(torrent.hash, name.trim()), 'Renamed', t('Failed to rename'))} />
      <FieldForm id="torrent-location" className="w-full @md:w-[26rem]" label={t('Move files to')} saveLabel={t('Move')} saveIcon={FolderInput} value={location} onChange={setLocation} pending={action.isPending} onSave={() => run(() => qbitClient.setLocation(hashes, location.trim()), t('Move started'), t('Failed to move'))} />
      <FieldForm id="torrent-download-path" className="w-full @md:w-[26rem]" label={t('Folder for incomplete files (blank = save location)')} value={downloadPath} onChange={setDownloadPath} pending={action.isPending} onSave={() => run(() => qbitClient.setDownloadPath(hashes, downloadPath.trim()), t('Incomplete files folder saved'), t('Failed to save incomplete files folder'))} />
      {torrent.comment !== undefined && (
        // A row of its own, with room for a few lines.
        <form className="w-full max-w-3xl space-y-1" onSubmit={(e) => { e.preventDefault(); void run(() => qbitClient.setComment(hashes, comment.trim()), t('Comment saved'), t('Failed to save comment')) }}>
          <Label htmlFor="torrent-comment" className="text-xs text-muted-foreground">{canComment ? t('Comment') : t('Comment (changing it needs qBittorrent 5.2 or newer)')}</Label>
          <div className="flex items-start gap-2">
            <Textarea id="torrent-comment" readOnly={!canComment} rows={3} wrapperClassName="min-w-0 flex-1" value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.currentTarget.form?.requestSubmit() } }} className="min-h-16 text-xs" />
            <Button type="submit" size="sm" variant="outline" className={SMALL} disabled={action.isPending || !canComment} title={t('Ctrl or ⌘ and Enter')}><Check />{t('Save')}</Button>
          </div>
        </form>
      )}
      </div>
      </Section>

      <Section title={t('Limits')}>
      {/* The seeding limits follow the speed limits on the same row where there's room. */}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
      <FieldForm id="torrent-dl-limit" className="w-full @md:w-60" label={t('Download limit (KiB/s, 0 = unlimited)')} type="number" value={dlLimit} onChange={setDlLimit} pending={action.isPending} onSave={() => saveLimit(dlLimit, qbitClient.setDownloadLimit, t('Download limit saved'), t('Failed to save download limit'))} />
      <FieldForm id="torrent-up-limit" className="w-full @md:w-60" label={t('Upload limit (KiB/s, 0 = unlimited)')} type="number" value={upLimit} onChange={setUpLimit} pending={action.isPending} onSave={() => saveLimit(upLimit, qbitClient.setUploadLimit, t('Upload limit saved'), t('Failed to save upload limit'))} />
      <ShareLimitsForm torrent={torrent} className="w-full @md:w-auto @md:max-w-xl" />
      </div>
      <div className="max-w-3xl"><SSLParametersForm hash={torrent.hash} /></div>
      </Section>

      {/* Last and apart, as in the menus; it asks first. */}
      {onDelete && (
        <Section title={t('Delete')}>
          <Button type="button" size="sm" variant="outline" className={cn(SMALL, 'text-destructive hover:text-destructive')} onClick={onDelete}><Trash2 />{t('Delete')}</Button>
        </Section>
      )}
    </div>
  )
}
