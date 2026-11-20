import { afterEach, describe, expect, it } from 'vitest'
import { perLanguage, setCatalogForTests, t } from '@/i18n'
import { getColumn, TORRENT_FILTER_COLUMNS } from '@/lib/torrentColumns'
import { PREFERENCE_SECTIONS } from '@/lib/preferences'
import { MAIN_PAGES } from '@/components/navigation'

describe('a change of language without reloading', () => {
  afterEach(() => setCatalogForTests({}, 'en'))

  it('reaches text built when its module loaded', () => {
    setCatalogForTests({ Size: 'Größe', Behavior: 'Verhalten', Torrents: 'Torrents (de)', 'Log performance warnings': 'Leistungswarnungen' })
    expect(getColumn('size').label).toBe('Größe')
    expect(TORRENT_FILTER_COLUMNS.find(column => column.id === 'size')?.label).toBe('Größe')
    expect(PREFERENCE_SECTIONS[0].title).toBe('Verhalten')
    expect(PREFERENCE_SECTIONS[0].groups[0].prefs[1].label).toBe('Leistungswarnungen')
    expect(MAIN_PAGES[0].label).toBe('Torrents (de)')
    setCatalogForTests({}, 'en')
    expect(getColumn('size').label).toBe('Size')
  })

  it('builds a list again for each language, and only then', () => {
    let builds = 0
    const list = perLanguage(() => { builds++; return [t('Size')] })
    setCatalogForTests({ Size: 'Taille' }, 'fr')
    expect(list()).toEqual(['Taille'])
    expect(list()).toBe(list())
    setCatalogForTests({ Size: 'Größe' })
    expect(list()).toEqual(['Größe'])
    expect(builds).toBe(2)
  })
})
