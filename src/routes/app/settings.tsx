import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import { Brain, Download, Monitor, Moon, Sun, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Empty, PageHeader, Panel } from '@/components/app/page'
import { deleteAccount } from '@/lib/api.functions'
import { useUser } from '@/lib/auth'
import { useTable } from '@/lib/queries'
import { must, sb } from '@/lib/supabase'
import { useTheme, type ThemeChoice } from '@/lib/theme'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/app/settings')({
  head: () => ({ meta: [{ title: 'Settings - Vincify' }] }),
  component: Settings,
})

const CATEGORIES = ['task', 'event', 'project', 'ai', 'automation', 'reward', 'system'] as const
const CAT_LABEL: Record<(typeof CATEGORIES)[number], string> = {
  task: 'Tasks',
  event: 'Events and reminders',
  project: 'Projects',
  ai: 'AI insights',
  automation: 'Automations',
  reward: 'Rewards',
  system: 'Account and security',
}
const EXPORT_TABLES = ['profiles', 'user_preferences', 'tasks', 'goals', 'projects', 'project_objectives', 'project_milestones', 'project_notes', 'custom_tables', 'custom_table_columns', 'custom_table_rows', 'project_resources', 'daily_checkins', 'weekly_plans', 'monthly_plans', 'calendar_events', 'timetables', 'timetable_entries', 'documents', 'conversations', 'messages', 'ai_memories', 'notifications', 'automation_rules', 'automation_runs', 'reward_transactions']

