import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Filter, ListFilter, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { NativeSelect } from '@/components/NativeSelect'
import {
  describeFilter, fromDateInput, isActive, NONE, TEXT_OPERATORS, toDateInput, UNITS,
  type ColumnFilter, type ColumnFilters, type FilterKind, type TextOperator,
} from '@/lib/columnFilters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

// What the filter controls need to know about a column.
export interface FilterTarget {
  id: string
  label: string
  kind: FilterKind
  // The values a choice can pick from, with how many rows have each. Asked for when it opens.
  options?: () => { value: string; count: number }[]
  // How a value of a choice reads, such as "None" for the empty one.
  valueLabel?: (value: string) => string
}

const defaultValueLabel = (value: string) => (value === NONE ? t('None') : value)
const trim = (n: number) => String(Math.round(n * 1000) / 1000)

// The unit an existing bound reads best in: the largest it is at least one of.
function startUnit(kind: FilterKind, filter: ColumnFilter | undefined) {
  const units = UNITS[kind]
  if (!units) return 1
  const bound = filter?.type === 'range' ? filter.min ?? filter.max : undefined
  if (bound === undefined) return units[0].factor
  return [...units].sort((a, b) => b.factor - a.factor).find(u => bound >= u.factor)?.factor ?? Math.min(...units.map(u => u.factor))
}

