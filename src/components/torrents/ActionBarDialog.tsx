import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { DEFAULT_BAR_ACTIONS, toggleBarAction, type BarKind } from '@/lib/actionBar'
import type { MenuGroup } from './bulkActions'
import { t } from '@/i18n'

// Pins actions from the More menu to the selection bar, or takes them off it.
export function ActionBarDialog({ kind, open, onOpenChange, groups, pinned, onChange }: {
  kind: BarKind
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: MenuGroup[]
  pinned: string[]
  onChange: (ids: string[]) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Actions in the bar')}</DialogTitle>
          <DialogDescription>{kind === 'wide' ? t('Pinned actions show as buttons in the selection bar on wide screens. All of them stay in the More menu.') : t('Pinned actions show as buttons in the selection bar on phones. All of them stay in the More menu.')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {groups.map(group => (
            <fieldset key={group.name} className="grid gap-1">
              <legend className="mb-1 text-xs font-medium text-muted-foreground">{t(group.name)}</legend>
              {group.entries.map(entry => {
                const id = `bar-action-${entry.id}`
                const Icon = entry.icon
                return (
                  <div key={entry.id} className="flex items-center gap-2">
                    <Checkbox id={id} checked={pinned.includes(entry.id)} onCheckedChange={() => onChange(toggleBarAction(pinned, entry.id))} />
                    <Label htmlFor={id} className="flex items-center gap-2 font-normal">
                      {Icon && <Icon className="size-4 text-muted-foreground" />}
                      {entry.label}
                    </Label>
                  </div>
                )
              })}
            </fieldset>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onChange(DEFAULT_BAR_ACTIONS[kind])}>{t('Reset')}</Button>
          <Button type="button" onClick={() => onOpenChange(false)}>{t('Done')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
