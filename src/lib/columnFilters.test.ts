import { describe, expect, it } from 'vitest'
import { applyColumnFilters, choiceOptions, describeFilter, fromDateInput, matchesFilter, parseColumnFilters, withFilter, type FilterColumn } from './columnFilters'

interface Row { name: string; size: number; tags: string[] }
const rows: Row[] = [
  { name: 'Ubuntu 26.04', size: 6 * 1024 ** 3, tags: ['linux'] },
  { name: 'Debian 14', size: 700 * 1024 ** 2, tags: [] },
  { name: 'Fedora 45', size: 2 * 1024 ** 3, tags: ['linux', 'new'] },
]
const columns: FilterColumn<Row>[] = [
  { id: 'name', label: 'Name', kind: 'text', value: r => r.name },
  { id: 'size', label: 'Size', kind: 'size', value: r => r.size },
  { id: 'tags', label: 'Tags', kind: 'set', value: r => r.tags },
]
const names = (list: Row[]) => list.map(r => r.name)

describe('column filters', () => {
  it('matches text ignoring case', () => {
    expect(matchesFilter('Ubuntu', { type: 'text', op: 'contains', value: 'BUN' })).toBe(true)
    expect(matchesFilter('Ubuntu', { type: 'text', op: 'excludes', value: 'bun' })).toBe(false)
    expect(matchesFilter('Ubuntu', { type: 'text', op: 'is', value: 'ubuntu' })).toBe(true)
    expect(matchesFilter('Ubuntu', { type: 'text', op: 'isNot', value: 'ubuntu' })).toBe(false)
  })

  it('keeps rows inside a range, with open ends, and never unknown values', () => {
    expect(names(applyColumnFilters(rows, columns, { size: { type: 'range', min: 1024 ** 3, max: 4 * 1024 ** 3 } }))).toEqual(['Fedora 45'])
    expect(names(applyColumnFilters(rows, columns, { size: { type: 'range', min: 1024 ** 3 } }))).toEqual(['Ubuntu 26.04', 'Fedora 45'])
    expect(matchesFilter(NaN, { type: 'range', max: 10 })).toBe(false)
    expect(matchesFilter(Infinity, { type: 'range', min: 10 })).toBe(true)
  })

  it('chooses from values, counting an empty list as none', () => {
    expect(names(applyColumnFilters(rows, columns, { tags: { type: 'set', values: ['new'] } }))).toEqual(['Fedora 45'])
    expect(names(applyColumnFilters(rows, columns, { tags: { type: 'set', values: [''] } }))).toEqual(['Debian 14'])
    expect(choiceOptions(rows, columns[2])).toEqual([{ value: 'linux', count: 2 }, { value: '', count: 1 }, { value: 'new', count: 1 }])
  })

  it('needs every filter to pass', () => {
    const filters = { name: { type: 'text' as const, op: 'contains' as const, value: 'u' }, size: { type: 'range' as const, max: 3 * 1024 ** 3 } }
    expect(names(applyColumnFilters(rows, columns, filters))).toEqual([])
  })

  it('drops empty filters and unreadable saved ones', () => {
    expect(withFilter({}, 'name', { type: 'text', op: 'contains', value: '  ' })).toEqual({})
    expect(withFilter({ size: { type: 'range', min: 1 } }, 'size', null)).toEqual({})
    expect(parseColumnFilters({ a: { type: 'range', min: 'x', max: 5 }, b: { type: 'text', op: 'nope', value: 'x' }, c: 'junk' })).toEqual({ a: { type: 'range', max: 5 } })
  })

  it('describes filters in the column units', () => {
    expect(describeFilter({ label: 'Size', kind: 'size' }, { type: 'range', min: 1024 ** 3, max: 4 * 1024 ** 3 })).toBe('Size: 1 GB – 4 GB')
    expect(describeFilter({ label: 'ETA', kind: 'duration' }, { type: 'range', max: 7200 })).toBe('ETA ≤ 2 hours')
    expect(describeFilter({ label: 'Tags', kind: 'set' }, { type: 'set', values: ['a', 'b', 'c'] })).toBe('Tags: a, b +1')
  })

  it('reads a date as a whole local day', () => {
    const start = fromDateInput('2026-11-13')!
    expect(fromDateInput('2026-11-13', true)! - start).toBe(86399)
    expect(new Date(start * 1000).getHours()).toBe(0)
    expect(fromDateInput('13.11.2026')).toBeUndefined()
  })
})
