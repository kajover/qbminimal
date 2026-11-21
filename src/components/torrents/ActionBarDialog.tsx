import { ArrowDown, ArrowUp } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { DEFAULT_BAR_ACTIONS, toggleBarAction, type BarKind } from '@/lib/actionBar'
import type { MenuEntry, MenuGroup } from './bulkActions'
import { toast } from '@/hooks/use-toast'
import { t } from '@/i18n'

// One action with its checkbox; pinned ones also have arrows to move them along the bar.
function ActionRow({ entry, checked, onToggle, onMove }: { entry: MenuEntry; checked: boolean; onToggle: () => void; onMove?: { up?: () => void; down?: () => void } }) {
  const id = `bar-action-${entry.id}`
  const Icon = entry.icon
  return (
    <div className="flex min-h-7 items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={onToggle} />
      <Label htmlFor={id} className="flex min-w-0 flex-1 items-center gap-2 font-normal">
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
        <span className="truncate">{entry.label}</span>
      </Label>
      {onMove && (
        <span className="flex shrink-0 gap-1">
          <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`${entry.label}: ${t('Move up')}`} title={t('Move up')} disabled={!onMove.up} onClick={onMove.up}><ArrowUp className="size-3.5" /></Button>
          <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`${entry.label}: ${t('Move down')}`} title={t('Move down')} disabled={!onMove.down} onClick={onMove.down}><ArrowDown className="size-3.5" /></Button>
        </span>
      )}
    </div>
  )
}

// Pins actions from the More menu to the selection bar, or takes them off it. The pinned ones are
// listed first, in the bar's order, which their arrows change; the others below, by menu group.
// A newly pinned action goes to the bar's end.
export function ActionBarDialog({ kind, open, onOpenChange, groups, pinned, onChange }: {
  kind: BarKind
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: MenuGroup[]
  pinned: string[]
  onChange: (ids: string[]) => void
}) {
  const entries = groups.flatMap(group => group.entries)
  const pinnedEntries = pinned.flatMap(id => entries.filter(entry => entry.id === id))
  const move = (from: number, to: number) => {
    const ids = pinnedEntries.map(entry => entry.id)
    ;[ids[from], ids[to]] = [ids[to], ids[from]]
    onChange(ids)
  }
  const toggle = (id: string) => onChange(toggleBarAction(pinned, id))
  const defaults = DEFAULT_BAR_ACTIONS[kind]
  const isDefault = pinned.length === defaults.length && pinned.every((id, i) => id === defaults[i])
  const reset = () => {
    onChange(defaults)
    toast.success(t('Selection bar reset'))
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Selection Bar')}</DialogTitle>
          <DialogDescription>{t('Pinned actions show as buttons in the bar.')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {pinnedEntries.length > 0 && (
            <fieldset className="grid gap-1">
              <legend className="mb-1 text-xs font-medium text-muted-foreground">{t('In the bar')}</legend>
              {pinnedEntries.map((entry, i) => (
                <ActionRow key={entry.id} entry={entry} checked onToggle={() => toggle(entry.id)} onMove={{
                  up: i > 0 ? () => move(i, i - 1) : undefined,
                  down: i < pinnedEntries.length - 1 ? () => move(i, i + 1) : undefined,
                }} />
              ))}
            </fieldset>
          )}
          {groups.map(group => {
            const rest = group.entries.filter(entry => !pinned.includes(entry.id))
            return rest.length > 0 && (
              <fieldset key={group.name} className="grid gap-1">
                <legend className="mb-1 text-xs font-medium text-muted-foreground">{t(group.name)}</legend>
                {rest.map(entry => <ActionRow key={entry.id} entry={entry} checked={false} onToggle={() => toggle(entry.id)} />)}
              </fieldset>
            )
          })}
        </div>
        <DialogFooter>
          {/* Only when the bar differs from the default, the order included. */}
          <Button type="button" variant="ghost" disabled={isDefault} onClick={reset}>{t('Reset')}</Button>
          <Button type="button" onClick={() => onOpenChange(false)}>{t('Done')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
