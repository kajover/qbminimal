import * as React from "react"
import { CircleAlert, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { t } from "@/i18n"

// Text fields get a × that empties them, the same in every browser.
const CLEARABLE = new Set(["text", "search", "url", "email", "tel"])
// Fields left without a frame around them: numbers keep their arrows, and the rest aren't typed in.
const UNWRAPPED = new Set(["number", "checkbox", "radio", "file", "hidden", "range", "color"])

// Sets a field's value the way typing does, so React's onChange sees it.
export function setFieldValue(field: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(field, value)
  field.dispatchEvent(new Event("input", { bubbles: true }))
}

// A small note under a field the browser finds incomplete, in place of the browser's own bubble,
// which can't be styled and differs in each browser.
function InvalidNote({ message }: { message: string }) {
  return (
    <span role="alert" className="absolute start-0 top-full z-20 mt-1 flex items-center gap-1 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-sm">
      <CircleAlert className="size-3 shrink-0 text-destructive" aria-hidden />
      {message}
    </span>
  )
}

// Passes the field on to a ref given by the caller, of either kind.
function assignRef<T>(ref: React.Ref<T> | undefined, node: T | null) {
  if (typeof ref === "function") ref(node)
  else if (ref) (ref as React.RefObject<T | null>).current = node
}

function useFieldExtras<T extends HTMLInputElement | HTMLTextAreaElement>(props: {
  value?: React.ComponentProps<"input">["value"]
  defaultValue?: React.ComponentProps<"input">["defaultValue"]
  onChange?: React.ChangeEventHandler<T>
  onInvalid?: React.FormEventHandler<T>
  onBlur?: React.FocusEventHandler<T>
  ref?: React.Ref<T>
}) {
  const field = React.useRef<T | null>(null)
  const [typed, setTyped] = React.useState(() => String(props.defaultValue ?? "") !== "")
  const [invalid, setInvalid] = React.useState<string | null>(null)
  const filled = props.value !== undefined && props.value !== null ? String(props.value) !== "" : typed
  const { ref } = props
  const setRef = (node: T | null) => {
    field.current = node
    assignRef(ref, node)
  }
  return {
    filled,
    invalid,
    fieldProps: {
      ref: setRef,
      onChange: (e: React.ChangeEvent<T>) => {
        setTyped(e.target.value !== "")
        setInvalid(null)
        props.onChange?.(e)
      },
      onInvalid: (e: React.FormEvent<T>) => {
        e.preventDefault()
        const target = e.currentTarget
        setInvalid(target.validity.valueMissing ? t("Fill in this field") : target.validationMessage)
        target.focus()
        props.onInvalid?.(e)
      },
      onBlur: (e: React.FocusEvent<T>) => {
        setInvalid(null)
        props.onBlur?.(e)
      },
    },
    clear: () => {
      if (!field.current) return
      setFieldValue(field.current, "")
      field.current.focus()
    },
  }
}

function ClearButton({ onClear, className }: { onClear: () => void; className?: string }) {
  return (
    // Out of the tab order, so forms don't gain a stop per field; the keyboard can select and delete.
    <button
      type="button"
      tabIndex={-1}
      className={cn("absolute end-0 flex w-8 items-center justify-center text-muted-foreground hover:text-foreground", className)}
      aria-label={t("Clear")}
      title={t("Clear")}
      onClick={onClear}
    >
      <X className="size-4" />
    </button>
  )
}

const FIELD_CLASSES = "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] outline-hidden disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"

// Options of the fields: `className` styles the field; `wrapperClassName` sizes the frame around it,
// which holds the × and the note for a missing entry; `clearable={false}` leaves out the ×, for a
// field that brings a clear button of its own.
type FieldOptions = { wrapperClassName?: string; clearable?: boolean; icon?: React.ReactNode }

// `icon` shows at the field's start, such as a search field's magnifying glass.
function Input({ className, wrapperClassName, clearable: allowClear = true, icon, type, ref, ...props }: React.ComponentProps<"input"> & FieldOptions) {
  const { filled, invalid, fieldProps, clear } = useFieldExtras<HTMLInputElement>({ ...props, ref })
  const kind = type ?? "text"
  const withClear = allowClear && CLEARABLE.has(kind)
  const clearable = withClear && !props.disabled && !props.readOnly
  const input = (
    <input
      type={type}
      data-slot="input"
      className={cn(
        FIELD_CLASSES,
        "file:text-foreground h-9 px-3 py-1 text-sm file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className,
        // Room for the ×, kept over any padding the field sets, and no second × from the browser.
        withClear && "pe-8",
        icon && "ps-8",
        kind === "search" && "[&::-webkit-search-cancel-button]:appearance-none"
      )}
      {...props}
      {...fieldProps}
      aria-invalid={invalid ? true : props["aria-invalid"]}
    />
  )
  if (UNWRAPPED.has(kind)) return input
  return (
    <div className={cn("relative w-full min-w-0", wrapperClassName)}>
      {icon && <span aria-hidden className="pointer-events-none absolute inset-y-0 start-0 flex w-8 items-center justify-center text-muted-foreground">{icon}</span>}
      {input}
      {clearable && filled && <ClearButton onClear={clear} className="inset-y-0" />}
      {invalid && <InvalidNote message={invalid} />}
    </div>
  )
}

// A multi-line field with the same × in its top corner.
function Textarea({ className, wrapperClassName, clearable: allowClear = true, ref, ...props }: React.ComponentProps<"textarea"> & FieldOptions) {
  const { filled, invalid, fieldProps, clear } = useFieldExtras<HTMLTextAreaElement>({ ...props, ref })
  const clearable = allowClear && !props.disabled && !props.readOnly
  return (
    <div className={cn("relative w-full min-w-0", wrapperClassName)}>
      <textarea
        data-slot="textarea"
        className={cn(className, allowClear && "pe-8")}
        {...props}
        {...fieldProps}
        aria-invalid={invalid ? true : props["aria-invalid"]}
      />
      {clearable && filled && <ClearButton onClear={clear} className="top-0 h-8" />}
      {invalid && <InvalidNote message={invalid} />}
    </div>
  )
}

export { Input, Textarea }
