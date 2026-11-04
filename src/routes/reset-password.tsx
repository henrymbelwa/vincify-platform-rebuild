import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { sb } from '@/lib/supabase'

export const Route = createFileRoute('/reset-password')({
  head: () => ({
    meta: [
      { title: 'Set a new password - Vincify' },
      { name: 'description', content: 'Choose a new password for your Vincify account.' },
      { property: 'og:title', content: 'Set a new password - Vincify' },
      { property: 'og:description', content: 'Choose a new password for your Vincify account.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: ResetPassword,
})

function ResetPassword() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const password = String(f.get('password'))
    if (password.length < 8 || !/[0-9]/.test(password) || !/[A-Za-z]/.test(password))
      return toast.error('Use at least 8 characters with a letter and a number.')
    if (password !== String(f.get('confirm'))) return toast.error('Passwords do not match.')
    setBusy(true)
    const code = new URLSearchParams(window.location.search).get('code')
    if (code) await sb().auth.exchangeCodeForSession(code)
    const { error } = await sb().auth.updateUser({ password })
    setBusy(false)
    if (error) return toast.error(error.message)
    toast.success('Password updated')
    navigate({ to: '/app', replace: true })
  }

  return (
    <main className="grid min-h-svh place-items-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-8 shadow-soft">
        <Logo size={26} />
        <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
        </div>
        <Button type="submit" variant="brand" className="w-full" disabled={busy}>
          Update password
        </Button>
      </form>
    </main>
  )
}
