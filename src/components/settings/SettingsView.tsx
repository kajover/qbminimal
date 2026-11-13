import { useState } from 'react'
import { useTheme, type Theme } from '@/lib/theme'
import { Check, ExternalLink, Monitor, Moon, Sun, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
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
import { Switch } from '@/components/ui/switch'
import { setDisplayOption, useDisplayOption, type DisplayOption } from '@/lib/displayOptions'
import { chosenTextSize, setTextSize, TEXT_SIZES, type TextSize } from '@/lib/textSize'
import { chosenLanguage, LANGUAGES, setLanguage, t, type LanguageChoice } from '@/i18n'

// System is the default, so it comes first.
const themeOptions: { value: Theme; label: string; icon: typeof Monitor }[] = [
  { value: 'system', label: t('System'), icon: Monitor },
  { value: 'light', label: t('Light'), icon: Sun },
  { value: 'dark', label: t('Dark'), icon: Moon },
]

const textSizeLabels: Record<TextSize, string> = {
  small: t('Small'),
  default: t('Default'),
  large: t('Large'),
  larger: t('Larger'),
}

const SECTIONS = [{ id: 'app', title: t('App') }, ...PREFERENCE_SECTIONS.map(({ id, title }) => ({ id, title }))]

// An on/off choice from lib/displayOptions, which applies it to the page at once.
function OptionSwitch({ option, label, className }: { option: DisplayOption; label: string; className?: string }) {
  const on = useDisplayOption(option)
  const id = `option-${option}`
  return (
    <div className={cn('mt-3 flex items-center justify-between gap-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Switch
        id={id}
        checked={on}
        onCheckedChange={(checked) => setDisplayOption(option, checked)}
      />
    </div>
  )
}

function AppSection() {
  const { theme, setTheme } = useTheme()
  const menuBar = useDisplayOption('menuBar')
  const [textSize, setTextSizeState] = useState(chosenTextSize)
  const { data: qbittorrentVersion } = useAppVersion()
  const { data: webApiVersion } = useWebApiVersion()
  const { data: build } = useQuery({ queryKey: ['app', 'buildInfo'], queryFn: () => qbitClient.getBuildInfo() })
  const { data: process } = useQuery({ queryKey: ['app', 'processInfo'], queryFn: () => qbitClient.getProcessInfo() })
  // Read once when the page opens, which is precise enough for an uptime.
  const [now] = useState(() => Math.floor(Date.now() / 1000))

  const about: [string, string | undefined][] = [
    ['qbminimal', `v${__APP_VERSION__}`],
    ['qBittorrent', qbittorrentVersion],
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>{t('Theme')}</Label>
            <div className="flex flex-wrap gap-1" role="group" aria-label={t('Theme')}>
              {themeOptions.map(({ value, label, icon: Icon }) => (
                <Button key={value} variant={theme === value ? 'secondary' : 'outline'} size="sm" aria-pressed={theme === value} onClick={() => setTheme(value)} className="gap-2">
                  <Icon className="size-4" />
                  <span>{label}</span>
                </Button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="language">{t('Language')}</Label>
            {/* Changing it reloads the page, so every text is redrawn in the new language. */}
            <NativeSelect id="language" value={chosenLanguage()} onChange={(e) => setLanguage(e.target.value as LanguageChoice)}>
              <option value="auto">{t('Same as the browser')}</option>
              {LANGUAGES.map(language => <option key={language.code} value={language.code}>{language.name}</option>)}
            </NativeSelect>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="text-size">{t('Text size')}</Label>
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
          <OptionSwitch option="headerSpeeds" label={t('Speeds in the header')} />
          <OptionSwitch option="menuBar" label={t('Menu bar')} />
          {/* The tab bar is only on phones, and only with the menu bar, so the choice is too. */}
          <OptionSwitch option="tabLabels" label={t('Tab bar labels')} className={cn('md:hidden', !menuBar && 'hidden')} />
        </CardContent>
      </Card>

      <BrowserSettings />

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
        <div className="glass sticky bottom-2 z-10 flex items-center justify-between gap-2 rounded-2xl p-3 max-md:bottom-[calc(var(--bottom-nav-height,5rem)+0.5rem)]">
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
    <div className="space-y-4">
      <PageHeader title={t('Settings')} />
      <nav aria-label={t('Settings sections')} className="flex flex-wrap gap-1">
        {SECTIONS.map(section => (
          <Button key={section.id} size="sm" variant={sectionId === section.id ? 'secondary' : 'ghost'} aria-current={sectionId === section.id ? 'page' : undefined} onClick={() => setSectionId(section.id)}>
            {section.title}
          </Button>
        ))}
      </nav>
      {sectionId === 'app' ? <AppSection /> : <PreferencesSection sectionId={sectionId} edits={edits} setEdits={setEdits} />}
    </div>
  )
}
