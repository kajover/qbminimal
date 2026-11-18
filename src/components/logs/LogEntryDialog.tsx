import { useMemo } from 'react'
import { Copy, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/CopyButton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { t } from '@/i18n'
import { copyText } from '@/lib/clipboard'
import { jsonTokens, type JsonTokenKind, type LogField } from '@/lib/logDetails'
import { formatLogTime } from '@/lib/logExport'
import { cn } from '@/lib/utils'

// One entry of either log, as the list shows it.
export interface LogRow {
  // Unique across both logs, whose ids overlap.
  key: string
  id: number
  timestamp: number
  // The word shown in the badge.
  label: string
  // The English word for an export, so it reads the same in every language.
  level: string
  badge: string
  message: string
  // The message split into its sentence and its details, as parseLogMessage reads it.
  summary: string
  fields: LogField[]
  // What "Hide similar entries" hides by: the sentence, which stays the same while the details
  // (a torrent's name, an address) change. Only the general log's entries have one.
  hideKey?: string
}

export function LogBadge({ row }: { row: LogRow }) {
  return <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium', row.badge)}>{row.label}</span>
}

const JSON_COLORS: Record<JsonTokenKind, string> = {
  key: 'text-sky-700 dark:text-sky-400',
  string: 'text-emerald-700 dark:text-emerald-400',
  number: 'text-amber-700 dark:text-amber-400',
  literal: 'text-violet-700 dark:text-violet-400',
  plain: 'text-muted-foreground',
}

async function copy(text: string, label: string) {
  if (await copyText(text)) toast.success(t('{label} copied', { label }))
  else toast.error(t("Couldn't copy {label}", { label }))
}

// The entry on its own: the sentence as the title, its details one per line to read and copy
// apart, and the whole entry as JSON, coloured, for pasting elsewhere.
export function LogEntryDialog({ row, onClose, onHide }: { row: LogRow; onClose: () => void; onHide: (key: string) => void }) {
  const json = useMemo(() => {
    const details = row.fields.length ? { details: Object.fromEntries(row.fields.map(field => [field.key, field.value])) } : {}
    return JSON.stringify({ id: row.id, time: formatLogTime(row.timestamp), level: row.level, message: row.message, ...details }, null, 2)
  }, [row])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined} className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className="pe-8 text-start">
          <div className="flex items-center gap-2">
            <LogBadge row={row} />
            <span className="text-xs tabular-nums text-muted-foreground">{formatLogTime(row.timestamp)}</span>
          </div>
          <DialogTitle className="break-words text-start leading-snug">{row.summary || row.message}</DialogTitle>
        </DialogHeader>

        {row.fields.length > 0 && (
          <dl className="min-w-0 divide-y rounded-md border text-sm">
            {row.fields.map((field, index) => (
              <div key={index} className="flex items-center gap-3 py-1 ps-3 pe-1">
                <dt className="w-32 shrink-0 text-muted-foreground">{field.key}</dt>
                <dd className="min-w-0 flex-1 font-mono text-xs [overflow-wrap:anywhere]">{field.value}</dd>
                <CopyButton text={field.value} label={field.key} />
              </div>
            ))}
          </dl>
        )}

        <pre className="min-w-0 whitespace-pre-wrap rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed [overflow-wrap:anywhere]">
          {jsonTokens(json).map((token, index) => <span key={index} className={JSON_COLORS[token.kind]}>{token.text}</span>)}
        </pre>

        <DialogFooter className="flex-row flex-wrap gap-2 sm:justify-start">
          <Button variant="outline" onClick={() => void copy(json, 'JSON')}><Copy />{t('Copy JSON')}</Button>
          <Button variant="outline" onClick={() => void copy(row.message, t('Message'))}><Copy />{t('Copy message')}</Button>
          {row.hideKey && (
            <Button variant="outline" onClick={() => { onHide(row.hideKey!); onClose() }}><EyeOff />{t('Hide similar entries')}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
