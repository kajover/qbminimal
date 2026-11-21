import { useLayoutEffect, useState, type ReactNode } from 'react'
import { useTheme, type Theme } from '@/lib/theme'
import { ALargeSmall, Captions, Check, Contrast, ExternalLink, Gauge, Info, Languages, Monitor, Moon, Paintbrush, Palette, PanelLeft, Rainbow, Sun, Undo2, VenetianMask, type LucideIcon } from 'lucide-react'
import { Tooltip } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { setIncognito, useIncognito } from '@/lib/incognito'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useQuery } from '@tanstack/react-query'
import { UpdateCheck } from './UpdateCheck'
import { useAppVersion, usePreferences, useSavePreferences, useWebApiVersion } from '@/hooks/useApi'
import { formatDuration } from '@/lib/format'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import { PREFERENCE_SECTIONS, getChangedPreferences, getSupportedPrefs, toFormValue, type PrefDef } from '@/lib/preferences'
import { PreferenceField } from './PreferenceField'
import { PageHeader } from '@/components/PageHeader'
import { NativeSelect } from '@/components/NativeSelect'
import { BrowserSettings } from './BrowserSettings'
import { ShortcutsList } from '@/components/torrents/ShortcutsDialog'
import { Switch } from '@/components/ui/switch'
import { setDisplayOption, useDisplayOption, type DisplayOption } from '@/lib/displayOptions'
import { chosenTextSize, setTextSize, TEXT_SIZES, type TextSize } from '@/lib/textSize'
import { changedLanguage, chosenLanguage, LANGUAGES, setLanguage, t, type LanguageChoice } from '@/i18n'

// System is the default, so it comes first.
const themeOptions: { value: Theme; label: string; icon: typeof Monitor }[] = [
  { value: 'system', get label() { return t('System') }, icon: Monitor },
  { value: 'light', get label() { return t('Light') }, icon: Sun },
  { value: 'dark', get label() { return t('Dark') }, icon: Moon },
]

// Each row under Appearance is as tall as its tallest, a drop-down, so the rows are evenly spaced
// whether they hold buttons, a drop-down or a switch. A control that wraps below its label stays
// at the row's end, like the theme's buttons: the right, or the left in a right-to-left language.
// The second child is the control; a switch reads it from --switch-start (see index.css).
const ROW = 'flex min-h-9 flex-wrap items-center justify-between gap-2 [&>:nth-child(2)]:ms-auto [&>:nth-child(2)]:[--switch-start:auto]'

// A row of choices, such as the theme: at the end of its row, and compact enough to stay beside
// its label on a phone.
const CHOICES = 'ms-auto flex flex-wrap justify-end gap-1'
// The chosen one keeps an invisible border as wide as the others' outline, so nothing moves on a click.
const choice = (chosen: boolean) => cn('gap-1 has-[>svg]:px-2', chosen && 'border border-transparent')

// Torrents' statuses and speeds in color, or plain.
const colorOptions: { value: boolean; label: string; icon: typeof Monitor }[] = [
  { value: true, get label() { return t('Colored') }, icon: Rainbow },
  { value: false, get label() { return t('Monochrome') }, icon: Contrast },
]

const textSizeLabels: Record<TextSize, string> = {
  get small() { return t('Small') },
  get default() { return t('Default') },
  get large() { return t('Large') },
  get larger() { return t('Larger') },
}

const SECTIONS = [{ id: 'app', get title() { return t('App') } }, ...PREFERENCE_SECTIONS.map(section => ({ id: section.id, get title() { return section.title } }))]

// An on/off choice from lib/displayOptions, which applies it to the page at once.
// An option's name with its icon in front, as each of the App options shows it.
function IconLabel({ htmlFor, icon: Icon, children }: { htmlFor?: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <Label htmlFor={htmlFor} className="flex items-center gap-2">
      <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      {children}
    </Label>
  )
}

function OptionSwitch({ option, label, icon, className }: { option: DisplayOption; label: string; icon: LucideIcon; className?: string }) {
  const on = useDisplayOption(option)
  const id = `option-${option}`
  return (
    <div className={cn('mt-3', ROW, className)}>
      <IconLabel htmlFor={id} icon={icon}>{label}</IconLabel>
      <Switch
        id={id}
        checked={on}
        onCheckedChange={(checked) => setDisplayOption(option, checked)}
      />
    </div>
  )
}

