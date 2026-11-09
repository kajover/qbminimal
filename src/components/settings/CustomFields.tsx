import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { ConfirmAction } from '@/components/ConfirmAction'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import { copyText } from '@/lib/clipboard'
import type { Cookie } from '@/types'
import { t } from '@/i18n'

const selectClass = 'border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm'

// qBittorrent stores each watched folder with 0 (save there), 1 (default save path), or a path.
type WatchTarget = 0 | 1 | string

export function ScanDirsEditor({ value, onChange, disabled }: { value: unknown; onChange: (value: Record<string, WatchTarget>) => void; disabled?: boolean }) {
  const dirs = Object.entries((value && typeof value === 'object' ? value : {}) as Record<string, WatchTarget>)
  const [rows, setRows] = useState(dirs.length ? dirs : [])

  const update = (next: [string, WatchTarget][]) => {
    setRows(next)
    onChange(Object.fromEntries(next.filter(([path]) => path.trim()).map(([path, target]) => [path.trim(), target])))
  }

  return (
    <div className="space-y-2">
      {rows.length === 0 && <p className="text-xs text-muted-foreground">{t('No watched folders')}</p>}
      {rows.map(([path, target], i) => (
        <div key={i} className="space-y-1 rounded-md border p-2">
          <div className="flex gap-2">
            <Input aria-label={t('Watched folder')} placeholder={t('Folder to watch')} value={path} disabled={disabled} onChange={(e) => update(rows.map((row, j) => (j === i ? [e.target.value, row[1]] : row)))} className="h-8 text-sm" />
            <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0" aria-label={t('Remove watched folder')} disabled={disabled} onClick={() => update(rows.filter((_, j) => j !== i))}>
              <Trash2 className="size-4" />
            </Button>
          </div>
          <select
            aria-label={t('Save torrents from this folder to')}
            value={typeof target === 'string' ? 'other' : String(target)}
            disabled={disabled}
            onChange={(e) => update(rows.map((row, j) => (j === i ? [row[0], e.target.value === 'other' ? '' : (Number(e.target.value) as 0 | 1)] : row)))}
            className={selectClass}
          >
            <option value="0">{t('Save to the watched folder')}</option>
            <option value="1">{t('Save to the default save path')}</option>
            <option value="other">{t('Save to another folder')}</option>
          </select>
          {typeof target === 'string' && (
            <Input aria-label={t('Save folder')} placeholder={t('Save folder')} value={target} disabled={disabled} onChange={(e) => update(rows.map((row, j) => (j === i ? [row[0], e.target.value] : row)))} className="h-8 text-sm" />
          )}
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => update([...rows, ['', 0]])}>
        <Plus className="me-1 size-4" />{' '}{t('Add folder')}
      </Button>
    </div>
  )
}

export function ApiKeyField({ value }: { value: unknown }) {
  const [key, setKey] = useState(typeof value === 'string' ? value : '')
  const [shown, setShown] = useState<string | null>(null)

  const rotate = async () => {
    try {
      const next = await qbitClient.rotateApiKey()
      setKey(next)
      setShown(next)
      toast.success(t('New API key created'), { description: t('Copy it now. Anything using the old key stops working.') })
    } catch (e) {
      toast.error(t('Couldn\'t create an API key'), { description: e instanceof Error ? e.message : undefined })
    }
  }

  const remove = async () => {
    try {
      await qbitClient.deleteApiKey()
      setKey('')
      setShown(null)
      toast.success(t('API key deleted'))
    } catch (e) {
      toast.error(t('Couldn\'t delete the API key'), { description: e instanceof Error ? e.message : undefined })
    }
  }

  return (
    <div className="space-y-2">
      <p className="break-all font-mono text-xs">{shown ?? (key ? `${key.slice(0, 6)}${'•'.repeat(12)}` : t('No API key'))}</p>
      <div className="flex flex-wrap gap-2">
        {shown && <Button type="button" size="sm" variant="outline" onClick={async () => { if (await copyText(shown)) toast.success(t('API key copied')) }}>{t('Copy')}</Button>}
        <ConfirmAction buttonLabel={key ? t('Create a new key') : t('Create a key')} label={t('Create an API key')} title={key ? t('Replace the API key?') : t('Create an API key?')} message={t('Apps can use an API key instead of your password. A new key replaces the old one, which stops working.')} confirmLabel={t('Create')} onConfirm={rotate} />
        {key && <ConfirmAction buttonLabel={t('Delete key')} label={t('Delete the API key')} title={t('Delete the API key?')} message={t('Anything using it stops working.')} confirmLabel={t('Delete')} onConfirm={remove} />}
      </div>
    </div>
  )
}

export function NetworkInterfaceField({ value, onChange, disabled }: { value: unknown; onChange: (value: string) => void; disabled?: boolean }) {
  const { data: interfaces } = useQuery({ queryKey: ['app', 'interfaces'], queryFn: () => qbitClient.getNetworkInterfaces() })
  const current = typeof value === 'string' ? value : ''
  return (
    <select aria-label={t('Network interface')} value={current} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={selectClass}>
      <option value="">{t('Any interface')}</option>
      {current && !interfaces?.some(i => i.value === current) && <option value={current}>{current}</option>}
      {(interfaces ?? []).map(i => <option key={i.value} value={i.value}>{i.name}</option>)}
    </select>
  )
}

export function InterfaceAddressField({ value, iface, onChange, disabled }: { value: unknown; iface: string; onChange: (value: string) => void; disabled?: boolean }) {
  const { data: addresses } = useQuery({ queryKey: ['app', 'interfaceAddresses', iface], queryFn: () => qbitClient.getInterfaceAddresses(iface) })
  const current = typeof value === 'string' ? value : ''
  return (
    <select aria-label={t('IP address to bind to')} value={current} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={selectClass}>
      <option value="">{t('All addresses')}</option>
      <option value="0.0.0.0">{t('All IPv4 addresses')}</option>
      <option value="::">{t('All IPv6 addresses')}</option>
      {current && !['', '0.0.0.0', '::'].includes(current) && !addresses?.includes(current) && <option value={current}>{current}</option>}
      {(addresses ?? []).map(address => <option key={address} value={address}>{address}</option>)}
    </select>
  )
}

// Stops qBittorrent itself. Nothing in this app can start it again.
export function ShutdownButton() {
  const shutdown = async () => {
    try {
      await qbitClient.shutdown()
      toast.success(t('qBittorrent is shutting down'), { description: t('This page stops working until qBittorrent is started again.') })
    } catch (e) {
      toast.error(t('Couldn\'t shut down qBittorrent'), { description: e instanceof Error ? e.message : undefined })
    }
  }
  return (
    <div className="space-y-1">
      <ConfirmAction
        buttonLabel={t('Shut down qBittorrent')}
        label={t('Shut down qBittorrent')}
        title={t('Shut down qBittorrent?')}
        message={t('All downloads and seeding stop, and this page can\'t start it again. Starting it again has to happen wherever qBittorrent runs.')}
        confirmLabel={t('Shut down')}
        onConfirm={shutdown}
      />
      <p className="text-xs text-muted-foreground">{t('Stops every transfer and closes qBittorrent. Starting it again has to happen on its machine.')}</p>
    </div>
  )
}

export function TestEmailButton({ disabled, unsaved }: { disabled?: boolean; unsaved: boolean }) {
  const [sending, setSending] = useState(false)
  const send = async () => {
    setSending(true)
    try {
      await qbitClient.sendTestEmail()
      toast.success(t('Test email sent'), { description: t('Check the inbox you entered.') })
    } catch (e) {
      toast.error(t('Couldn\'t send the test email'), { description: e instanceof Error ? e.message : undefined })
    } finally {
      setSending(false)
    }
  }
  return (
    <div className="space-y-1">
      <Button type="button" size="sm" variant="outline" disabled={disabled || sending || unsaved} onClick={send}>{t('Send a test email')}</Button>
      {unsaved && <p className="text-xs text-muted-foreground">{t('Save your changes first. The test uses the saved settings.')}</p>}
    </div>
  )
}

export function TrackerUrlList({ value }: { value: unknown }) {
  const list = typeof value === 'string' ? value.trim() : ''
  return list ? <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-all rounded-md bg-muted p-2 text-xs">{list}</pre> : <p className="text-xs text-muted-foreground">{t('Nothing downloaded yet')}</p>
}

const emptyCookie = (): Cookie => ({ name: '', domain: '', path: '/', value: '', expirationDate: Math.floor(Date.now() / 1000) + 365 * 86400 })

// Saved straight away with its own button, since qBittorrent keeps cookies apart from the other settings.
export function CookiesEditor() {
  const { data, refetch, isLoading } = useQuery({ queryKey: ['app', 'cookies'], queryFn: () => qbitClient.getCookies() })
  // Edits start from what qBittorrent has, until the first change makes them our own.
  const [edited, setRows] = useState<Cookie[] | null>(null)
  const [saving, setSaving] = useState(false)
  const rows = edited ?? data ?? null

  if (isLoading || !rows) return <p className="text-xs text-muted-foreground">{t('Loading cookies...')}</p>

  const update = (i: number, changes: Partial<Cookie>) => setRows(rows.map((row, j) => (j === i ? { ...row, ...changes } : row)))

  const save = async () => {
    const cookies = rows.filter(row => row.name.trim() && row.domain.trim())
    setSaving(true)
    try {
      await qbitClient.setCookies(cookies)
      const fresh = await refetch()
      setRows(fresh.data ?? cookies)
      toast.success(t('Cookies saved'))
    } catch (e) {
      toast.error(t('Couldn\'t save cookies'), { description: e instanceof Error ? e.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      {rows.length === 0 && <p className="text-xs text-muted-foreground">{t('No cookies')}</p>}
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-2 gap-2 rounded-md border p-2">
          <Input aria-label={t('Cookie domain')} placeholder={t('Domain')} value={row.domain} onChange={(e) => update(i, { domain: e.target.value })} className="h-8 text-sm" />
          <Input aria-label={t('Cookie path')} placeholder={t('Path')} value={row.path} onChange={(e) => update(i, { path: e.target.value })} className="h-8 text-sm" />
          <Input aria-label={t('Cookie name')} placeholder={t('Name')} value={row.name} onChange={(e) => update(i, { name: e.target.value })} className="h-8 text-sm" />
          <Input aria-label={t('Cookie value')} placeholder={t('Value')} value={row.value} onChange={(e) => update(i, { value: e.target.value })} className="h-8 text-sm" />
          <Input
            aria-label={t('Cookie expiry date')}
            type="date"
            value={new Date(row.expirationDate * 1000).toISOString().slice(0, 10)}
            onChange={(e) => update(i, { expirationDate: Math.floor(new Date(e.target.value).getTime() / 1000) || row.expirationDate })}
            className="h-8 text-sm"
          />
          <Button type="button" size="sm" variant="ghost" onClick={() => setRows(rows.filter((_, j) => j !== i))}>{t('Remove')}</Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setRows([...rows, emptyCookie()])}>
          <Plus className="me-1 size-4" />{' '}{t('Add cookie')}
        </Button>
        <Button type="button" size="sm" disabled={saving} onClick={save}>{t('Save cookies')}</Button>
      </div>
    </div>
  )
}
