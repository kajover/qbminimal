import { type MouseEvent, type ReactNode } from 'react'
import { Check, ChevronRight, Minus, MoreHorizontal, Plus, type LucideIcon } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { SearchInput } from '@/components/SearchInput'
import { useLongPress } from '@/hooks/useLongPress'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

// The parts both filter sidebars are built from, on the torrent list and the Search page: folding
// sections with their own search field, choices with a tick box and a count, and the sheet that
// holds the sidebar on phones.

// What a section shows when its search matches nothing.
export const NothingMatches = () => <li className="px-2 py-1 text-sm text-muted-foreground">{t('Nothing matches')}</li>

// One choice: a tick box, its name and how many torrents it has, and for categories and tags a menu
// to change or delete it. The menu shows on hover with a mouse, and always on touch screens.
export function FilterItem({ label, icon: Icon, count, checked, excluded, onToggle, onExclude, muted, menu, single }: {
  label: string; icon: LucideIcon; count?: number; checked: boolean; onToggle: (event: MouseEvent) => void; muted?: boolean; menu?: ReactNode
  // Hidden: the torrents it matches are left out. Set with Ctrl or Cmd and a click, or a long press.
  excluded?: boolean
  onExclude?: () => void
  // A saved view is one choice at a time: no tick box, just marked while it's in force.
  single?: boolean
}) {
  // A finger held on the choice excludes it; the click that ends the hold does nothing more.
  const press = useLongPress(onExclude)
  return (
    <li className={cn('group flex items-center rounded-md hover:bg-accent/60', single && checked && 'bg-secondary')}>
      <button
        type="button" role={single ? undefined : 'checkbox'} aria-checked={single ? undefined : checked} aria-pressed={single ? checked : undefined}
        title={onExclude ? t('Click to show only these. Ctrl or ⌘ and click, or hold, to hide them.') : undefined}
        onClick={(e) => { if (!press.wasHeld()) onToggle(e) }}
        {...press.handlers}
        className="flex min-w-0 flex-1 touch-manipulation items-center gap-2 rounded-md px-2 py-1 text-start text-sm outline-hidden select-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {!single && (
          <span aria-hidden className={cn('flex size-4 shrink-0 items-center justify-center rounded-[4px] border', checked && 'border-primary bg-primary text-primary-foreground', excluded && 'border-destructive bg-destructive text-white')}>
            {checked && <Check className="size-3" />}
            {excluded && <Minus className="size-3" />}
          </span>
        )}
        <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className={cn('min-w-0 flex-1 truncate', muted && 'text-muted-foreground', excluded && 'text-muted-foreground line-through')} title={label}>{label}</span>
        {excluded && <span className="sr-only">{t('Hidden')}</span>}
        {count !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{count}</span>}
      </button>
      {/* Rows without a menu keep its room, so every count lines up. */}
      {menu ?? <span aria-hidden className="size-7 shrink-0" />}
    </li>
  )
}

export function ItemMenu({ name, children }: { name: string; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100" aria-label={t('More actions for {name}', { name })}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Section({ id, title, icon: Icon, chosen, folded, onFold, onAdd, addLabel, action, search, onSearch, children }: {
  id: string; title: string; icon: LucideIcon; chosen: number; folded: boolean; onFold: (id: string) => void; onAdd?: () => void; addLabel?: string
  // Another button in the title row, such as saving a view.
  action?: ReactNode
  // A field that narrows the section's choices by name.
  search?: string
  onSearch?: (text: string) => void
  children: ReactNode
}) {
  return (
    <section className="space-y-1">
      <div className="flex items-center gap-1">
        <button type="button" aria-expanded={!folded} onClick={() => onFold(id)} className="flex min-w-0 flex-1 items-center gap-1 rounded-md py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase hover:text-foreground">
          <ChevronRight className={cn('size-3.5 shrink-0 transition-transform', !folded && 'rotate-90')} />
          <Icon aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">{title}</span>
          {chosen > 0 && <span className="rounded-full bg-primary px-1.5 text-[0.7rem] leading-4 text-primary-foreground normal-case">{chosen}</span>}
        </button>
        {action}
        {onAdd && (
          <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={addLabel} title={addLabel} onClick={onAdd}>
            <Plus className="size-4" />
          </Button>
        )}
      </div>
      {!folded && onSearch && (
        <SearchInput aria-label={t('Search {section}', { section: title })} placeholder={t('Search {section}', { section: title })} value={search ?? ''} onValueChange={onSearch} inputClassName="h-7 text-sm" />
      )}
      {!folded && <ul className="space-y-px">{children}</ul>}
    </section>
  )
}

// On phones the sidebar slides in from the end edge, under the filter button, over the list.
export function FilterSheet({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          // The search field takes focus only where there's a keyboard.
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed inset-y-0 end-0 z-50 w-80 max-w-[85vw] overflow-y-auto border-s bg-background p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg outline-hidden data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right rtl:data-[state=open]:slide-in-from-left rtl:data-[state=closed]:slide-out-to-left"
        >
          <DialogPrimitive.Title className="sr-only">{t('Filters')}</DialogPrimitive.Title>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
