import { ArrowUpDown, Columns3, Keyboard, LayoutList, Plus, RotateCcw, Search, Table2 } from 'lucide-react'
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
  onAdd: () => void
}

// Opens the add form over the list, without leaving it.
export function AddTorrentButton({ onAdd }: { onAdd: () => void }) {
  return (
    <Button variant="outline" size="icon" className="size-8" aria-label={t('Add torrents')} title={t('Add torrents')} onClick={onAdd}>
      <Plus className="size-4" />
    </Button>
  )
}

export function TorrentToolbar({ list, filtersOpen, onToggleFilters, columns, onColumnsChange, onShowShortcuts, onAdd }: TorrentToolbarProps) {
  const arrow = list.sort.direction === 'asc' ? '↑' : '↓'
  return (
    <>
      {/* Only where there's a mouse, which usually means a keyboard too. */}
      <Button variant="ghost" size="icon" className="hidden size-8 pointer-fine:inline-flex" aria-label={t('Keyboard shortcuts')} title={t('Keyboard shortcuts (?)')} onClick={onShowShortcuts}>
        <Keyboard className="size-4" />
      </Button>
      <AddTorrentButton onAdd={onAdd} />
      <Button variant={filtersOpen ? 'secondary' : 'outline'} size="icon" className="relative size-8" aria-label={list.filtered ? t('Search and filter (filters on)') : t('Search and filter')} title={list.filtered ? t('Search and filter (filters on)') : t('Search and filter')} aria-expanded={filtersOpen} aria-controls="torrent-filters" onClick={onToggleFilters}>
        <Search className="size-4" />
        {/* A dot while any filter hides torrents, as the chips above the list may be out of view. */}
        {list.filtered && <span aria-hidden className="absolute -end-0.5 -top-0.5 size-2.5 rounded-full bg-primary ring-2 ring-background" />}
      </Button>

      {list.showTable ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="size-8" aria-label={t('Columns')} title={t('Choose columns')}>
              <Columns3 className="size-4" />
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
            <DropdownMenuItem onClick={() => { onColumnsChange(DEFAULT_COLUMN_LAYOUT); list.resetSort() }}><RotateCcw className="size-4" />{t('Reset columns')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {/* Just the arrows; the menu says what it sorts by. */}
            <Button variant="outline" size="icon" className="size-8" aria-label={t('Sort: {column}', { column: getColumn(list.sort.field).label })} title={`${t('Sort: {column}', { column: getColumn(list.sort.field).label })} ${arrow}`}>
              <ArrowUpDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-[60vh] overflow-y-auto">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t('Sort by')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {CARD_SORTS.map(field => (
              <DropdownMenuItem key={field} onClick={() => list.sortBy(field)}>
                {getColumn(field).label} {list.sort.field === field && arrow}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* One button that switches to the other view, showing that view's icon. */}
      <Button variant="outline" size="icon" className="size-8" aria-label={list.showTable ? t('Card view') : t('Table view')} title={list.showTable ? t('Card view') : t('Table view')} onClick={() => list.showAsTable(!list.showTable)}>
        {list.showTable ? <LayoutList className="size-4" /> : <Table2 className="size-4" />}
      </Button>
    </>
  )
}
