import { useMemo } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, CircleCheckBig, FolderKanban, Plus, SunMedium, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Empty, LoadingRows, Panel, Stat } from '@/components/app/page'
import { NewTaskDialog } from '@/components/app/new-task-dialog'
import { PriorityBadge, TaskCheck, priorityRank } from '@/components/app/task-meta'
import { useUser } from '@/lib/auth'
import { addDays, formatDue, greeting, localDateKey, startOfDay, startOfWeek } from '@/lib/dates'
import { isOverdue, streak, taskStats } from '@/lib/metrics'
import { useEvents, useGoals, useProjects, useTaskMutations, useTasks } from '@/lib/queries'
import { must, sb } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/app/')({
  head: () => ({ meta: [{ title: 'Home - Vincify' }] }),
  component: Home,
})

function Home() {
  const user = useUser()
  const tasks = useTasks()
  const projects = useProjects()
  const goals = useGoals()
  const today = useMemo(() => startOfDay(), [])
  const events = useEvents(today, addDays(today, 7))
  const { toggle } = useTaskMutations()
  const checkins = useQuery({
    queryKey: ['checkins', 'recent'],
    queryFn: async () =>
      must(await sb().from('daily_checkins').select('day,priorities,intention,reviewed_at').order('day', { ascending: false }).limit(60)) as {
        day: string
        priorities: string[]
        intention: string | null
        reviewed_at: string | null
      }[],
  })

  const all = tasks.data ?? []
  const todayKey = localDateKey()
  const tomorrow = addDays(today, 1)
  const todayTasks = all
    .filter((t) => t.status !== 'cancelled' && (isOverdue(t) || (t.due_at && new Date(t.due_at) < tomorrow) || t.status === 'in_progress'))
    .filter((t) => t.status !== 'completed' || (t.completed_at && new Date(t.completed_at) >= today))
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])
    .slice(0, 8)
  const weekStart = startOfWeek()
  const week = taskStats(all.filter((t) => t.due_at && new Date(t.due_at) >= weekStart && new Date(t.due_at) < addDays(weekStart, 7)))
  const overall = taskStats(all)
  const todayCheckin = checkins.data?.find((c) => c.day === todayKey)
  const checkinStreak = streak(new Set((checkins.data ?? []).map((c) => c.day)), todayKey)

  const projectProgress = (id: string) => {
    const s = taskStats(all.filter((t) => t.project_id === id))
    return { rate: s.completionRate, count: s.eligible }
  }

  return (
    <div className="mx-auto max-w-content space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{today.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
            {greeting()}, {user.preferredName}
          </h1>
        </div>
        <NewTaskDialog>
          {(open) => (
            <Button variant="brand" onClick={open}>
              <Plus /> <span className="hidden sm:inline">New task</span>
            </Button>
          )}
        </NewTaskDialog>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Due today or overdue" value={todayTasks.filter((t) => t.status !== 'completed').length} />
        <Stat
          label="Completion this week"
          value={week.completionRate == null ? 'No data' : `${week.completionRate}%`}
          hint={week.eligible ? `${week.completed} of ${week.eligible} tasks due this week` : 'No tasks due this week'}
        />
        <Stat label="Overdue" value={overall.overdue} hint={overall.overdue ? 'Needs attention' : 'All on track'} />
        <Stat label="Check-in streak" value={`${checkinStreak} day${checkinStreak === 1 ? '' : 's'}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel
          title="Today"
          className="lg:col-span-2"
          action={
            <Link to="/app/tasks" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              All tasks <ArrowRight className="size-3" />
            </Link>
          }
        >
          {tasks.isLoading ? (
            <LoadingRows />
          ) : todayTasks.length === 0 ? (
            <Empty icon={CircleCheckBig} title="Nothing due today" body="Add a task or plan your day in the check-in." />
          ) : (
            <ul className="divide-y">
              {todayTasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <TaskCheck checked={t.status === 'completed'} onToggle={() => toggle(t)} label={`Complete ${t.title}`} />
                  <span className={cn('min-w-0 flex-1 truncate text-sm', t.status === 'completed' && 'text-muted-foreground line-through')}>
                    {t.title}
                  </span>
                  <span className={cn('hidden text-xs sm:inline', isOverdue(t) ? 'text-destructive' : 'text-muted-foreground')}>
                    {formatDue(t.due_at)}
                  </span>
                  <PriorityBadge priority={t.priority} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Daily check-in">
          {todayCheckin ? (
            <div className="space-y-3">
              {todayCheckin.intention && <p className="text-sm">{todayCheckin.intention}</p>}
              <ol className="space-y-1.5 text-sm text-muted-foreground">
                {todayCheckin.priorities.filter(Boolean).map((p, i) => (
                  <li key={i}>
                    {i + 1}. {p}
                  </li>
                ))}
              </ol>
              <Button asChild size="sm" variant="outline" className="w-full">
                <Link to="/app/check-in">{todayCheckin.reviewed_at ? 'View today' : 'End-of-day review'}</Link>
              </Button>
            </div>
          ) : (
            <Empty
              icon={SunMedium}
              title="Plan your day"
              body="Set an intention and your top three priorities."
              action={
                <Button asChild size="sm" variant="brand">
                  <Link to="/app/check-in">Start check-in</Link>
                </Button>
              }
            />
          )}
        </Panel>

        <Panel title="Next 7 days" action={<Link to="/app/calendar" className="text-xs font-medium text-primary hover:underline">Calendar</Link>}>
          {events.isLoading ? (
            <LoadingRows rows={2} />
          ) : !events.data?.length ? (
            <Empty icon={CalendarDays} title="No upcoming events" />
          ) : (
            <ul className="space-y-2.5">
              {events.data.slice(0, 6).map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="w-14 shrink-0 text-xs text-muted-foreground">
                    {new Date(e.starts_at).toLocaleDateString([], { weekday: 'short' })}
                    <br />
                    {e.all_day ? 'All day' : new Date(e.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="min-w-0 truncate text-sm">{e.title}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Active projects" action={<Link to="/app/projects" className="text-xs font-medium text-primary hover:underline">Projects</Link>}>
          {projects.isLoading ? (
            <LoadingRows rows={2} />
          ) : !projects.data?.filter((p) => p.status === 'active').length ? (
            <Empty icon={FolderKanban} title="No active projects" />
          ) : (
            <ul className="space-y-3">
              {projects.data
                .filter((p) => p.status === 'active')
                .slice(0, 4)
                .map((p) => {
                  const pr = projectProgress(p.id)
                  return (
                    <li key={p.id}>
                      <Link to="/app/projects/$projectId" params={{ projectId: p.id }} className="block space-y-1.5 hover:opacity-90">
                        <div className="flex justify-between text-sm">
                          <span className="truncate font-medium">{p.name}</span>
                          <span className="text-xs text-muted-foreground">{pr.rate == null ? 'No tasks' : `${Math.round(pr.rate)}%`}</span>
                        </div>
                        <Progress value={pr.rate ?? 0} className="h-1.5" />
                      </Link>
                    </li>
                  )
                })}
            </ul>
          )}
        </Panel>

        <Panel title="Goals" action={<Link to="/app/check-in" className="text-xs font-medium text-primary hover:underline">Manage</Link>}>
          {goals.isLoading ? (
            <LoadingRows rows={2} />
          ) : !goals.data?.filter((g) => !g.achieved_at).length ? (
            <Empty icon={Target} title="No open goals" body="Set goals in your weekly or monthly plan." />
          ) : (
            <ul className="space-y-3">
              {goals.data
                .filter((g) => !g.achieved_at)
                .slice(0, 4)
                .map((g) => (
                  <li key={g.id} className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="truncate">{g.title}</span>
                      <span className="text-xs text-muted-foreground">{g.progress}%</span>
                    </div>
                    <Progress value={g.progress} className="h-1.5" />
                  </li>
                ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}