// Incognito mode: made-up Linux names in place of the torrents' and their files', in this browser
// only, for screenshots or a screen others can see.
function IncognitoSwitch() {
  const on = useIncognito()
  return (
    <div className={cn('mt-3', ROW)}>
      <span className="flex items-center gap-1">
        <IconLabel htmlFor="option-incognito" icon={VenetianMask}>{t('Incognito mode')}</IconLabel>
        {/* What it does: under the pointer, and on a click or tap, since phones have no pointer to rest. */}
        <Popover>
          <Tooltip label={t('Hides the real torrent and file names')}>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="size-6 text-muted-foreground" aria-label={t('What incognito mode does')}>
                <Info className="size-3.5" />
              </Button>
            </PopoverTrigger>
          </Tooltip>
          <PopoverContent className="w-auto px-2.5 py-2 text-xs whitespace-nowrap">{t('Hides the real torrent and file names')}</PopoverContent>
        </Popover>
      </span>
      <Switch id="option-incognito" checked={on} onCheckedChange={setIncognito} />
    </div>
  )
}

// Whether either row of choice buttons (theme, colors) is too narrow for its label and buttons side
// by side. Then both rows put their buttons below the label, so the two always look alike.
function useStackedChoices() {
  // Set once the rows are on the page, which starts the measuring.
  const [themeRow, setThemeRow] = useState<HTMLDivElement | null>(null)
  const [colorsRow, setColorsRow] = useState<HTMLDivElement | null>(null)
  const [stacked, setStacked] = useState(false)
  useLayoutEffect(() => {
    const rows = [themeRow, colorsRow].filter((row): row is HTMLDivElement => !!row)
    if (!rows.length || typeof ResizeObserver === 'undefined') return
    const tooNarrow = (row: HTMLDivElement) => {
      const [label, group] = [row.firstElementChild as HTMLElement, row.lastElementChild as HTMLElement]
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0
      const buttons = [...group.children] as HTMLElement[]
      const buttonGap = parseFloat(getComputedStyle(group).columnGap) || 0
      const needed = label.offsetWidth + gap + buttons.reduce((sum, button) => sum + button.offsetWidth, 0) + buttonGap * (buttons.length - 1)
      return needed > row.clientWidth
    }
    const measure = () => setStacked(rows.some(tooNarrow))
    const observer = new ResizeObserver(measure)
    rows.forEach(row => observer.observe(row))
    measure()
    return () => observer.disconnect()
  }, [themeRow, colorsRow])
  return { themeRow: setThemeRow, colorsRow: setColorsRow, stacked }
}

