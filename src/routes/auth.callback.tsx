import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Splash } from '@/components/brand/splash'
import { sb } from '@/lib/supabase'

export const Route = createFileRoute('/auth/callback')({
  head: () => ({ meta: [{ title: 'Signing you in - Vincify' }, { name: 'robots', content: 'noindex' }] }),
  component: Callback,
})

function Callback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const desc = params.get('error_description')
    if (desc) return setError(desc)
    const client = sb()
    const code = params.get('code')
    const finish = async () => {
      if (code) {
        const { error } = await client.auth.exchangeCodeForSession(code)
        if (error && !(await client.auth.getSession()).data.session) return setError(error.message)
      }
      const { data } = await client.auth.getSession()
      navigate({ to: data.session ? '/app' : '/auth', replace: true })
    }
    finish()
  }, [navigate])

  if (error)
    return (
      <main className="grid min-h-svh place-items-center px-6 text-center">
        <div className="max-w-sm space-y-3">
          <h1 className="text-lg font-semibold">We could not sign you in</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <a href="/auth" className="text-sm font-medium text-primary hover:underline">
            Back to sign in
          </a>
        </div>
      </main>
    )
  return <Splash />
}
