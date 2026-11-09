import { ArrowUpDown, Columns3, Keyboard, LayoutList, Search, Table2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { TorrentList } from '@/hooks/useTorrentList'
import type { SortField } from '@/lib/listSettings'
import { DEFAULT_COLUMN_LAYOUT, getColumn, toggleColumn, type ColumnLayout } from '@/lib/torrentColumns'
import { t } from '@/i18n'

// What a card shows, or matters most, for sorting cards. The table sorts from its headers.
const CARD_SORTS: SortField[] = ['priority', 'name', 'state', 'progress', 'size', 'dlspeed', 'upspeed', 'eta', 'ratio', 'num_seeds', 'num_leechs', 'added_on', 'completion_on', 'category']

interface TorrentToolbarProps {
  list: TorrentList
  filtersOpen: boolean
  onToggleFilters: () => void
  columns: ColumnLayout
  onColumnsChange: (layout: ColumnLayout) => void
  onShowShortcuts: () => void
}

export function TorrentToolbar({ list, filtersOpen, onToggleFilters, columns, onColumnsChange, onShowShortcuts }: TorrentToolbarProps) {
  const arrow = list.sort.direction === 'asc' ? '↑' : '↓'
  return (
    <>
      {/* Only where there's a mouse, which usually means a keyboard too. */}
      <Button variant="ghost" size="icon" className="hidden h-8 w-8 pointer-fine:inline-flex" aria-label={t('Keyboard shortcuts')} title={t('Keyboard shortcuts (?)')} onClick={onShowShortcuts}>
        <Keyboard className="h-4 w-4" />
      </Button>
      <Button variant={filtersOpen || list.filtered ? 'secondary' : 'outline'} size="icon" className="h-8 w-8" aria-label={t('Search and filter')} title={t('Search and filter')} aria-expanded={filtersOpen} aria-controls="torrent-filters" onClick={onToggleFilters}>
        <Search className="h-4 w-4" />
      </Button>

      {list.showTable ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8" aria-label={t('Columns')} title={t('Choose columns')}>
              <Columns3 className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-[70vh] w-56 overflow-y-auto">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t('Drag headers to reorder, or drag their edges to resize')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columns.order.map(id => (
              <DropdownMenuCheckboxItem key={id} checked={!columns.hidden.includes(id)} disabled={id === 'name'} onSelect={(e) => e.preventDefault()} onCheckedChange={() => onColumnsChange(toggleColumn(columns, id))}>
                {getColumn(id).label}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { onColumnsChange(DEFAULT_COLUMN_LAYOUT); list.resetSort() }}>{t('Reset columns')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowUpDown className="h-4 w-4" />
              {t('Sort: {column}', { column: getColumn(list.sort.field).label })} {arrow}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-[60vh] overflow-y-auto">
            {CARD_SORTS.map(field => (
              <DropdownMenuItem key={field} onClick={() => list.sortBy(field)}>
                {getColumn(field).label} {list.sort.field === field && arrow}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <div className="flex rounded-md border" role="group" aria-label={t('View')}>
        <Button variant={list.showTable ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-e-none" aria-label={t('Table view')} title={t('Table view')} aria-pressed={list.showTable} onClick={() => list.showAsTable(true)}>
          <Table2 className="h-4 w-4" />
        </Button>
        <Button variant={list.showTable ? 'ghost' : 'secondary'} size="icon" className="h-8 w-8 rounded-s-none" aria-label={t('Card view')} title={t('Card view')} aria-pressed={!list.showTable} onClick={() => list.showAsTable(false)}>
          <LayoutList className="h-4 w-4" />
        </Button>
      </div>
    </>
  )
}