function Settings() {
  const user = useUser()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const del = useServerFn(deleteAccount)
  const [confirmText, setConfirmText] = useState('')

  const prefs = useQuery({
    queryKey: ['user_preferences'],
    queryFn: async () => must(await sb().from('user_preferences').select('*').maybeSingle()) as { memory_enabled: boolean; time_format: string } | null,
  })
  const notif = useQuery({
    queryKey: ['notification_preferences'],
    queryFn: async () => must(await sb().from('notification_preferences').select('*').maybeSingle()) as { in_app: Record<string, boolean>; email: Record<string, boolean> } | null,
  })
  const memories = useQuery({
    queryKey: ['ai_memories'],
    queryFn: async () => must(await sb().from('ai_memories').select('*').order('created_at', { ascending: false })) as { id: string; content: string; category: string; enabled: boolean }[],
  })
  const mem = useTable<{ id: string; content: string; enabled: boolean }>('ai_memories', ['ai_memories'])

  const savePrefs = async (patch: Record<string, unknown>) => {
    const { error } = await sb().from('user_preferences').update(patch).eq('user_id', user.id)
    if (error) return toast.error(error.message)
    qc.invalidateQueries({ queryKey: ['user_preferences'] })
  }
  const saveNotif = async (channel: 'in_app' | 'email', key: string, value: boolean) => {
    const current = notif.data?.[channel] ?? {}
    const { error } = await sb().from('notification_preferences').update({ [channel]: { ...current, [key]: value } }).eq('user_id', user.id)
    if (error) return toast.error(error.message)
    qc.invalidateQueries({ queryKey: ['notification_preferences'] })
  }

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const password = String(f.get('password'))
    if (password.length < 8 || !/[0-9]/.test(password) || !/[A-Za-z]/.test(password)) return toast.error('Use at least 8 characters with a letter and a number.')
    const { error } = await sb().auth.updateUser({ password, current_password: String(f.get('current')) } as { password: string })
    if (error) return toast.error(error.message)
    toast.success('Password changed')
    e.currentTarget.reset()
  }

  async function exportData() {
    const out: Record<string, unknown> = { exported_at: new Date().toISOString(), account: { id: user.id, email: user.email } }
    for (const t of EXPORT_TABLES) out[t] = (await sb().from(t).select('*')).data ?? []
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }))
    a.download = `vincify-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const themeBtn = (t: ThemeChoice, Icon: typeof Sun, label: string) => (
    <button
      type="button"
      aria-pressed={theme === t}
      onClick={() => {
        setTheme(t)
        savePrefs({ theme: t })
      }}
      className={cn('flex flex-1 flex-col items-center gap-2 rounded-xl border p-4 text-sm', theme === t ? 'border-primary bg-accent text-accent-foreground' : 'hover:border-primary/40')}
    >
      <Icon className="size-5" /> {label}
    </button>
  )

  return (
    <div className="mx-auto max-w-reading space-y-6">
      <PageHeader title="Settings" description="Appearance, notifications, AI memory, security and your data." />
      <Panel title="Appearance">
        <div className="flex gap-3">
          {themeBtn('light', Sun, 'Light')}
          {themeBtn('dark', Moon, 'Dark')}
          {themeBtn('system', Monitor, 'System')}
        </div>
      </Panel>

      <Panel title="Notifications">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 gap-y-3 text-sm">
          <span />
          <span className="text-xs text-muted-foreground">In app</span>
          <span className="text-xs text-muted-foreground">Email</span>
          {CATEGORIES.map((c) => (
            <div key={c} className="contents">
              <span>{CAT_LABEL[c]}</span>
              <Switch checked={notif.data?.in_app[c] ?? true} onCheckedChange={(v) => saveNotif('in_app', c, v)} aria-label={`${CAT_LABEL[c]} in app`} />
              <Switch checked={notif.data?.email[c] ?? false} onCheckedChange={(v) => saveNotif('email', c, v)} aria-label={`${CAT_LABEL[c]} by email`} />
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="AI memory"
        action={
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Learn from chats</span>
            <Switch checked={prefs.data?.memory_enabled ?? true} onCheckedChange={(v) => savePrefs({ memory_enabled: v })} aria-label="Enable AI memory" />
          </div>
        }
      >
        <p className="mb-4 text-sm text-muted-foreground">Vincify AI only uses memories that are switched on. Edit or delete anything at any time.</p>
        {!memories.data?.length ? (
          <Empty icon={Brain} title="Nothing remembered yet" />
        ) : (
          <ul className="divide-y">
            {memories.data.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2.5">
                <Switch checked={m.enabled} onCheckedChange={(enabled) => mem.update.mutate({ id: m.id, patch: { enabled } })} aria-label="Use this memory" />
                <input
                  defaultValue={m.content}
                  maxLength={500}
                  aria-label="Memory"
                  onBlur={(e) => e.target.value.trim() && e.target.value !== m.content && mem.update.mutate({ id: m.id, patch: { content: e.target.value.trim() } })}
                  className={cn('h-8 min-w-0 flex-1 rounded-md bg-transparent px-1.5 text-sm outline-none focus:bg-muted', !m.enabled && 'text-muted-foreground')}
                />
                <span className="hidden text-xs text-muted-foreground capitalize sm:inline">{m.category}</span>
                <Button variant="ghost" size="icon-xs" aria-label="Delete memory" onClick={() => mem.remove.mutate(m.id)}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Change password">
        <form onSubmit={changePassword} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="current">Current password</Label>
            <Input id="current" name="current" type="password" autoComplete="current-password" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newpw">New password</Label>
            <Input id="newpw" name="password" type="password" autoComplete="new-password" />
          </div>
          <Button type="submit" variant="outline">
            Update
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">Signed in with Google and no password yet? Use Forgot password on the sign-in page to set one.</p>
      </Panel>

      <Panel title="Your data">
        <Button variant="outline" onClick={exportData}>
          <Download /> Export all my data
        </Button>
        <div className="mt-6 rounded-xl border border-destructive/40 p-4">
          <p className="text-sm font-medium text-destructive">Delete account</p>
          <p className="mt-1 text-sm text-muted-foreground">This permanently deletes your account, files and every record. Type DELETE to confirm.</p>
          <div className="mt-3 flex gap-2">
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} aria-label="Type DELETE" className="max-w-40" />
            <Button
              variant="destructive"
              disabled={confirmText !== 'DELETE'}
              onClick={async () => {
                try {
                  await del({ data: { confirm: 'DELETE' } })
                  await sb().auth.signOut()
                  navigate({ to: '/', replace: true })
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Could not delete account')
                }
              }}
            >
              Delete permanently
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  )
}
