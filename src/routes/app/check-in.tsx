import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Target, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Empty, PageHeader, Panel } from '@/components/app/page'
import { selectClass } from '@/components/app/new-task-dialog'
import { localDateKey, startOfWeek } from '@/lib/dates'
import { keys, useGoals, useTable } from '@/lib/queries'
import { currentUserId, must, sb } from '@/lib/supabase'
import type { Goal } from '@/lib/types'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/app/check-in')({
  head: () => ({ meta: [{ title: 'Daily Check-in - Vincify' }] }),
  component: CheckIn,
})

interface Checkin {
  id: string
  day: string
  mood: number | null
  energy: number | null
  priorities: string[]
  intention: string | null
  review: string | null
  wins: string | null
  blockers: string | null
  reviewed_at: string | null
}

function Scale({ name, value, onChange, label }: { name: string; value: number | null; onChange: (n: number) => void; label: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            name={name}
            aria-pressed={value === n}
            onClick={() => onChange(n)}
            className={cn('size-9 rounded-lg border text-sm', value === n ? 'border-transparent bg-brand-gradient text-white' : 'bg-card hover:border-primary/40')}
          >
            {n}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function CheckIn() {
  const qc = useQueryClient()
  const today = localDateKey()
  const history = useQuery({
    queryKey: ['checkins', 'recent'],
    queryFn: async () => must(await sb().from('daily_checkins').select('*').order('day', { ascending: false }).limit(60)) as Checkin[],
  })
  const current = history.data?.find((c) => c.day === today)
  const [mood, setMood] = useState<number | null>(null)
  const [energy, setEnergy] = useState<number | null>(null)
  useEffect(() => {
    setMood(current?.mood ?? null)
    setEnergy(current?.energy ?? null)
  }, [current?.id, current?.mood, current?.energy])

  async function save(patch: Partial<Checkin>) {
    const res = await sb()
      .from('daily_checkins')
      .upsert({ user_id: await currentUserId(), day: today, ...patch }, { onConflict: 'user_id,day' })
    if (res.error) return toast.error(res.error.message)
    toast.success('Saved')
    qc.invalidateQueries({ queryKey: ['checkins'] })
  }

  function onPlan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    save({
      intention: String(f.get('intention') ?? '').slice(0, 2000) || null,
      priorities: [f.get('p1'), f.get('p2'), f.get('p3')].map((p) => String(p ?? '').trim().slice(0, 200)).filter(Boolean),
      mood,
      energy,
    })
  }
  function onReview(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    save({
      wins: String(f.get('wins') ?? '').slice(0, 2000) || null,
      blockers: String(f.get('blockers') ?? '').slice(0, 2000) || null,
      review: String(f.get('review') ?? '').slice(0, 4000) || null,
      reviewed_at: new Date().toISOString(),
    })
  }

  return (
    <div className="mx-auto max-w-content">
      <PageHeader title="Daily Check-in" description="Plan with intention in the morning, review honestly in the evening." />
      <Tabs defaultValue="today">
        <TabsList className="mb-4">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="grid gap-6 lg:grid-cols-2">
          <Panel title="Morning plan">
            <form key={current?.id ?? 'new'} onSubmit={onPlan} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="intention">Main objective for today</Label>
                <Textarea id="intention" name="intention" rows={2} defaultValue={current?.intention ?? ''} maxLength={2000} />
              </div>
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-1.5">
                  <Label htmlFor={`p${i + 1}`}>Priority {i + 1}</Label>
                  <Input id={`p${i + 1}`} name={`p${i + 1}`} defaultValue={current?.priorities[i] ?? ''} maxLength={200} />
                </div>
              ))}
              <div className="flex flex-wrap gap-6">
                <Scale name="mood" label="Mood" value={mood} onChange={setMood} />
                <Scale name="energy" label="Energy" value={energy} onChange={setEnergy} />
              </div>
              <Button type="submit" variant="brand">
                {current ? 'Update plan' : 'Save plan'}
              </Button>
            </form>
          </Panel>
          <Panel title="End-of-day review">
            <form key={`r-${current?.id ?? 'new'}`} onSubmit={onReview} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="wins">What went well?</Label>
                <Textarea id="wins" name="wins" rows={2} defaultValue={current?.wins ?? ''} maxLength={2000} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="blockers">What got in the way?</Label>
                <Textarea id="blockers" name="blockers" rows={2} defaultValue={current?.blockers ?? ''} maxLength={2000} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="review">Notes for tomorrow</Label>
                <Textarea id="review" name="review" rows={3} defaultValue={current?.review ?? ''} maxLength={4000} />
              </div>
              <Button type="submit" variant="outline">
                {current?.reviewed_at ? 'Update review' : 'Complete review'}
              </Button>
            </form>
          </Panel>
        </TabsContent>

        <TabsContent value="week">
          <PeriodPlan table="weekly_plans" dateCol="week_start" date={localDateKey(startOfWeek())} label="This week" focusCol="focus" />
        </TabsContent>
        <TabsContent value="month">
          <PeriodPlan
            table="monthly_plans"
            dateCol="month"
            date={`${today.slice(0, 7)}-01`}
            label={new Date().toLocaleDateString([], { month: 'long', year: 'numeric' })}
            focusCol="theme"
          />
        </TabsContent>
        <TabsContent value="goals">
          <Goals />
        </TabsContent>
        <TabsContent value="history">
          <Panel>
            {!history.data?.length ? (
              <Empty icon={Target} title="No check-ins yet" />
            ) : (
              <ul className="divide-y">
                {history.data.map((c) => (
                  <li key={c.id} className="py-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{new Date(`${c.day}T12:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.mood ? `Mood ${c.mood}/5` : ''} {c.energy ? `Energy ${c.energy}/5` : ''} {c.reviewed_at ? 'Reviewed' : 'Not reviewed'}
                      </span>
                    </div>
                    {c.intention && <p className="mt-1 text-sm text-muted-foreground">{c.intention}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function PeriodPlan({ table, dateCol, date, label, focusCol }: { table: string; dateCol: string; date: string; label: string; focusCol: string }) {
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: [table, date],
    queryFn: async () => must(await sb().from(table).select('*').eq(dateCol, date).maybeSingle()) as Record<string, string | string[] | null> | null,
  })
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const res = await sb()
      .from(table)
      .upsert(
        {
          user_id: await currentUserId(),
          [dateCol]: date,
          [focusCol]: String(f.get('focus') ?? '').slice(0, 2000) || null,
          outcomes: String(f.get('outcomes') ?? '')
            .split('\n')
            .map((s) => s.trim().slice(0, 200))
            .filter(Boolean)
            .slice(0, 10),
          reflection: String(f.get('reflection') ?? '').slice(0, 4000) || null,
        },
        { onConflict: `user_id,${dateCol}` },
      )
    if (res.error) return toast.error(res.error.message)
    toast.success('Plan saved')
    qc.invalidateQueries({ queryKey: [table] })
  }
  if (q.isLoading) return null
  const d = q.data
  return (
    <Panel title={label}>
      <form key={String(d?.id ?? 'new')} onSubmit={submit} className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${table}-focus`}>Focus</Label>
          <Textarea id={`${table}-focus`} name="focus" rows={3} defaultValue={(d?.[focusCol] as string) ?? ''} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${table}-out`}>Key outcomes (one per line)</Label>
          <Textarea id={`${table}-out`} name="outcomes" rows={3} defaultValue={((d?.outcomes as string[]) ?? []).join('\n')} />
        </div>
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor={`${table}-ref`}>Reflection</Label>
          <Textarea id={`${table}-ref`} name="reflection" rows={3} defaultValue={(d?.reflection as string) ?? ''} />
        </div>
        <div>
          <Button type="submit" variant="brand">
            Save plan
          </Button>
        </div>
      </form>
    </Panel>
  )
}

function Goals() {
  const goals = useGoals()
  const t = useTable<Goal>('goals', keys.goals)
  const [title, setTitle] = useState('')
  const open = useMemo(() => goals.data ?? [], [goals.data])
  return (
    <Panel title="Goals">
      <form
        className="mb-4 grid gap-2 sm:grid-cols-[1fr_10rem_auto]"
        onSubmit={(e) => {
          e.preventDefault()
          const horizon = String(new FormData(e.currentTarget).get('horizon')) as Goal['horizon']
          if (title.trim().length < 2) return
          t.insert.mutate({ title: title.trim().slice(0, 200), horizon }, { onSuccess: () => setTitle('') })
        }}
      >
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New goal" aria-label="Goal title" maxLength={200} />
        <select name="horizon" className={selectClass} aria-label="Horizon" defaultValue="month">
          <option value="week">This week</option>
          <option value="month">This month</option>
          <option value="quarter">This quarter</option>
          <option value="year">This year</option>
        </select>
        <Button type="submit" variant="brand">
          Add goal
        </Button>
      </form>
      {!open.length ? (
        <Empty icon={Target} title="No goals yet" />
      ) : (
        <ul className="divide-y">
          {open.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className={cn('min-w-0 flex-1 text-sm', g.achieved_at && 'text-muted-foreground line-through')}>{g.title}</span>
              <span className="text-xs text-muted-foreground capitalize">{g.horizon}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                defaultValue={g.progress}
                aria-label={`Progress for ${g.title}`}
                className="w-28 accent-primary"
                onMouseUp={(e) => {
                  const progress = Number((e.target as HTMLInputElement).value)
                  t.update.mutate({ id: g.id, patch: { progress, achieved_at: progress === 100 ? new Date().toISOString() : null } })
                }}
                onKeyUp={(e) => {
                  const progress = Number((e.target as HTMLInputElement).value)
                  t.update.mutate({ id: g.id, patch: { progress, achieved_at: progress === 100 ? new Date().toISOString() : null } })
                }}
              />
              <span className="w-10 text-right text-xs">{g.progress}%</span>
              <Button variant="ghost" size="icon-sm" aria-label={`Delete ${g.title}`} onClick={() => t.remove.mutate(g.id)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
