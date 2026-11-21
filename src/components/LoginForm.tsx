import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSession } from '@/hooks/useSession'
import { t } from '@/i18n'

// The fields start empty and use the standard autocomplete names, so password managers fill them.
export function LoginForm() {
  const { signIn } = useSession()
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    setBusy(true)
    setProblem(null)
    try {
      await signIn(String(fields.get('username') ?? ''), String(fields.get('password') ?? ''))
    } catch (error) {
      setProblem(error instanceof Error ? error.message : t('Signing in failed.'))
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4">
      <form onSubmit={submit} method="post" className="w-full max-w-sm space-y-5 rounded-xl border bg-card p-6">
        <h1 className="brand-title text-center text-2xl">{t('qBittorrent')}</h1>
        <div className="space-y-2">
          <Label htmlFor="login-username">{t('Username')}</Label>
          <Input id="login-username" name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="login-password">{t('Password')}</Label>
          <Input id="login-password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? t('Signing in...') : t('Sign in')}</Button>
      </form>
    </main>
  )
}
