import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartNoAxesCombined, Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Empty, PageHeader, Panel, Stat } from '@/components/app/page'
import { statusLabel } from '@/components/app/task-meta'
import { useUser } from '@/lib/auth'
import { addDays, startOfDay } from '@/lib/dates'
import { MIN_TREND_DAYS, dayKey, taskStats } from '@/lib/metrics'
import { useTasks } from '@/lib/queries'
import { must, sb } from '@/lib/supabase'
import type { TaskStatus } from '@/lib/types'

export const Route = createFileRoute('/app/reports')({
  head: () => ({ meta: [{ title: 'Reports & Analytics - Vincify' }] }),
  component: Reports,
})

type Period = 'week' | 'month' | 'quarter'
const DAYS: Record<Period, number> = { week: 7, month: 30, quarter: 90 }
const STATUS_COLOR: Record<TaskStatus, string> = {
  completed: 'var(--success)',
  in_progress: 'var(--brand-purple)',
  not_started: 'var(--muted-foreground)',
  postponed: 'var(--warning)',
  cancelled: 'var(--border)',
}

function Reports() {
  const user = useUser()
  const tasks = useTasks()
  const [period, setPeriod] = useState<Period>('week')
  const end = addDays(startOfDay(), 1)
  const start = addDays(end, -DAYS[period])
  const checkins = useQuery({
    queryKey: ['checkins', 'report', period],
    queryFn: async () => must(await sb().from('daily_checkins').select('day,mood,energy,reviewed_at').gte('day', start.toISOString().slice(0, 10))) as {
      day: string
      mood: number | null
      energy: number | null
      reviewed_at: string | null
    }[],
  })

  const data = useMemo(() => {
    const all = tasks.data ?? []
    const inPeriod = all.filter((t) => {
      const ref = t.due_at ?? t.created_at
      return new Date(ref) >= start && new Date(ref) < end
    })
    const stats = taskStats(inPeriod)
    const prevStats = taskStats(
      all.filter((t) => {
        const ref = new Date(t.due_at ?? t.created_at)
        return ref >= addDays(start, -DAYS[period]) && ref < start
      }),
    )
    const byDay = new Map<string, number>()
    for (const t of all) if (t.completed_at && new Date(t.completed_at) >= start) byDay.set(dayKey(t.completed_at, user.timezone), (byDay.get(dayKey(t.completed_at, user.timezone)) ?? 0) + 1)
    const series = Array.from({ length: DAYS[period] }, (_, i) => {
      const d = addDays(start, i)
      const k = dayKey(d, user.timezone)
      return { day: d.toLocaleDateString([], period === 'week' ? { weekday: 'short' } : { day: 'numeric', month: 'short' }), completed: byDay.get(k) ?? 0 }
    })
    const statusMix = (Object.keys(statusLabel) as TaskStatus[]).map((s) => ({ name: statusLabel[s], key: s, value: inPeriod.filter((t) => t.status === s).length })).filter((x) => x.value)
    const categories = new Map<string, { done: number; total: number }>()
    for (const t of inPeriod) {
      if (t.status === 'cancelled') continue
      const c = t.category || 'Uncategorised'
      const v = categories.get(c) ?? { done: 0, total: 0 }
      v.total++
      if (t.status === 'completed') v.done++
      categories.set(c, v)
    }
    const activeDays = new Set([...byDay.keys()]).size
    return { inPeriod, stats, prevStats, series, statusMix, categories: [...categories.entries()].sort((a, b) => b[1].total - a[1].total), activeDays }
  }, [tasks.data, period, user.timezone]) // eslint-disable-line react-hooks/exhaustive-deps

  const ci = checkins.data ?? []
  const avg = (k: 'mood' | 'energy') => {
    const v = ci.map((c) => c[k]).filter((x): x is number => x != null)
    return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : null
  }
  const delta =
    data.stats.completionRate != null && data.prevStats.completionRate != null ? Math.round((data.stats.completionRate - data.prevStats.completionRate) * 10) / 10 : null

  function exportCsv() {
    const rows = [['title', 'status', 'priority', 'category', 'due_at', 'completed_at']]
    for (const t of data.inPeriod) rows.push([t.title, t.status, t.priority, t.category ?? '', t.due_at ?? '', t.completed_at ?? ''])
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `vincify-report-${period}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const enough = data.activeDays >= MIN_TREND_DAYS

  return (
    <div className="mx-auto max-w-content space-y-6 print:max-w-none">
      <PageHeader
        title="Reports & Analytics"
        description="Calculated only from your real records. Cancelled tasks never count as completed."
        actions={
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data.inPeriod.length}>
              <Download /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer /> PDF
            </Button>
          </div>
        }
      />
      <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)} className="print:hidden">
        <TabsList>
          <TabsTrigger value="week">Last 7 days</TabsTrigger>
          <TabsTrigger value="month">Last 30 days</TabsTrigger>
          <TabsTrigger value="quarter">Last 90 days</TabsTrigger>
        </TabsList>
      </Tabs>

      {!data.inPeriod.length && !ci.length ? (
        <Empty icon={ChartNoAxesCombined} title="Not enough data yet" body="Reports appear as you create and complete tasks and do daily check-ins." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Completion rate"
              value={data.stats.completionRate == null ? 'No data' : `${data.stats.completionRate}%`}
              hint={delta == null ? 'No previous period to compare' : `${delta >= 0 ? '+' : ''}${delta} pts vs previous period`}
            />
            <Stat label="Completed" value={data.stats.completed} hint={`of ${data.stats.eligible} eligible tasks`} />
            <Stat label="Overdue" value={data.stats.overdue} hint={`${data.stats.postponed} postponed, ${data.stats.cancelled} cancelled`} />
            <Stat label="Check-ins" value={ci.length} hint={avg('mood') ? `Avg mood ${avg('mood')}/5, energy ${avg('energy')}/5` : 'No mood data'} />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <Panel title="Tasks completed per day" className="lg:col-span-2">
              {enough ? (
                <div className="h-64">
                  <ResponsiveContainer>
                    <BarChart data={data.series}>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" interval="preserveStartEnd" />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={24} stroke="var(--muted-foreground)" />
                      <Tooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="completed" fill="var(--brand-purple)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Trends appear after tasks are completed on at least {MIN_TREND_DAYS} different days. So far: {data.activeDays}.
                </p>
              )}
            </Panel>
            <Panel title="Status mix">
              {data.statusMix.length ? (
                <>
                  <div className="h-44">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={data.statusMix} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                          {data.statusMix.map((s) => (
                            <Cell key={s.key} fill={STATUS_COLOR[s.key]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-2 space-y-1 text-xs">
                    {data.statusMix.map((s) => (
                      <li key={s.key} className="flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ background: STATUS_COLOR[s.key] }} />
                        <span className="flex-1">{s.name}</span>
                        <span className="text-muted-foreground">{s.value}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No tasks in this period.</p>
              )}
            </Panel>
          </div>
          <Panel title="By category">
            {!data.categories.length ? (
              <p className="text-sm text-muted-foreground">No categorised tasks in this period.</p>
            ) : (
              <ul className="space-y-3">
                {data.categories.map(([name, v]) => (
                  <li key={name}>
                    <div className="flex justify-between text-sm">
                      <span>{name}</span>
                      <span className="text-muted-foreground">
                        {v.done}/{v.total} ({Math.round((v.done / v.total) * 100)}%)
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${(v.done / v.total) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  )
}
