import { ArrowDown, ArrowUp, ArrowUpDown, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { t } from '@/i18n'

// Sorting in the details tabs' lists: a menu of the fields behind the arrows, and column titles
// that sort when clicked. Picking the sorted field again turns the order around.
export interface ListSort<F extends string> {
  field: F
  descending: boolean
}

export function nextSort<F extends string>(sort: ListSort<F>, field: F, descendingFirst = false): ListSort<F> {
  return { field, descending: field === sort.field ? !sort.descending : descendingFirst }
}

// `onReset` goes back to the list's own order, as in the torrent cards' sort menu; it's greyed out
// while that's the order shown (`isDefault`).
export function SortMenu<F extends string>({ fields, sort, onSort, onReset, isDefault }: { fields: [F, string][]; sort: ListSort<F>; onSort: (field: F) => void; onReset?: () => void; isDefault?: boolean }) {
  const arrow = sort.descending ? '↓' : '↑'
  const label = t('Sort: {column}', { column: fields.find(([field]) => field === sort.field)?.[1] ?? '' })
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="size-7" aria-label={label} title={`${label} ${arrow}`}>
          <ArrowUpDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t('Sort by')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {fields.map(([field, name]) => (
          <DropdownMenuItem key={field} onClick={() => onSort(field)}>
            {name} {sort.field === field && arrow}
          </DropdownMenuItem>
        ))}
        {onReset && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={isDefault} onClick={onReset}><RotateCcw />{t('Reset sorting')}</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// A column title that sorts by its column, with an arrow while it does. On phones it's only a
// title: the sort button does it there, and small titles are hard to hit.
export function SortTitle<F extends string>({ field, sort, onSort, children, className }: { field: F; sort: ListSort<F>; onSort: (field: F) => void; children: string; className?: string }) {
  const sorted = sort.field === field
  const wide = useMediaQuery('(min-width: 640px)')
  if (!wide) return <span className={cn('block truncate uppercase', className)}>{children}</span>
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      title={t('Sort by {label}', { label: children })}
      className={cn('inline-flex items-center gap-1 whitespace-nowrap uppercase hover:text-foreground', sorted && 'text-foreground', className)}
    >
      {/* Never cut short: the columns leave room for the title and its arrow. */}
      <span>{children}</span>
      {sorted && (sort.descending ? <ArrowDown className="size-3 shrink-0" /> : <ArrowUp className="size-3 shrink-0" />)}
    </button>
  )
}
