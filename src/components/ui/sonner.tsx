import type { CSSProperties } from "react"
import { useTheme } from "@/lib/theme"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme()

  return (
    // The app's own colours and text sizes: 14px titles over 12px details, like the rest of the app.
    <Sonner
      theme={theme}
      className="toaster group"
      style={{ '--normal-bg': 'var(--popover)', '--normal-text': 'var(--popover-foreground)', '--normal-border': 'var(--border)' } as CSSProperties}
      toastOptions={{ classNames: { title: 'text-sm font-medium', description: 'text-xs text-muted-foreground' } }}
      {...props}
    />
  )
}

export { Toaster }
