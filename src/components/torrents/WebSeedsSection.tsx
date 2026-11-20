import { useState, type FormEvent } from 'react'
import { Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { ConfirmAction } from '@/components/ConfirmAction'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTorrentAction, useWebSeeds } from '@/hooks/useApi'
import { toast } from '@/hooks/use-toast'
import { qbitClient } from '@/lib/api'
import { cn } from '@/lib/utils'
import { DetailsHeading } from './DetailsHeading'
import { t } from '@/i18n'

function WebSeedRow({ hash, url }: { hash: string; url: string }) {
  const action = useTorrentAction()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(url)

  const save = (e: FormEvent) => {
    e.preventDefault()
    const newUrl = value.trim()
    if (!newUrl) {
      toast.error(t('Enter a web seed URL'))
      return
    }
    if (newUrl === url) {
      setEditing(false)
      return
    }
    action.mutateAsync({ work: () => qbitClient.editWebSeed(hash, url, newUrl), failed: t('Failed to change web seed') })
      .then(() => { setEditing(false); toast.success(t('Web seed changed')) }, () => undefined)
  }

  if (editing) {
    return (
      <li className="py-2">
        <form onSubmit={save} className="space-y-2">
          <Input aria-label={t('Web seed URL')} value={value} autoFocus onChange={(e) => setValue(e.target.value)} className="h-8 font-mono text-xs" dir="ltr" />
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="outline" className="h-8 text-xs" disabled={action.isPending}><Check />{t('Save')}</Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditing(false)}>{t('Cancel')}</Button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className="flex items-start gap-1 py-1 hover:bg-muted/50">
      <p className="min-w-0 flex-1 py-1 font-mono text-xs break-all" dir="ltr">{url}</p>
      <Button type="button" variant="ghost" size="icon" className="size-6 shrink-0" aria-label={t('Edit {url}', { url })} title={t('Edit web seed')} onClick={() => { setValue(url); setEditing(true) }}>
        <Pencil className="size-3" />
      </Button>
      <ConfirmAction
        small
        label={t('Remove {url}', { url })}
        title={t('Remove this web seed?')}
        message={t('{url} will no longer be used to download this torrent.', { url })}
        confirmLabel={t('Remove')}
        disabled={action.isPending}
        onConfirm={() => action.mutateAsync({ work: () => qbitClient.removeWebSeeds(hash, [url]), failed: t('Failed to remove web seed') })
          .then(() => { toast.success(t('Web seed removed')) }, () => undefined)}
      >
        <Trash2 className="size-3" />
      </ConfirmAction>
    </li>
  )
}

// The add buttons for trackers and web seeds are both as wide as the longer of their labels, so
// the boxes beside them are the same width too.
export function AddButtonLabel({ webSeeds }: { webSeeds?: boolean }) {
  const labels = [t('Add trackers'), t('Add web seeds')]
  const shown = webSeeds ? 1 : 0
  return (
    <span className="grid">
      {labels.map((label, i) => <span key={label} className={cn('col-start-1 row-start-1', i !== shown && 'invisible')}>{label}</span>)}
    </span>
  )
}

// Web seeds are HTTP servers that hold the same files as the torrent.
export function WebSeedsSection({ hash }: { hash: string }) {
  const { data: seeds, isLoading, isError } = useWebSeeds(hash)
  const action = useTorrentAction()
  const [newUrls, setNewUrls] = useState('')

  const add = (e: FormEvent) => {
    e.preventDefault()
    const urls = newUrls.split('\n').map(url => url.trim()).filter(Boolean)
    if (urls.length === 0) {
      toast.error(t('Enter at least one web seed URL'))
      return
    }
    action.mutateAsync({ work: () => qbitClient.addWebSeeds(hash, urls), failed: t('Failed to add web seeds') })
      .then(() => { setNewUrls(''); toast.success(urls.length === 1 ? t('Web seed added') : t('Web seeds added')) }, () => undefined)
  }

  const status = (text: string) => <p className="py-2 text-xs text-muted-foreground">{text}</p>

  return (
    <section className="border-t px-2 pt-3">
      <DetailsHeading>{t('Web seeds')}</DetailsHeading>
      {isLoading ? status(t('Loading web seeds...'))
        : isError && !seeds ? status(t('Couldn\'t load web seeds'))
        : !seeds?.length ? status(t('No web seeds'))
        : (
          <ul className="divide-y text-xs">
            {seeds.map(seed => <WebSeedRow key={seed.url} hash={hash} url={seed.url} />)}
          </ul>
        )}
      <form onSubmit={add} className="space-y-1 pt-2">
        <Label htmlFor="new-web-seeds" className="text-xs text-muted-foreground">{t('Add web seeds, one URL per line')}</Label>
        {/* Laid out like the Comment field under Actions: the box with its button beside it. */}
        <div className="flex max-w-3xl items-start gap-2">
          <Textarea
            id="new-web-seeds"
            rows={2}
            wrapperClassName="min-w-0 flex-1"
            value={newUrls}
            onChange={(e) => setNewUrls(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.currentTarget.form?.requestSubmit() } }}
            placeholder={t('https://files.example.com/path/')}
            className="min-h-14 px-2 py-1 font-mono text-xs"
            dir="ltr"
          />
          <Button type="submit" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs [&_svg:not([class*=size-])]:size-3.5" disabled={action.isPending} title={t('Ctrl or ⌘ and Enter')}><Plus /><AddButtonLabel webSeeds /></Button>
        </div>
      </form>
    </section>
  )
}
