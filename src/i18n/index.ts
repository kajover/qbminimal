import { readStored, writeStored } from '@/lib/storage'

// Translations. The English text is the key, so anything not translated yet shows in English.
// The language is loaded once, before the app's modules, so text built when a module loads is
// translated too. Changing it reloads the page.
export type Catalog = Record<string, string>

// Each language by its own name, in the order the Settings list shows them.
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'cs', name: 'Čeština' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'it', name: 'Italiano' },
  { code: 'hu', name: 'Magyar' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'pl', name: 'Polski' },
  { code: 'pt', name: 'Português (Portugal)' },
  { code: 'pt-BR', name: 'Português (Brasil)' },
  { code: 'ro', name: 'Română' },
  { code: 'sv', name: 'Svenska' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'el', name: 'Ελληνικά' },
  { code: 'bg', name: 'Български' },
  { code: 'ru', name: 'Русский' },
  { code: 'uk', name: 'Українська' },
  { code: 'ar', name: 'العربية' },
  { code: 'fa', name: 'فارسی' },
  { code: 'he', name: 'עברית' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'bn', name: 'বাংলা' },
  { code: 'th', name: 'ไทย' },
  { code: 'zh-Hans', name: '中文（简体）' },
  { code: 'zh-Hant', name: '中文（繁體）' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
] as const
export type LanguageCode = (typeof LANGUAGES)[number]['code']
export type LanguageChoice = LanguageCode | 'auto'

// Each language is a JSON file in ./locales, named by its code, loaded only when it's used.
const FILES = import.meta.glob<Catalog>('./locales/*.json', { import: 'default' })
const loadCatalog = (code: Exclude<LanguageCode, 'en'>) => FILES[`./locales/${code}.json`]()

// Languages written right to left. The page is mirrored for them.
const RIGHT_TO_LEFT: ReadonlySet<LanguageCode> = new Set(['ar', 'fa', 'he'])

const STORAGE_KEY = 'qbminimal.language'
let catalog: Catalog = {}
let current: LanguageCode = 'en'

const isLanguage = (code: string | null): code is LanguageCode => LANGUAGES.some(language => language.code === code)

export function chosenLanguage(): LanguageChoice {
  const stored = readStored(STORAGE_KEY)
  return isLanguage(stored) ? stored : 'auto'
}

// Chinese comes in two scripts: Traditional for Taiwan, Hong Kong and Macau, or when asked
// for by name, and Simplified everywhere else.
function chineseScript(tag: string): LanguageCode {
  return /-(hant|tw|hk|mo)\b/.test(tag) ? 'zh-Hant' : 'zh-Hans'
}

// The first of the browser's languages that has a translation, or English.
export function detectLanguage(preferred: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]): LanguageCode {
  for (const tag of preferred) {
    const lower = tag.toLowerCase()
    // Some older browsers still name Hebrew by its former code, iw.
    const code = lower.split('-')[0].replace(/^iw$/, 'he')
    if (code === 'zh') return chineseScript(lower)
    // Brazil has its own Portuguese; everywhere else gets Portugal's.
    if (code === 'pt') return lower === 'pt-br' ? 'pt-BR' : 'pt'
    if (isLanguage(code)) return code
  }
  return 'en'
}

export async function loadLanguage() {
  const choice = chosenLanguage()
  const code = choice === 'auto' ? detectLanguage() : choice
  try {
    catalog = code === 'en' ? {} : await loadCatalog(code)
    current = code
  } catch {
    // The translation couldn't load, so the app shows in English.
    catalog = {}
    current = 'en'
  }
  document.documentElement.lang = current
  document.documentElement.dir = RIGHT_TO_LEFT.has(current) ? 'rtl' : 'ltr'
}

export function setLanguage(choice: LanguageChoice) {
  writeStored(STORAGE_KEY, choice === 'auto' ? null : choice)
  window.location.reload()
}

// Text in the current language. {name} in it is replaced with vars.name.
export function t(text: string, vars?: Record<string, string | number | null | undefined>): string {
  const template = catalog[text] || text
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name] ?? '') : match))
}

// For tests: use a catalog directly.
export function setCatalogForTests(next: Catalog, code: LanguageCode = 'de') {
  catalog = next
  current = code
}
