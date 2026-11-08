import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Bookmark, ChartNoAxesCombined, Check, Download, History, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Empty, PageHeader, Panel, Stat } from '@/components/app/page'
import { statusLabel } from '@/components/app/task-meta'
import { useUser } from '@/lib/auth'
import { addDays, startOfDay } from '@/lib/dates'
import { MIN_TREND_DAYS, dayKey, taskStats } from '@/lib/metrics'
import { useTasks } from '@/lib/queries'
import { must, sb } from '@/lib/supabase'
import type { SavedReport, TaskStatus } from '@/lib/types'

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
  const queryClient = useQueryClient()
  const tasks = useTasks()
  const [period, setPeriod] = useState<Period>('week')
  const end = addDays(startOfDay(), 1)
  const start = addDays(end, -DAYS[period])

  const checkins = useQuery({
    queryKey: ['checkins', 'report', period],
    queryFn: async () =>
      must(
        await sb()
          .from('daily_checkins')
          .select('day,mood,energy,reviewed_at')
          .gte('day', start.toISOString().slice(0, 10)),
      ) as {
        day: string
        mood: number | null
        energy: number | null
        reviewed_at: string | null
      }[],
  })

  // Saved snapshots from reports table
  const savedReports = useQuery({
    queryKey: ['saved_reports'],
    queryFn: async () => {
      const res = await sb().from('reports').select('*').order('created_at', { ascending: false })
      return must(res) as SavedReport[]
    },
  })

  const saveSnapshot = useMutation({
    mutationFn: async () => {
      const pStart = start.toISOString().slice(0, 10)
      const pEnd = end.toISOString().slice(0, 10)
      const reportPeriod = period === 'quarter' ? 'monthly' : period
      const payload = {
        user_id: user.id,
        period: reportPeriod,
        period_start: pStart,
        period_end: pEnd,
        data: {
          period,
          stats: data.stats,
          activeDays: data.activeDays,
          series: data.series,
          categories: data.categories,
          avgMood: avg('mood'),
          avgEnergy: avg('energy'),
          totalTasks: data.inPeriod.length,
          generatedAt: new Date().toISOString(),
        },
        narrative: `Productivity snapshot for ${pStart} to ${pEnd}. Completion rate: ${data.stats.completionRate ?? 0}%.`,
      }
      return must(await sb().from('reports').upsert(payload, { onConflict: 'user_id,period,period_start' }))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved_reports'] })
      toast.success('Report snapshot saved successfully')
    },
    onError: (err: any) => toast.error(err.message || 'Could not save report snapshot'),
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
    for (const t of all)
      if (t.completed_at && new Date(t.completed_at) >= start)
        byDay.set(dayKey(t.completed_at, user.timezone), (byDay.get(dayKey(t.completed_at, user.timezone)) ?? 0) + 1)
    const series = Array.from({ length: DAYS[period] }, (_, i) => {
      const d = addDays(start, i)
      const k = dayKey(d, user.timezone)
      return {
        day: d.toLocaleDateString([], period === 'week' ? { weekday: 'short' } : { day: 'numeric', month: 'short' }),
        completed: byDay.get(k) ?? 0,
      }
    })
    const statusMix = (Object.keys(statusLabel) as TaskStatus[])
      .map((s) => ({ name: statusLabel[s], key: s, value: inPeriod.filter((t) => t.status === s).length }))
      .filter((x) => x.value)
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
    return {
      inPeriod,
      stats,
      prevStats,
      series,
      statusMix,
      categories: [...categories.entries()].sort((a, b) => b[1].total - a[1].total),
      activeDays,
    }
  }, [tasks.data, period, user.timezone])

  const ci = checkins.data ?? []
  const avg = (k: 'mood' | 'energy') => {
    const v = ci.map((c) => c[k]).filter((x): x is number => x != null)
    return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : null
  }
  const delta =
    data.stats.completionRate != null && data.prevStats.completionRate != null
      ? Math.round((data.stats.completionRate - data.prevStats.completionRate) * 10) / 10
      : null

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

  const savedList = savedReports.data ?? []

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Reports & Analytics"
        description="Review productivity trends, task completion velocity and save periodic snapshots."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => saveSnapshot.mutate()} disabled={saveSnapshot.isPending}>
              <Bookmark className="size-4 mr-1.5" />
              Save Snapshot
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="size-4 mr-1.5" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="size-4 mr-1.5" />
              Print
            </Button>
          </div>
        }
      />

      <div className="flex items-center justify-between">
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList>
            <TabsTrigger value="week">Last 7 Days</TabsTrigger>
            <TabsTrigger value="month">Last 30 Days</TabsTrigger>
            <TabsTrigger value="quarter">Last 90 Days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Completed Tasks" value={data.stats.completed} />
        <Stat
          label="Completion Rate"
          value={data.stats.completionRate != null ? `${data.stats.completionRate}%` : 'N/A'}
          hint={delta != null ? `${delta >= 0 ? '+' : ''}${delta}% vs previous period` : undefined}
        />
        <Stat label="Active Days" value={`${data.activeDays} / ${DAYS[period]}`} />
        <Stat label="Avg Mood" value={avg('mood') ? `${avg('mood')} / 5` : 'N/A'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Completion Velocity" description="Tasks finished day by day">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.series}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="day" fontSize={11} tickLine={false} />
                <YAxis allowDecimals={false} fontSize={11} tickLine={false} />
                <Tooltip />
                <Bar dataKey="completed" fill="var(--brand-purple)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Task Status Distribution" description="Current balance across workflow states">
          <div className="h-64 w-full">
            {data.statusMix.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">No tasks in this period</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.statusMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {data.statusMix.map((entry) => (
                      <Cell key={entry.key} fill={STATUS_COLOR[entry.key] || 'var(--border)'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>
      </div>

      {/* Saved Snapshots Section */}
      <Panel title="Saved Snapshots" description="Archived historical reports saved for future review">
        {savedList.length === 0 ? (
          <Empty
            icon={History}
            title="No snapshots saved yet"
            description="Click 'Save Snapshot' above to store permanent weekly or monthly summaries."
          />
        ) : (
          <div className="divide-y">
            {savedList.map((rep) => (
              <div key={rep.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm capitalize">{rep.period} Report</span>
                    <span className="text-xs text-muted-foreground">
                      ({rep.period_start} to {rep.period_end})
                    </span>
                  </div>
                  {rep.narrative && <p className="text-xs text-muted-foreground mt-0.5">{rep.narrative}</p>}
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  Saved {new Date(rep.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
