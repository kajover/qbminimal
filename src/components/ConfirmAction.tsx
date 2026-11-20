import { useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { t } from '@/i18n'

interface ConfirmActionProps {
  label: string
  title: string
  message: string
  confirmLabel: string
  disabled?: boolean
  onConfirm: () => void
  // Text for a small outlined button. Without it, `children` is shown as an icon button.
  buttonLabel?: string
  // An icon before that text.
  buttonIcon?: LucideIcon
  // For a text button that switches something on, so it reads as an off toggle.
  pressed?: boolean
  // The confirm button is red, as for deleting, unless the action is a safe one.
  safe?: boolean
  // Small, to match the 24px icon buttons beside it in lists.
  small?: boolean
  children?: ReactNode
}

// An icon button that asks in a pop-up before acting, like the delete prompt.
export function ConfirmAction({ label, title, message, confirmLabel, disabled, onConfirm, buttonLabel, buttonIcon: ButtonIcon, pressed, safe, small, children }: ConfirmActionProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {buttonLabel ? (
        <Button type="button" size="sm" variant="outline" title={label} aria-pressed={pressed} disabled={disabled} onClick={() => setOpen(true)}>
          {ButtonIcon && <ButtonIcon />}
          {buttonLabel}
        </Button>
      ) : (
        <Button type="button" variant="ghost" size="icon" className={cn(small ? 'size-6' : 'size-7', 'shrink-0')} aria-label={label} title={label} disabled={disabled} onClick={() => setOpen(true)}>
          {children}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('Cancel')}</Button>
            <Button type="button" variant={safe ? 'default' : 'destructive'} onClick={() => { setOpen(false); onConfirm() }}>{confirmLabel}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
