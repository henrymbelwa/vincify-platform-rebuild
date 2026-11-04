import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import { Loader2, Mail, Plus, Send, Trash2, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Empty, PageHeader, Panel } from '@/components/app/page'
import { selectClass } from '@/components/app/new-task-dialog'
import { sendDigestNow } from '@/lib/api.functions'
import { useUser } from '@/lib/auth'
import { WEEKDAYS } from '@/lib/dates'
import { useTable } from '@/lib/queries'
import { must, sb } from '@/lib/supabase'

export const Route = createFileRoute('/app/automations')({
  head: () => ({ meta: [{ title: 'Automations - Vincify' }] }),
  component: Automations,
})

const TRIGGERS = {
  daily_summary: { name: 'Daily summary', body: 'What you completed yesterday and what is next.' },
  weekly_report: { name: 'Weekly report', body: 'Your last 7 days of completed work and upcoming tasks.' },
  overdue_tasks: { name: 'Overdue alert', body: 'Sent only when you have overdue tasks.' },
  upcoming_events: { name: 'Next 24 hours', body: 'Your upcoming events, sent only when there are any.' },
} as const
type Trigger = keyof typeof TRIGGERS

interface Rule {
  id: string
  name: string
  trigger: Trigger
  send_hour: number
  weekday: number | null
  enabled: boolean
  last_run_at: string | null
}

function Automations() {
  const user = useUser()
  const qc = useQueryClient()
  const run = useServerFn(sendDigestNow)
  const [sending, setSending] = useState<string | null>(null)
  const rules = useQuery({
    queryKey: ['automation_rules'],
    queryFn: async () => must(await sb().from('automation_rules').select('*').order('created_at')) as Rule[],
  })
  const runs = useQuery({
    queryKey: ['automation_runs'],
    queryFn: async () =>
      must(await sb().from('automation_runs').select('id,status,detail,created_at,rule_id').order('created_at', { ascending: false }).limit(25)) as {
        id: string
        status: string
        detail: string | null
        created_at: string
        rule_id: string | null
      }[],
  })
  const t = useTable<Rule>('automation_rules', ['automation_rules'])

  async function sendNow(r: Rule) {
    setSending(r.id)
    try {
      const res = await run({ data: { ruleId: r.id } })
      if (res.status === 'sent') toast.success(res.detail)
      else if (res.status === 'skipped') toast.info(res.detail)
      else toast.error(res.detail)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delivery failed')
    } finally {
      setSending(null)
      qc.invalidateQueries({ queryKey: ['automation_runs'] })
      qc.invalidateQueries({ queryKey: ['automation_rules'] })
    }
  }

  return (
    <div className="mx-auto max-w-content space-y-6">
      <PageHeader title="Automations" description={`Emails are delivered to ${user.email} at the hour you choose, in ${user.timezone}.`} />
      <Panel
        title="Add an automation"
        action={<span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Mail className="size-3.5" /> Email channel</span>}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(TRIGGERS) as Trigger[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => t.insert.mutate({ name: TRIGGERS[k].name, trigger: k, send_hour: 7, weekday: k === 'weekly_report' ? 1 : null }, { onSuccess: () => toast.success(`${TRIGGERS[k].name} added`) })}
              className="rounded-xl border bg-background p-4 text-left transition-colors hover:border-primary/40"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Plus className="size-4 text-primary" /> {TRIGGERS[k].name}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">{TRIGGERS[k].body}</span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Your automations">
        {!rules.data?.length ? (
          <Empty icon={Workflow} title="No automations yet" body="Add one above. Nothing is sent until you enable a rule." />
        ) : (
          <ul className="divide-y">
            {rules.data.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                <Switch checked={r.enabled} onCheckedChange={(enabled) => t.update.mutate({ id: r.id, patch: { enabled } })} aria-label={`Enable ${r.name}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.last_run_at ? `Last run ${new Date(r.last_run_at).toLocaleString()}` : 'Not run yet'}</p>
                </div>
                {r.trigger === 'weekly_report' && (
                  <select aria-label="Day" className={`${selectClass} w-32`} value={r.weekday ?? 1} onChange={(e) => t.update.mutate({ id: r.id, patch: { weekday: Number(e.target.value) } })}>
                    {WEEKDAYS.map((d, i) => (
                      <option key={d} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                )}
                <select aria-label="Hour" className={`${selectClass} w-24`} value={r.send_hour} onChange={(e) => t.update.mutate({ id: r.id, patch: { send_hour: Number(e.target.value) } })}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
                <Button size="sm" variant="outline" disabled={sending === r.id} onClick={() => sendNow(r)}>
                  {sending === r.id ? <Loader2 className="animate-spin" /> : <Send />} Send now
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label={`Delete ${r.name}`} onClick={() => t.remove.mutate(r.id)}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Delivery history">
        {!runs.data?.length ? (
          <p className="text-sm text-muted-foreground">No deliveries yet.</p>
        ) : (
          <ul className="divide-y text-sm">
            {runs.data.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium capitalize ${r.status === 'sent' ? 'bg-success/15 text-success' : r.status === 'failed' ? 'bg-destructive/12 text-destructive' : 'bg-muted text-muted-foreground'}`}
                >
                  {r.status}
                </span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{r.detail}</span>
                <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
