import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader, Panel } from '@/components/app/page'
import { initials, useAuth, useUser } from '@/lib/auth'
import { sb } from '@/lib/supabase'

export const Route = createFileRoute('/app/profile')({
  head: () => ({ meta: [{ title: 'Profile - Vincify' }] }),
  component: ProfilePage,
})

function ProfilePage() {
  const user = useUser()
  const { refreshProfile } = useAuth()
  const p = user.profile

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    if (!f.full_name?.trim()) return toast.error('Name is required')
    if (f.phone && !/^\+?[0-9 ()-]{7,32}$/.test(f.phone)) return toast.error('Enter a valid phone number')
    const { error } = await sb()
      .from('profiles')
      .update({
        full_name: f.full_name.trim().slice(0, 120),
        preferred_name: (f.preferred_name ?? '').trim().slice(0, 60),
        phone: f.phone?.trim() || null,
        occupation: f.occupation?.trim().slice(0, 80) || null,
        organization: f.organization?.trim().slice(0, 120) || null,
        goals: (f.goals ?? '')
          .split('\n')
          .map((g) => g.trim().slice(0, 200))
          .filter(Boolean)
          .slice(0, 12),
        timezone: f.timezone?.trim() || 'UTC',
        work_start: f.work_start || null,
        work_end: f.work_end || null,
      })
      .eq('id', user.id)
    if (error) return toast.error(error.message)
    await refreshProfile()
    toast.success('Profile saved')
  }

  return (
    <div className="mx-auto max-w-reading space-y-6">
      <PageHeader title="Profile" description="How Vincify knows you. Used to personalise plans and AI answers." />
      <Panel>
        <div className="mb-6 flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-full bg-brand-gradient text-lg font-semibold text-white">{initials(user.fullName)}</span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{user.fullName}</p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field id="full_name" label="Full name" value={p?.full_name ?? user.fullName} />
          <Field id="preferred_name" label="Preferred name" value={p?.preferred_name ?? ''} />
          <Field id="phone" label="Phone" value={p?.phone ?? ''} type="tel" />
          <Field id="occupation" label="Occupation" value={p?.occupation ?? ''} />
          <Field id="organization" label="Organisation" value={p?.organization ?? ''} />
          <Field id="timezone" label="Timezone" value={p?.timezone ?? user.timezone} />
          <Field id="work_start" label="Day starts" value={p?.work_start?.slice(0, 5) ?? ''} type="time" />
          <Field id="work_end" label="Day ends" value={p?.work_end?.slice(0, 5) ?? ''} type="time" />
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="goals">Productivity objectives (one per line)</Label>
            <Textarea id="goals" name="goals" rows={4} defaultValue={(p?.goals ?? []).join('\n')} />
          </div>
          <div>
            <Button type="submit" variant="brand">
              Save profile
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  )
}

function Field({ id, label, value, type = 'text' }: { id: string; label: string; value: string; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} type={type} defaultValue={value} />
    </div>
  )
}
