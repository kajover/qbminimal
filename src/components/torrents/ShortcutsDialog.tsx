import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { t } from '@/i18n'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = isMac ? '⌘' : 'Ctrl'

const GROUPS: { title: string; keys: [string[], string][] }[] = [
  {
    title: t('Mouse'),
    keys: [
      [[t('Click')], t('Select a torrent and show its details')],
      [[MOD, t('Click')], t('Add to or remove from the selection')],
      [[t('Shift'), t('Click')], t('Select everything up to here')],
      [[t('Right-click')], t('Actions for the selection')],
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
      [[MOD, 'A'], t('Select every torrent that matches the filters')],
      [[t('Delete')], t('Delete the selection')],
      [[t('Shift'), 'F10'], t('Actions for the selection')],
      [['/'], t('Search and filter')],
      [[t('Esc')], t('Close the details, then clear the selection')],
      [['?'], t('Show this list')],
    ],
  },
]

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Keyboard and mouse')}</DialogTitle>
          <DialogDescription>{t('Shortcuts for the torrent list. On a phone, tap a torrent for its details and hold one to start selecting.')}</DialogDescription>
        </DialogHeader>
        {GROUPS.map(group => (
          <section key={group.title} className="space-y-1.5">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{group.title}</h3>
            <dl className="space-y-1 text-sm">
              {group.keys.map(([keys, what]) => (
                <div key={what + keys.join()} className="flex items-center justify-between gap-4">
                  <dt className="flex shrink-0 gap-1">
                    {keys.map(key => <kbd key={key} className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{key}</kbd>)}
                  </dt>
                  <dd className="text-end text-muted-foreground">{what}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </DialogContent>
    </Dialog>
  )
}
