import { type MouseEvent, type ReactNode } from 'react'
import { Check, ChevronDown, ChevronRight, Minus, MoreHorizontal, Plus, X, type LucideIcon } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
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

// The sidebar's title row: the title with the filter button beside it, and Clear filters at the end.
// Clear filters clears both kinds; its arrow offers clearing only one. The funnel adds a column filter. The header's sidebar button
// closes the sidebar, so it has no close button of its own.
export function SidebarHeader({ title, filterButton, sidebarFiltered, columnFiltered, onClearSidebar, onClearColumns }: {
  title: string
  filterButton: ReactNode
  sidebarFiltered: boolean
  columnFiltered: boolean
  onClearSidebar: () => void
  onClearColumns: () => void
}) {
  const any = sidebarFiltered || columnFiltered
  return (
    <div className="flex items-center gap-1">
      <h3 className="truncate text-sm font-medium">{title}</h3>
      {filterButton}
      {/* Always there, greyed out while nothing is filtered. */}
      <div className="ms-auto flex shrink-0 items-center text-xs text-muted-foreground">
        <button type="button" disabled={!any} onClick={() => { if (sidebarFiltered) onClearSidebar(); if (columnFiltered) onClearColumns() }} className="rounded-s px-1 py-1 enabled:hover:text-foreground disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden">
          {t('Clear filters')}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" disabled={!any} aria-label={t('Choose which filters to clear')} title={t('Choose which filters to clear')} className="rounded-e border-s px-1 py-1 enabled:hover:text-foreground disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden">
              <ChevronDown className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={!sidebarFiltered} onSelect={onClearSidebar}>{t('Clear sidebar filters')}</DropdownMenuItem>
            <DropdownMenuItem disabled={!columnFiltered} onSelect={onClearColumns}>{t('Clear column filters')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export function Section({ id, title, icon: Icon, chosen, onClear, folded, onFold, onAdd, addLabel, action, search, onSearch, children }: {
  id: string; title: string; icon: LucideIcon; chosen: number; folded: boolean; onFold: (id: string) => void; onAdd?: () => void; addLabel?: string
  // Clears this section's choices only, from its count, which shows an x under the pointer.
  onClear?: () => void
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
        <button type="button" aria-expanded={!folded} onClick={() => onFold(id)} className={cn('flex min-w-0 items-center gap-1 rounded-md py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase hover:text-foreground', !(chosen > 0 && onClear) && 'flex-1')}>
          <ChevronRight className={cn('size-3.5 shrink-0 transition-transform', !folded && 'rotate-90')} />
          <Icon aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">{title}</span>
          {chosen > 0 && !onClear && <span className="rounded-full bg-primary px-1.5 text-[0.7rem] leading-4 text-primary-foreground normal-case">{chosen}</span>}
        </button>
        {chosen > 0 && onClear && (
          <button type="button" onClick={onClear} aria-label={t('Clear the {section} filter', { section: title })} title={t('Clear the {section} filter', { section: title })} className="group/clear me-auto flex h-4 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[0.7rem] leading-4 text-primary-foreground tabular-nums hover:bg-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden">
            <span className="group-hover/clear:hidden group-focus-visible/clear:hidden">{chosen}</span>
            <X aria-hidden className="hidden size-3 group-hover/clear:block group-focus-visible/clear:block" />
          </button>
        )}
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
