import { useState, type FormEvent } from 'react'
import { Check, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useTorrentAction } from '@/hooks/useApi'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import { t } from '@/i18n'

const areaClass = 'border-input dark:bg-input/30 w-full rounded-md border bg-transparent px-2 py-1 font-mono text-xs'

// Certificates for SSL torrents, which only connect to peers holding a matching certificate.
export function SSLParametersForm({ hash }: { hash: string }) {
  const action = useTorrentAction()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [values, setValues] = useState({ certificate: '', privateKey: '', dhParams: '' })

  const load = async () => {
    setOpen(true)
    setLoading(true)
    try {
      const params = await qbitClient.getSSLParameters(hash)
      setValues({ certificate: params.ssl_certificate ?? '', privateKey: params.ssl_private_key ?? '', dhParams: params.ssl_dh_params ?? '' })
    } catch (e) {
      const message = e instanceof Error ? e.message : ''
      toast.error(t('Couldn\'t load the SSL settings'), { description: message.includes('404') ? t('This needs qBittorrent 5.1 or newer.') : message || undefined })
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  const save = (e: FormEvent) => {
    e.preventDefault()
    action.mutateAsync({
      work: () => qbitClient.setSSLParameters(hash, values.certificate.trim(), values.privateKey.trim(), values.dhParams.trim()),
      failed: t('Failed to save the SSL settings'),
    }).then(() => { toast.success(t('SSL settings saved')) }, () => undefined)
  }

  if (!open) {
    return <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={load}><ShieldCheck />{t('SSL torrent certificate...')}</Button>
  }

  return (
    <form onSubmit={save} className="space-y-2 rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{t('Only for SSL torrents. Paste each in PEM format.')}</p>
      {loading ? <p className="text-xs text-muted-foreground">{t('Loading...')}</p> : (
        <>
          {([['ssl-cert', 'Certificate', 'certificate'], ['ssl-key', 'Private key', 'privateKey'], ['ssl-dh', 'Diffie-Hellman parameters', 'dhParams']] as const).map(([id, label, key]) => (
            <div key={id} className="space-y-1">
              <Label htmlFor={id} className="text-xs text-muted-foreground">{t(label)}</Label>
              <textarea id={id} rows={3} value={values[key]} onChange={(e) => setValues({ ...values, [key]: e.target.value })} className={areaClass} />
            </div>
          ))}
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="outline" className="h-8 text-xs" disabled={action.isPending}><Check />{t('Save SSL settings')}</Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setOpen(false)}>{t('Hide')}</Button>
          </div>
        </>
      )}
    </form>
  )
}
