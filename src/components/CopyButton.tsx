import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { toast } from '@/hooks/use-toast'
import { copyText } from '@/lib/clipboard'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

// A small copy button beside a value, such as a torrent's name or hash. It shows a tick for a
// moment once copied.
export function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  const name = t('Copy {label}', { label })
  const copy = async () => {
    if (await copyText(text)) {
      setCopied(true)
      toast.success(t('{label} copied', { label }))
    } else {
      toast.error(t("Couldn't copy {label}", { label }))
    }
  }
  return (
    <Tooltip label={name}>
      <Button type="button" variant="ghost" size="icon" className={cn('size-7 shrink-0 text-muted-foreground hover:text-foreground', className)} aria-label={name} onClick={copy}>
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </Button>
    </Tooltip>
  )
}
