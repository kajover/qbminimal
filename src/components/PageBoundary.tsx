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

export function PageBoundary({ loading, children }: { loading?: ReactNode; children: ReactNode }) {
  return (
    <LoadErrorBoundary>
      <Suspense fallback={loading === undefined ? <div className="py-8 text-center text-sm text-muted-foreground">{t('Loading...')}</div> : loading}>
        {children}
      </Suspense>
    </LoadErrorBoundary>
  )
}