// The form inside the popover: a text match, a range, or a choice of values, by the column's kind.
export function ColumnFilterEditor({ target, filter, onApply }: { target: FilterTarget; filter?: ColumnFilter; onApply: (filter: ColumnFilter | null) => void }) {
  const id = useId()
  const { kind } = target
  const valueLabel = target.valueLabel ?? defaultValueLabel
  const [op, setOp] = useState<TextOperator>(filter?.type === 'text' ? filter.op : 'contains')
  const [text, setText] = useState(filter?.type === 'text' ? filter.value : '')
  const [unit, setUnit] = useState(() => startUnit(kind, filter))
  const bound = (value: number | undefined) => (value === undefined ? '' : kind === 'date' ? toDateInput(value) : trim(value / unit))
  const [min, setMin] = useState(() => (filter?.type === 'range' ? bound(filter.min) : ''))
  const [max, setMax] = useState(() => (filter?.type === 'range' ? bound(filter.max) : ''))
  const [chosen, setChosen] = useState<string[]>(filter?.type === 'set' ? filter.values : [])
  const [options] = useState(() => target.options?.() ?? [])
  const [search, setSearch] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (kind === 'text') return onApply({ type: 'text', op, value: text })
    if (kind === 'set') return onApply({ type: 'set', values: chosen })
    const read = (value: string, end: boolean) => {
      if (value.trim() === '') return undefined
      if (kind === 'date') return fromDateInput(value, end)
      const n = Number(value.replace(',', '.'))
      return Number.isFinite(n) ? n * unit : undefined
    }
    let low = read(min, false)
    let high = read(max, true)
    if (low !== undefined && high !== undefined && low > high) [low, high] = [high, low]
    onApply({ type: 'range', ...(low !== undefined && { min: low }), ...(high !== undefined && { max: high }) })
  }

  const units = UNITS[kind]
  const shownOptions = search.trim() ? options.filter(o => valueLabel(o.value).toLowerCase().includes(search.trim().toLowerCase())) : options
  const rangeInput = (value: string, set: (value: string) => void, label: string, inputId: string) => (
    <div className="grid min-w-0 flex-1 gap-1">
      <Label htmlFor={inputId} className="text-xs text-muted-foreground">{label}</Label>
      <Input
        id={inputId}
        type={kind === 'date' ? 'date' : 'text'}
        inputMode={kind === 'date' ? undefined : 'decimal'}
        value={value}
        onChange={(e) => set(e.target.value)}
        className="h-8 text-sm"
        dir="ltr"
      />
    </div>
  )

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="text-sm font-medium">{t('Filter {label}', { label: target.label })}</div>
      {kind === 'text' && (
        <div className="flex gap-2">
          <NativeSelect aria-label={t('How to match')} className="h-8 shrink-0" value={op} onChange={(e) => setOp(e.target.value as TextOperator)}>
            {TEXT_OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </NativeSelect>
          <Input aria-label={t('Text')} autoFocus value={text} onChange={(e) => setText(e.target.value)} className="h-8 min-w-0 text-sm" />
        </div>
      )}
      {kind !== 'text' && kind !== 'set' && (
        <div className="flex items-end gap-2">
          {rangeInput(min, setMin, t('From'), `${id}-min`)}
          {rangeInput(max, setMax, t('To'), `${id}-max`)}
          {units && (
            <NativeSelect aria-label={t('Unit')} className="h-8 shrink-0" value={unit} onChange={(e) => setUnit(Number(e.target.value))}>
              {units.map(u => <option key={u.factor} value={u.factor}>{u.label}</option>)}
            </NativeSelect>
          )}
          {kind === 'percent' && <span className="pb-1.5 text-sm text-muted-foreground">%</span>}
        </div>
      )}
      {kind === 'set' && (
        <div className="grid gap-2">
          {options.length > 8 && <Input type="search" aria-label={t('Search values')} placeholder={t('Search values')} value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-sm" />}
          {options.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('Nothing to choose from')}</p>
          ) : (
            <ul className="-mx-1 max-h-56 overflow-y-auto">
              {shownOptions.map(option => {
                const optionId = `${id}-${option.value}`
                const on = chosen.includes(option.value)
                return (
                  <li key={option.value}>
                    <label htmlFor={optionId} className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1 text-sm hover:bg-accent">
                      <Checkbox id={optionId} checked={on} onCheckedChange={() => setChosen(current => (on ? current.filter(v => v !== option.value) : [...current, option.value]))} />
                      <span className="min-w-0 flex-1 truncate">{valueLabel(option.value)}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{option.count}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => onApply(null)}>{t('Clear')}</Button>
        <Button type="submit" size="sm">{t('Apply')}</Button>
      </div>
    </form>
  )
}

// The funnel in a column title. Faint until the title is hovered, and marked while a filter is set.
export function ColumnFilterButton({ target, filter, onChange }: { target: FilterTarget; filter?: ColumnFilter; onChange: (filter: ColumnFilter | null) => void }) {
  const [open, setOpen] = useState(false)
  const active = isActive(filter)
  const label = active ? describeFilter(target, filter, target.valueLabel ?? defaultValueLabel) : t('Filter {label}', { label: target.label })
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-sm outline-hidden hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring',
            active ? 'text-primary' : 'opacity-0 group-hover/th:opacity-100 [@media(hover:none)]:opacity-50',
            open && 'opacity-100',
          )}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Filter className={cn('size-3.5', active && 'fill-current')} />
        </button>
      </PopoverTrigger>
      <PopoverContent onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}>
        {open && <ColumnFilterEditor target={target} filter={filter} onApply={(next) => { onChange(next); setOpen(false) }} />}
      </PopoverContent>
    </Popover>
  )
}

function FilterChip({ target, filter, onChange }: { target: FilterTarget; filter: ColumnFilter; onChange: (filter: ColumnFilter | null) => void }) {
  const [open, setOpen] = useState(false)
  const text = describeFilter(target, filter, target.valueLabel ?? defaultValueLabel)
  return (
    <span className="flex max-w-full items-center rounded-full border bg-card text-sm">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="flex min-w-0 items-center gap-1.5 rounded-s-full py-1 ps-3 pe-1 hover:text-foreground" title={t('Change this filter')}>
            <ListFilter className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate" dir="auto">{text}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent>
          {open && <ColumnFilterEditor target={target} filter={filter} onApply={(next) => { onChange(next); setOpen(false) }} />}
        </PopoverContent>
      </Popover>
      <button type="button" className="me-1 flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={t('Remove filter: {filter}', { filter: text })} title={t('Remove filter')} onClick={() => onChange(null)}>
        <X className="size-3.5" />
      </button>
    </span>
  )
}

// A filter set elsewhere, such as the status, shown as a chip that only removes it.
export function RemovableChip({ text, onRemove }: { text: string; onRemove: () => void }) {
  return (
    <span className="flex max-w-full items-center rounded-full border bg-card text-sm">
      <span className="flex min-w-0 items-center gap-1.5 py-1 ps-3 pe-1">
        <ListFilter className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate" dir="auto">{text}</span>
      </span>
      <button type="button" className="me-1 flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={t('Remove filter: {filter}', { filter: text })} title={t('Remove filter')} onClick={onRemove}>
        <X className="size-3.5" />
      </button>
    </span>
  )
}

// A button that adds a column filter without the table: pick a column, then set it.
function AddFilterButton({ targets, onChange }: { targets: FilterTarget[]; onChange: (id: string, filter: ColumnFilter | null) => void }) {
  const [open, setOpen] = useState(false)
  const [targetId, setTargetId] = useState(targets[0]?.id ?? '')
  const target = targets.find(c => c.id === targetId) ?? targets[0]
  if (!target) return null
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 rounded-full">
          <Plus className="size-4" />
          {t('Column filter')}
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="grid gap-3">
          <NativeSelect aria-label={t('Column')} className="h-8" value={target.id} onChange={(e) => setTargetId(e.target.value)}>
            {targets.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </NativeSelect>
          {open && <ColumnFilterEditor key={target.id} target={target} onApply={(next) => { onChange(target.id, next); setOpen(false) }} />}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// The column filters in force, as chips that open their editor or remove them, plus a way to add
// one, which is the only way on phones and in the card view, where no titles show.
export function ColumnFilterChips({ targets, filters, onChange, showAdd, start, end, className }: {
  targets: FilterTarget[]
  filters: ColumnFilters
  onChange: (id: string, filter: ColumnFilter | null) => void
  // Whether the add button shows; a string of classes shows it only where they say, such as 'md:hidden'.
  showAdd: boolean | string
  // Other chips before these, and more buttons after the add button.
  start?: ReactNode
  end?: ReactNode
  className?: string
}) {
  const chips = targets.filter(c => isActive(filters[c.id]))
  if (!chips.length && !showAdd && !start && !end) return null
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} aria-label={t('Column filters')} role="group">
      {start}
      {chips.map(c => <FilterChip key={c.id} target={c} filter={filters[c.id]} onChange={(next) => onChange(c.id, next)} />)}
      {showAdd && <span className={typeof showAdd === 'string' ? showAdd : undefined}><AddFilterButton targets={targets} onChange={onChange} /></span>}
      {end}
    </div>
  )
}