function AppSection() {
  // Drawn again for a new language: the field in view and focused, as it was left.
  useLayoutEffect(() => {
    if (!changedLanguage()) return
    const field = document.getElementById('language')
    field?.scrollIntoView({ block: 'center' })
    field?.focus({ preventScroll: true })
  }, [])
  const { theme, setTheme } = useTheme()
  const { themeRow, colorsRow, stacked } = useStackedChoices()
  const menuBar = useDisplayOption('menuBar')
  const colors = useDisplayOption('colors')
  const [textSize, setTextSizeState] = useState(chosenTextSize)
  const { data: qbittorrentVersion } = useAppVersion()
  const { data: webApiVersion } = useWebApiVersion()
  const { data: build } = useQuery({ queryKey: ['app', 'buildInfo'], queryFn: () => qbitClient.getBuildInfo() })
  const { data: process } = useQuery({ queryKey: ['app', 'processInfo'], queryFn: () => qbitClient.getProcessInfo() })
  // Read once when the page opens, which is precise enough for an uptime.
  const [now] = useState(() => Math.floor(Date.now() / 1000))

  const about: [string, string | undefined][] = [
    // Plain numbers, like the other versions here.
    ['qbminimal', __APP_VERSION__],
    ['qBittorrent', qbittorrentVersion?.replace(/^v/, '')],
    ['Web API', webApiVersion],
    [t('Running for'), process?.launch_time ? formatDuration(now - process.launch_time) : undefined],
    [t('Platform'), build ? t('{platform}, {bitness}-bit', { platform: build.platform, bitness: build.bitness }) : undefined],
    ['libtorrent', build?.libtorrent as string | undefined],
    ['Qt', build?.qt as string | undefined],
    ['Boost', build?.boost as string | undefined],
    ['OpenSSL', build?.openssl as string | undefined],
    ['zlib', build?.zlib as string | undefined],
  ]

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle>{t('Appearance')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div ref={themeRow} className={ROW}>
            <IconLabel icon={Palette}>{t('Theme')}</IconLabel>
            <div className={cn(CHOICES, stacked && 'basis-full')} role="group" aria-label={t('Theme')}>
              {themeOptions.map(({ value, label, icon: Icon }) => (
                <Button key={value} variant={theme === value ? 'secondary' : 'outline'} size="sm" aria-pressed={theme === value} onClick={() => setTheme(value)} className={choice(theme === value)}>
                  <Icon className="size-3.5" />
                  <span>{label}</span>
                </Button>
              ))}
            </div>
          </div>
          <div ref={colorsRow} className={cn('mt-3', ROW)}>
            <IconLabel icon={Paintbrush}>{t('Colors')}</IconLabel>
            <div className={cn(CHOICES, stacked && 'basis-full')} role="group" aria-label={t('Colors')}>
              {colorOptions.map(({ value, label, icon: Icon }) => (
                <Button key={label} variant={colors === value ? 'secondary' : 'outline'} size="sm" aria-pressed={colors === value} onClick={() => setDisplayOption('colors', value)} className={choice(colors === value)}>
                  <Icon className="size-3.5" />
                  <span>{label}</span>
                </Button>
              ))}
            </div>
          </div>
          <div className={cn('mt-3', ROW)}>
            <IconLabel htmlFor="language" icon={Languages}>{t('Language')}</IconLabel>
            {/* Applies at once: the pages are drawn again in the new language, still on Settings. */}
            <NativeSelect id="language" value={chosenLanguage()} onChange={(e) => void setLanguage(e.target.value as LanguageChoice)}>
              <option value="auto">{t('Same as the browser')}</option>
              {LANGUAGES.map(language => <option key={language.code} value={language.code}>{language.name}</option>)}
            </NativeSelect>
          </div>
          <div className={cn('mt-3', ROW)}>
            <IconLabel htmlFor="text-size" icon={ALargeSmall}>{t('Text size')}</IconLabel>
            <NativeSelect
              id="text-size"
              value={textSize}
              onChange={(e) => {
                const size = e.target.value as TextSize
                setTextSize(size)
                setTextSizeState(size)
              }}
            >
              {TEXT_SIZES.map(({ value }) => <option key={value} value={value}>{textSizeLabels[value]}</option>)}
            </NativeSelect>
          </div>
          <IncognitoSwitch />
          <OptionSwitch option="headerSpeeds" icon={Gauge} label={t('Speeds in the header')} />
          <OptionSwitch option="menuBar" icon={PanelLeft} label={t('Menu bar')} />
          {/* The tab bar is only on phones, and only with the menu bar, so the choice is too. */}
          <OptionSwitch option="tabLabels" icon={Captions} label={t('Tab bar labels')} className={cn('wide:hidden', !menuBar && 'hidden')} />
        </CardContent>
      </Card>

      <BrowserSettings />

      {/* The keys and clicks of the torrent list, also shown there with ?. */}
      <Card>
        <CardHeader>
          <CardTitle>{t('Keyboard and mouse')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ShortcutsList />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('About')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-1 text-sm">
            {about.filter((row): row is [string, string] => !!row[1]).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-end">{value}</dd>
              </div>
            ))}
          </dl>
          <UpdateCheck />
          <div className="mt-4 space-y-1 border-t pt-4">
            <p className="text-xs text-muted-foreground">{t('qbminimal is open source. Code, pull requests, ideas, discussions, translations and bug reports are all welcome on GitHub.')}</p>
            <a href="https://github.com/kajover/qbminimal/blob/main/CONTRIBUTING.md" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary underline underline-offset-2">
              {t('Contribute on GitHub')}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}

