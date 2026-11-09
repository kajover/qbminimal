import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { t } from '@/i18n'

// A page's script can fail to load, for example if a new release replaced it while this tab was open.
class LoadErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="space-y-3 py-8 text-center">
        <p className="text-sm text-muted-foreground">{t('Couldn\'t load this page.')}</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>{t('Reload')}</Button>
      </div>
    )
  }
}

// The loading boundary stays in place while what's inside changes, so a switch made in a transition
// keeps the current content on screen until the next has loaded. A new resetKey clears a failure.
export function PageBoundary({ loading, resetKey, children }: { loading?: ReactNode; resetKey?: string; children: ReactNode }) {
  return (
    <Suspense fallback={loading === undefined ? <div className="py-8 text-center text-sm text-muted-foreground">{t('Loading...')}</div> : loading}>
      <LoadErrorBoundary key={resetKey}>{children}</LoadErrorBoundary>
    </Suspense>
  )
}
