import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { SessionContext, type SessionStatus } from '@/hooks/useSession'
import { qbitClient } from '@/lib/api'
import { t } from '@/i18n'

// Knows whether the browser holds a qBittorrent session, and signs in and out.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('checking')
  const queryClient = useQueryClient()

  useEffect(() => {
    let active = true
    // An expired session sends the app back to the login form from any request.
    qbitClient.onUnauthorized(() => setStatus('signedOut'))
    qbitClient.checkSession().then(ok => {
      if (active) setStatus(ok ? 'signedIn' : 'signedOut')
    })
    return () => {
      active = false
      qbitClient.onUnauthorized(null)
    }
  }, [])

  const signIn = useCallback(async (username: string, password: string) => {
    if (!(await qbitClient.login(username, password))) throw new Error(t('qBittorrent didn\'t accept that username and password.'))
    setStatus('signedIn')
  }, [])

  // Forgets everything loaded, so the next person to sign in starts clean.
  const signOut = useCallback(async () => {
    await qbitClient.logout()
    queryClient.clear()
    setStatus('signedOut')
  }, [queryClient])

  const value = useMemo(() => ({ status, signIn, signOut }), [status, signIn, signOut])
  return <SessionContext value={value}>{children}</SessionContext>
}

