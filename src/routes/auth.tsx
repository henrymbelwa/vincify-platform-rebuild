import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { sb } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

const search = z.object({
  mode: z.enum(['signin', 'signup', 'forgot']).catch('signin').optional(),
  ref: z.string().max(16).optional(),
})

export const Route = createFileRoute('/auth')({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: 'Sign in to Vincify' },
      { name: 'description', content: 'Sign in or create your private Vincify workspace.' },
      { property: 'og:title', content: 'Sign in to Vincify' },
      { property: 'og:description', content: 'Sign in or create your private Vincify workspace.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: AuthPage,
})

const signupSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(120),
  email: z.string().trim().email('Enter a valid email').max(255),
  phone: z
    .string()
    .trim()
    .max(32)
    .regex(/^$|^\+?[0-9 ()-]{7,}$/, 'Enter a valid phone number'),
  password: z
    .string()
    .min(8, 'Use at least 8 characters')
    .regex(/[A-Za-z]/, 'Include a letter')
    .regex(/[0-9]/, 'Include a number'),
  referral: z.string().trim().max(16),
})

function AuthPage() {
  const { mode = 'signin', ref } = Route.useSearch()
  const navigate = useNavigate()
  const { session, ready } = useAuth()
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (ready && session) navigate({ to: '/app', replace: true })
  }, [ready, session, navigate])

  const setMode = (m: 'signin' | 'signup' | 'forgot') => {
    setErrors({})
    setSent(null)
    navigate({ to: '/auth', search: { mode: m, ref }, replace: true })
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    setErrors({})
    setBusy(true)
    try {
      if (mode === 'signup') {
        const parsed = signupSchema.safeParse(f)
        if (!parsed.success) {
          setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])))
          return
        }
        const v = parsed.data
        const { error } = await sb().auth.signUp({
          email: v.email,
          password: v.password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: { full_name: v.fullName, phone: v.phone || null, referral_code: v.referral || null },
          },
        })
        if (error) throw error
        setSent(`We sent a confirmation link to ${v.email}. Open it to activate your account.`)
      } else if (mode === 'forgot') {
        const email = z.string().trim().email().safeParse(f.email)
        if (!email.success) return setErrors({ email: 'Enter a valid email' })
        const { error } = await sb().auth.resetPasswordForEmail(email.data, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) throw error
        setSent(`If an account exists for ${email.data}, a reset link is on its way.`)
      } else {
        const { error } = await sb().auth.signInWithPassword({ email: String(f.email).trim(), password: String(f.password) })
        if (error) throw error
        navigate({ to: '/app', replace: true })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  async function google() {
    setBusy(true)
    if (ref) sessionStorage.setItem('vincify.ref', ref)
    const { error } = await sb().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setBusy(false)
      toast.error(error.message)
    }
  }

  const title = mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : 'Welcome back'
  const err = (k: string) => errors[k] && <p className="text-xs text-destructive">{errors[k]}</p>

  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(36rem 22rem at 15% 0%, rgb(236 72 153 / 0.12), transparent 70%), radial-gradient(40rem 26rem at 90% 10%, rgb(139 92 246 / 0.16), transparent 70%)',
        }}
      />
      <div className="relative w-full max-w-md rounded-2xl border bg-card p-6 shadow-soft sm:p-8">
        <Link to="/" aria-label="Vincify home">
          <Logo size={26} />
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === 'signup' ? 'Your workspace is private to you.' : mode === 'forgot' ? 'We will email you a secure link.' : 'Sign in to continue to your workspace.'}
        </p>

        {sent ? (
          <div className="mt-6 rounded-xl border bg-accent p-4 text-sm text-accent-foreground">{sent}</div>
        ) : (
          <>
            {mode !== 'forgot' && (
              <>
                <Button type="button" variant="outline" className="mt-6 w-full" onClick={google} disabled={busy}>
                  <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
                    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4-5.5 4-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
                  </svg>
                  Continue with Google
                </Button>
                <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
                </div>
              </>
            )}
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              {mode === 'signup' && (
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input id="fullName" name="fullName" autoComplete="name" required />
                  {err('fullName')}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" autoComplete="email" required />
                {err('email')}
              </div>
              {mode === 'signup' && (
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone (optional)</Label>
                  <Input id="phone" name="phone" type="tel" autoComplete="tel" />
                  {err('phone')}
                </div>
              )}
              {mode !== 'forgot' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === 'signin' && (
                      <button type="button" onClick={() => setMode('forgot')} className="text-xs text-primary hover:underline">
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <Input id="password" name="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required />
                  {err('password')}
                </div>
              )}
              {mode === 'signup' && (
                <div className="space-y-1.5">
                  <Label htmlFor="referral">Referral code (optional)</Label>
                  <Input id="referral" name="referral" defaultValue={ref ?? ''} className="uppercase" maxLength={16} />
                </div>
              )}
              <Button type="submit" variant="brand" className="w-full" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />}
                {mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}
              </Button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === 'signup' ? (
            <>
              Already have an account?{' '}
              <button className="font-medium text-primary hover:underline" onClick={() => setMode('signin')}>
                Sign in
              </button>
            </>
          ) : (
            <>
              New to Vincify?{' '}
              <button className="font-medium text-primary hover:underline" onClick={() => setMode('signup')}>
                Create an account
              </button>
            </>
          )}
        </p>
      </div>
    </main>
  )
}
