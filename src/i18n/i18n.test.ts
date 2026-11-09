import { afterEach, describe, expect, it } from 'vitest'
import de from './locales/de.json'
import { detectLanguage, LANGUAGES, t, setCatalogForTests, type Catalog } from './index'

const catalogs = import.meta.glob<Catalog>('./locales/*.json', { eager: true, import: 'default' })

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()

describe('translations', () => {
  afterEach(() => setCatalogForTests({}, 'en'))

  it('falls back to the English text and fills in values', () => {
    expect(t('{count} selected', { count: 3 })).toBe('3 selected')
    setCatalogForTests({ '{count} selected': '{count} ausgewählt' })
    expect(t('{count} selected', { count: 3 })).toBe('3 ausgewählt')
    expect(t('Not translated')).toBe('Not translated')
  })

  it('picks the first browser language it has, or English', () => {
    expect(detectLanguage(['de-AT', 'en-US'])).toBe('de')
    expect(detectLanguage(['fi-FI', 'en-GB'])).toBe('en')
    expect(detectLanguage(['fr-FR', 'en-GB'])).toBe('fr')
    expect(detectLanguage(['pt-PT'])).toBe('pt')
    expect(detectLanguage(['pt'])).toBe('pt')
    expect(detectLanguage(['pt-BR'])).toBe('pt-BR')
    expect(detectLanguage(['sv-SE'])).toBe('sv')
    expect(detectLanguage(['fa-IR'])).toBe('fa')
    expect(detectLanguage(['he-IL'])).toBe('he')
    expect(detectLanguage(['iw'])).toBe('he')
    expect(detectLanguage([])).toBe('en')
  })

  it('tells Simplified from Traditional Chinese', () => {
    expect(detectLanguage(['zh-CN'])).toBe('zh-Hans')
    expect(detectLanguage(['zh'])).toBe('zh-Hans')
    expect(detectLanguage(['zh-SG'])).toBe('zh-Hans')
    expect(detectLanguage(['zh-TW'])).toBe('zh-Hant')
    expect(detectLanguage(['zh-HK'])).toBe('zh-Hant')
    expect(detectLanguage(['zh-Hant-US'])).toBe('zh-Hant')
  })

  it('keeps every placeholder in every translation', () => {
    for (const [file, catalog] of Object.entries(catalogs)) {
      const broken = Object.entries(catalog).filter(([english, translated]) => placeholders(english).join() !== placeholders(translated).join())
      expect(broken, file).toEqual([])
    }
  })

  it('has a catalog for every language, each covering the German one', () => {
    for (const { code } of LANGUAGES.filter(language => language.code !== 'en')) {
      const catalog = catalogs[`./locales/${code}.json`]
      expect(catalog, code).toBeDefined()
      expect(Object.keys(de).filter(key => !catalog[key]), code).toEqual([])
    }
  })
})