// Edits live in SettingsView, so they survive switching sections and are all saved together.
function PreferencesSection({ sectionId, edits, setEdits }: { sectionId: string; edits: Record<string, unknown>; setEdits: (update: (prev: Record<string, unknown>) => Record<string, unknown>) => void }) {
  const { data: original, isLoading, isError } = usePreferences()
  const save = useSavePreferences()
  const section = PREFERENCE_SECTIONS.find(s => s.id === sectionId)

  if (isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">{t('Loading settings...')}</p>
  if (isError || !original || !section) return <p className="py-8 text-center text-sm text-muted-foreground">{t('Couldn\'t load qBittorrent\'s settings')}</p>

  const valueFor = (def: PrefDef) => (def.key in edits ? edits[def.key] : toFormValue(def, original[def.key]))
  const getValue = (key: string) => (key in edits ? edits[key] : original[key])
  const { changes: allChanges, invalid } = getChangedPreferences(original, edits)
  // A cleared password box means "keep the current password".
  const changes = Object.fromEntries(Object.entries(allChanges).filter(([key, value]) => !(key === 'web_ui_password' && value === '')))
  const changeCount = Object.keys(changes).length

  const submit = () => {
    if (invalid.length) {
      toast.error(t('Check these settings'), { description: invalid.join(', ') })
      return
    }
    const password = changes.web_ui_password
    if (password !== undefined && (typeof password !== 'string' || password.length < 6)) {
      toast.error(t('The new password needs at least 6 characters'))
      return
    }
    if (!Object.keys(changes).length) return
    save.mutate(changes, {
      onSuccess: () => {
        setEdits(() => ({}))
        toast.success(t('Settings saved'))
        // qBittorrent now serves a different Web UI, which only a reload shows.
        if ('alternative_webui_enabled' in changes || 'alternative_webui_path' in changes) setTimeout(() => window.location.reload(), 1000)
      },
    })
  }

  return (
    <div className="space-y-3 pb-16">
      {section.groups.map(group => ({ ...group, prefs: getSupportedPrefs(group.prefs, original) })).filter(group => group.prefs.length > 0).map(group => (
        <Card key={group.title}>
          <CardHeader>
            <CardTitle className="text-base">{group.title}</CardTitle>
            {group.warning && <CardDescription className="text-amber-600 dark:text-amber-400">{group.warning}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-4">
            {group.prefs.map(def => {
              const disabled = !!def.dependsOn && !getValue(def.dependsOn)
              return (
                <PreferenceField
                  key={def.key}
                  def={def}
                  value={valueFor(def)}
                  getValue={getValue}
                  onChange={(value) => setEdits(prev => ({ ...prev, [def.key]: value }))}
                  disabled={disabled}
                  hasUnsavedChanges={changeCount > 0}
                />
              )
            })}
          </CardContent>
        </Card>
      ))}

      {(changeCount > 0 || invalid.length > 0) && (
        // Kept in view above the tab bar while the page scrolls.
        <div className="glass sticky bottom-[calc(var(--bottom-nav-height,0px)+0.25rem)] z-10 flex items-center justify-between gap-2 rounded-2xl p-3">
          <span className="text-sm">{changeCount === 1 ? t('1 unsaved change') : t('{changeCount} unsaved changes', { changeCount })}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEdits(() => ({}))}><Undo2 />{t('Discard')}</Button>
            <Button size="sm" disabled={save.isPending} onClick={submit}><Check />{save.isPending ? t('Saving...') : t('Save')}</Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function SettingsView() {
  const [sectionId, setSectionId] = useState('app')
  const [edits, setEdits] = useState<Record<string, unknown>>({})

  return (
    // The whole page scrolls, like the torrent cards, rather than a box that stops at the screen's bottom.
    <div className="flex flex-col gap-4">
      <PageHeader title={t('Settings')} />
      {/* Narrow enough that all nine fit in two rows on a phone. */}
      <nav aria-label={t('Settings sections')} className="flex flex-wrap gap-0.5">
        {SECTIONS.map(section => (
          <Button key={section.id} size="sm" variant={sectionId === section.id ? 'secondary' : 'ghost'} className="px-2" aria-current={sectionId === section.id ? 'page' : undefined} onClick={() => setSectionId(section.id)}>
            {section.title}
          </Button>
        ))}
      </nav>
      <div>
        {sectionId === 'app' ? <AppSection /> : <PreferencesSection sectionId={sectionId} edits={edits} setEdits={setEdits} />}
      </div>
    </div>
  )
}
