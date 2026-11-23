import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ALT, MOD } from '@/lib/shortcutKeys'
import { cn } from '@/lib/utils'
import { perLanguage, t } from '@/i18n'


const GROUPS = perLanguage((): { title: string; keys: [string[], string][] }[] => [
  {
    title: t('Mouse'),
    keys: [
      [[t('Click')], t('Select a torrent and show its details')],
      [[MOD, t('Click')], t('Add or remove')],
      [[t('Shift'), t('Click')], t('Select everything up to here')],
      [[t('Right-click')], t('Actions for the selection')],
    ],
  },
  {
    title: t('Filter sidebar'),
    keys: [
      [[t('Click')], t('Show only these')],
      [[MOD, t('Click')], t('Hide these')],
      [[t('Hold')], t('Hide these, on touch screens')],
    ],
  },
  {
    title: t('Keyboard'),
    keys: [
      [['↑', '↓'], t('Move to the torrent above or below')],
      [[t('Shift'), '↑ ↓'], t('Extend the selection')],
      [[t('Home'), t('End')], t('Move to the first or last torrent')],
      [[t('Enter')], t('Show details')],
      [[t('Space')], t('Select or unselect')],
      [[MOD, 'A'], t('Select every torrent')],
      [[MOD, t('Shift'), 'A'], t('Unselect every torrent')],
      [[MOD, 'I'], t('Select the others instead')],
      [[t('Shift'), 'F10'], t('Actions for the selection')],
      [['S'], t('Search')],
      [['F'], t('Show or hide the filters')],
      [['N'], t('Add torrents, a feed or a rule')],
      [['V'], t('Switch between table, compact and cards')],
      [['G', '1–7'], t('Go to a page, in the menu\'s order')],
      [[t('Esc')], t('Close the details, then clear the selection')],
      [['?'], t('Show this list')],
    ],
  },
  {
    title: t('Actions for the selection'),
    keys: [
      [[ALT, 'S'], t('Start the selection')],
      [[ALT, 'P'], t('Stop the selection')],
      [[ALT, 'D', '/', 'Del'], t('Delete the selection')],
      [[ALT, 'F'], t('Force start')],
      [[ALT, 'R'], t('Recheck')],
      [[ALT, 'A'], t('Reannounce')],
      [[ALT, 'C'], t('Category')],
      [[ALT, 'T'], t('Tags')],
      [[ALT, 'L'], t('Location')],
      [[ALT, 'E'], t('Speed limits')],
      [[ALT, 'W'], t('Seeding limits')],
      [[ALT, 'M'], t('Comment')],
      [[ALT, t('Home')], t('Move to top')],
      [[ALT, '↑'], t('Move up')],
      [[ALT, '↓'], t('Move down')],
      [[ALT, t('End')], t('Move to bottom')],
      [[ALT, 'Q'], t('Set queue position')],
      [[ALT, 'U'], t('Sequential download')],
      [[ALT, 'I'], t('Download first and last pieces first')],
      [[ALT, 'B'], t('Super seeding')],
      [[ALT, 'O'], t('Automatic management')],
      [[ALT, 'N'], t('Copy name')],
      [[ALT, 'H'], t('Copy hash')],
      [[ALT, 'G'], t('Copy magnet link')],
      [[ALT, 'X'], t('Export .torrent')],
    ],
  },
])

// The list of keys and clicks, in the window ? opens on the torrent list and Settings > App opens.
function ShortcutsList() {
  return (
    <>
      {GROUPS().map(group => (
        <section key={group.title} className="space-y-1.5">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{group.title}</h3>
          {/* Long groups take two columns where there's room. */}
          <dl className={cn('grid gap-x-8 gap-y-1 text-sm', group.keys.length > 8 && 'sm:grid-cols-2')}>
            {group.keys.map(([keys, what]) => (
              <div key={what + keys.join()} className="flex items-center justify-between gap-4">
                <dt className="flex shrink-0 items-center gap-1">
                  {/* A slash between two ways to do the same. */}
                  {keys.map(key => (key === '/' ? <span key={key} className="text-muted-foreground">/</span> : <kbd key={key} className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{key}</kbd>))}
                </dt>
                <dd className="text-end text-muted-foreground">{what}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </>
  )
}

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-h-[85vh] space-y-3 overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('Keyboard and mouse')}</DialogTitle>
        </DialogHeader>
        <ShortcutsList />
      </DialogContent>
    </Dialog>
  )
}
