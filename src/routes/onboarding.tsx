import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { sb } from '@/lib/supabase'
import { useAuth, useUser } from '@/lib/auth'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/onboarding')({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await sb().auth.getSession()
    if (!data.session) throw redirect({ to: '/auth' })
  },
  head: () => ({ meta: [{ title: 'Set up your workspace - Vincify' }, { name: 'robots', content: 'noindex' }] }),
  component: Onboarding,
})

const ROLES = ['Student', 'Teacher or lecturer', 'Professional', 'Entrepreneur', 'Freelancer', 'Researcher', 'Project manager', 'Other']
const GOALS = [
  'Stay on top of deadlines',
  'Build consistent daily habits',
  'Manage projects end to end',
  'Organise my study timetable',
  'Reduce stress and overwhelm',
  'Track and improve my productivity',
]

function Onboarding() {
  const user = useUser()
  const { refreshProfile } = useAuth()
  const navigate = useNavigate()
  const zones = useMemo(() => (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? ['UTC'], [])
  const [role, setRole] = useState(user.profile?.occupation ?? '')
  const [goals, setGoals] = useState<string[]>(user.profile?.goals ?? [])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const ref = sessionStorage.getItem('vincify.ref')
    if (ref) {
      sessionStorage.removeItem('vincify.ref')
      sb().rpc('claim_referral', { _code: ref })
    }
  }, [])

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    if (!f.preferred_name?.trim()) return toast.error('Tell us what to call you.')
    if (!role) return toast.error('Choose what best describes you.')
    setBusy(true)
    const { error } = await sb()
      .from('profiles')
      .update({
        full_name: (f.full_name || user.fullName).trim().slice(0, 120),
        preferred_name: f.preferred_name.trim().slice(0, 60),
        occupation: role,
        organization: f.organization?.trim().slice(0, 120) || null,
        goals,
        timezone: f.timezone,
        work_start: f.work_start || null,
        work_end: f.work_end || null,
        onboarded: true,
      })
      .eq('id', user.id)
    setBusy(false)
    if (error) return toast.error(error.message)
    await refreshProfile()
    navigate({ to: '/app', search: { tour: 1 }, replace: true })
  }

  const chip = (active: boolean) =>
    cn(
      'rounded-full border px-3 py-1.5 text-sm transition-colors',
      active ? 'border-transparent bg-brand-gradient text-white' : 'bg-card hover:border-primary/40',
    )

  return (
    <main className="min-h-svh bg-background px-4 py-10">
      <form onSubmit={submit} className="mx-auto max-w-2xl space-y-8 rounded-2xl border bg-card p-6 shadow-soft sm:p-10">
        <div>
          <Logo size={26} />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Let us personalise your workspace</h1>
          <p className="mt-1 text-sm text-muted-foreground">This takes a minute. You can change everything later in Profile.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" name="full_name" defaultValue={user.fullName} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="preferred_name">What should we call you?</Label>
            <Input id="preferred_name" name="preferred_name" defaultValue={user.profile?.preferred_name || user.fullName.split(' ')[0]} />
          </div>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">What best describes you?</legend>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <button type="button" key={r} className={chip(role === r)} onClick={() => setRole(r)} aria-pressed={role === r}>
                {r}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="space-y-1.5">
          <Label htmlFor="organization">School, company or organisation (optional)</Label>
          <Input id="organization" name="organization" defaultValue={user.profile?.organization ?? ''} />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">What do you want Vincify to help with?</legend>
          <div className="flex flex-wrap gap-2">
            {GOALS.map((g) => {
              const on = goals.includes(g)
              return (
                <button
                  type="button"
                  key={g}
                  aria-pressed={on}
                  className={chip(on)}
                  onClick={() => setGoals((s) => (on ? s.filter((x) => x !== g) : [...s, g]))}
                >
                  {g}
                </button>
              )
            })}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-1">
            <Label htmlFor="timezone">Timezone</Label>
            <select
              id="timezone"
              name="timezone"
              defaultValue={user.timezone}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              {zones.map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="work_start">Day starts</Label>
            <Input id="work_start" name="work_start" type="time" defaultValue={user.profile?.work_start?.slice(0, 5) ?? '08:00'} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="work_end">Day ends</Label>
            <Input id="work_end" name="work_end" type="time" defaultValue={user.profile?.work_end?.slice(0, 5) ?? '17:00'} />
          </div>
        </div>
        <Button type="submit" variant="brand" size="lg" className="w-full sm:w-auto" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} Enter my workspace
        </Button>
      </form>
    </main>
  )
}
