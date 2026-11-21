import * as React from "react"
import { XIcon } from "lucide-react"
import { t } from "@/i18n"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { withKeys } from '@/lib/shortcutKeys'
import { keepOpenForNotices } from '@/lib/notices'
import { Button } from "@/components/ui/button"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

// The page behind a dialog stays as it is, not greyed out; the overlay only catches clicks
// outside, which close the dialog. Dialogs open and close at once, without fading.
function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50",
        className
      )}
      {...props}
    />
  )
}

// Enter accepts a dialog: in a form field it submits the form as usual, and elsewhere it presses
// the footer's last filled button, which is the one that accepts. A dialog with only outlined
// buttons, such as a log entry's, has nothing to accept. Ctrl or ⌘ and Enter does the same
// from a text box, where Enter alone starts a new line.
function acceptOnEnter(event: React.KeyboardEvent<HTMLDivElement>) {
  if (event.key !== 'Enter' || event.defaultPrevented || event.nativeEvent.isComposing || event.altKey || event.shiftKey) return
  const target = event.target as HTMLElement
  const typing = target.closest('textarea, [contenteditable="true"]')
  const mod = event.ctrlKey || event.metaKey
  if (typing ? !mod : mod) return
  if (!typing && target.closest('button, a, select, input, [role="menuitem"], [role="option"], [role="combobox"], [role="checkbox"], [role="switch"], [role="tab"]')) return
  const form = target.closest('form')
  if (typing && form) {
    event.preventDefault()
    form.requestSubmit()
    return
  }
  const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-slot="dialog-footer"] button:is([data-variant="default"], [data-variant="destructive"]):not([disabled])')
  const accept = buttons[buttons.length - 1]
  if (!accept) return
  event.preventDefault()
  accept.click()
}

// A dialog with a field to type in starts there. Others start on the dialog itself, so no button
// looks picked and shows its tooltip, and Enter accepts.
function focusOnOpen(event: Event) {
  const content = event.currentTarget as HTMLElement
  if (content.contains(document.activeElement)) return event.preventDefault()
  if (content.querySelector('input:not([type="checkbox"]):not([type="radio"]):not([disabled]), textarea:not([disabled])')) return
  event.preventDefault()
  content.focus()
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  onKeyDown,
  onOpenAutoFocus,
  onInteractOutside,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg outline-hidden sm:max-w-lg",
          className
        )}
        onKeyDown={(event) => { onKeyDown?.(event); acceptOnEnter(event) }}
        onOpenAutoFocus={(event) => { onOpenAutoFocus?.(event); if (!event.defaultPrevented) focusOnOpen(event) }}
        onInteractOutside={(event) => { onInteractOutside?.(event); keepOpenForNotices(event) }}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            // Round, like the other close buttons.
            className="ring-offset-background focus-visible:ring-ring absolute top-3 end-3 flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
            aria-label={t('Close')}
            title={withKeys(t('Close'), 'Esc')}
          >
            <XIcon />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-start", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
