import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowUpRight,
  BellRing,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FolderPlus,
  Lightbulb,
  MapPin,
  Plus,
  Sparkles,
  SunMedium,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react'
import { PriorityBadge, TaskCheck } from '@/components/app/task-meta'
import { NewTaskDialog } from '@/components/app/new-task-dialog'
import { Progress } from '@/components/ui/progress'
import {
  events,
  goals,
  insights,
  projects,
  reminders,
  type CalendarEvent,
  type Task,
  type TaskStatus,
} from '@/lib/fixtures'
import { addDays, formatDue } from '@/lib/dates'
import { useWorkspace } from '@/lib/workspace'
import { cn } from '@/lib/utils'

export function Panel({
  title,
  icon,
  action,
  children,
  className,
}: {
  title: string
  icon?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      aria-label={title}
      className={cn('shadow-soft rounded-2xl border bg-card', className)}
    >
      <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          {icon}
          {title}
        </h2>
        {action}
      </header>
      <div className="px-5 pb-5">{children}</div>
    </section>
  )
}

const groupOrder: { key: string; label: string; match: (s: TaskStatus) => boolean; tone: string }[] = [
  { key: 'progress', label: 'In progress', match: (s) => s === 'in_progress', tone: 'bg-violet-50 text-violet-700' },
  { key: 'todo', label: 'To do', match: (s) => s === 'not_started' || s === 'postponed', tone: 'bg-sky-50 text-sky-700' },
  { key: 'done', label: 'Completed', match: (s) => s === 'completed', tone: 'bg-emerald-50 text-emerald-700' },
]

function TaskRow({ task }: { task: Task }) {
  const { toggleTask } = useWorkspace()
  const done = task.status === 'completed'
  const overdue = task.dueInDays < 0 && !done
  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/60 sm:grid-cols-[auto_1fr_5rem_7rem]">
      <TaskCheck checked={done} onToggle={() => toggleTask(task.id)} label={`Mark “${task.title}” ${done ? 'incomplete' : 'complete'}`} />
      <div className="min-w-0">
        <p className={cn('truncate text-sm font-medium', done && 'text-muted-foreground line-through')}>{task.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {task.category}
          {task.project ? ` · ${task.project}` : ''}
        </p>
      </div>
      <PriorityBadge priority={task.priority} className="hidden justify-self-start sm:inline-flex" />
      <span className={cn('text-right text-xs', overdue ? 'font-medium text-rose-600' : 'text-muted-foreground')}>
        {formatDue(task.dueInDays)}
      </span>
    </li>
  )
}

export function TasksPanel() {
  const { tasks } = useWorkspace()
  const [closed, setClosed] = useState<Record<string, boolean>>({ done: true })
  const active = tasks.filter((t) => t.status !== 'cancelled')

  return (
    <Panel
      title="My Tasks"
      icon={<span className="size-2 rounded-full bg-brand-gradient" />}
      action={
        <div className="flex items-center gap-1">
          <NewTaskDialog>
            {(open) => (
              <button type="button" onClick={open} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-brand-deep hover:bg-accent">
                <Plus className="size-3.5" /> Add task
              </button>
            )}
          </NewTaskDialog>
          <Link to="/app/tasks" className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
            View all <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      }
    >
      <div className="hidden grid-cols-[auto_1fr_5rem_7rem] gap-3 px-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase sm:grid">
        <span className="w-[18px]" />
        <span>Name</span>
        <span>Priority</span>
        <span className="text-right">Due</span>
      </div>
      <div className="space-y-2">
        {groupOrder.map((g) => {
          const items = active.filter((t) => g.match(t.status))
          const isClosed = closed[g.key]
          return (
            <div key={g.key}>
              <button
                type="button"
                aria-expanded={!isClosed}
                onClick={() => setClosed((c) => ({ ...c, [g.key]: !c[g.key] }))}
                className="flex items-center gap-2 rounded-md px-1 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className={cn('size-3.5 transition-transform motion-reduce:transition-none', isClosed && '-rotate-90')} />
                <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase', g.tone)}>{g.label}</span>
                <span>{items.length} {items.length === 1 ? 'task' : 'tasks'}</span>
              </button>
              {!isClosed && (
                <ul className="mt-0.5">
                  {items.length === 0 ? (
                    <li className="px-2 py-2 text-xs text-muted-foreground">Nothing here right now.</li>
                  ) : (
                    items.map((t) => <TaskRow key={t.id} task={t} />)
                  )}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

const statusText = {
  on_track: { label: 'On track', cls: 'text-emerald-700 bg-emerald-50' },
  at_risk: { label: 'At risk', cls: 'text-amber-700 bg-amber-50' },
  planning: { label: 'Planning', cls: 'text-sky-700 bg-sky-50' },
  completed: { label: 'Completed', cls: 'text-slate-600 bg-slate-100' },
} as const

export function ProjectsPanel() {
  return (
    <Panel
      title="Projects"
      action={
        <Link to="/app/$section" params={{ section: 'projects' }} className="text-xs font-medium text-muted-foreground hover:text-foreground">
          See all
        </Link>
      }
    >
      <ul className="space-y-3">
        <li>
          <Link
            to="/app/$section"
            params={{ section: 'projects' }}
            className="flex items-center gap-3 rounded-xl border border-dashed p-3 text-sm font-medium text-muted-foreground hover:border-brand-lilac hover:text-foreground"
          >
            <span className="grid size-9 place-items-center rounded-lg bg-muted">
              <FolderPlus className="size-4" />
            </span>
            Create new project
          </Link>
        </li>
        {projects.map((p) => (
          <li key={p.id} className="rounded-xl border p-3">
            <div className="flex items-start gap-3">
              <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-xs font-bold text-white', p.color)}>
                {p.name.replace(/^.*?: /, '').slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium', statusText[p.status].cls)}>
                    {statusText[p.status].label}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{p.lastActivity}</p>
                <div className="mt-2.5 flex items-center gap-3">
                  <Progress value={p.progress} className="h-1.5 bg-muted [&>[data-slot=progress-indicator]]:bg-brand-gradient" aria-label={`${p.name} progress`} />
                  <span className="text-xs font-medium tabular-nums">{p.progress}%</span>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {p.tasks} tasks · target in {p.targetInDays} days
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

const kindStyles: Record<CalendarEvent['kind'], string> = {
  lecture: 'border-l-violet-500 bg-violet-50/70',
  meeting: 'border-l-pink-500 bg-pink-50/70',
  personal: 'border-l-emerald-500 bg-emerald-50/70',
  deadline: 'border-l-rose-500 bg-rose-50/70',
  milestone: 'border-l-sky-500 bg-sky-50/70',
}

export function CalendarPanel({ today }: { today: Date }) {
  const [start, setStart] = useState(-2)
  const [selected, setSelected] = useState(0)
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => start + i), [start])
  const dayEvents = events.filter((e) => e.dayOffset === selected).sort((a, b) => a.start.localeCompare(b.start))
  const month = addDays(today, selected).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <Panel
      title="Calendar"
      action={<span className="text-xs font-medium text-muted-foreground">{month}</span>}
    >
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Previous days" onClick={() => setStart((s) => s - 7)} className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted">
          <ChevronLeft className="size-4" />
        </button>
        <div className="grid flex-1 grid-cols-7 gap-1">
          {days.map((offset) => {
            const d = addDays(today, offset)
            const isSel = offset === selected
            const has = events.some((e) => e.dayOffset === offset)
            return (
              <button
                key={offset}
                type="button"
                aria-pressed={isSel}
                aria-label={d.toDateString()}
                onClick={() => setSelected(offset)}
                className={cn(
                  'relative flex flex-col items-center rounded-lg py-1.5 text-center transition-colors motion-reduce:transition-none',
                  isSel ? 'bg-brand-gradient text-white shadow-glow' : 'hover:bg-muted',
                )}
              >
                <span className={cn('text-[10px] uppercase', isSel ? 'text-white/80' : 'text-muted-foreground')}>
                  {d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)}
                </span>
                <span className="text-sm font-semibold tabular-nums">{String(d.getDate()).padStart(2, '0')}</span>
                {has && !isSel && <span className="absolute bottom-0.5 size-1 rounded-full bg-brand-purple" />}
                {offset === 0 && !isSel && <span className="sr-only">Today</span>}
              </button>
            )
          })}
        </div>
        <button type="button" aria-label="Next days" onClick={() => setStart((s) => s + 7)} className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <p className="mt-4 mb-2 text-xs font-medium text-muted-foreground">
        {addDays(today, selected).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
      </p>
      {dayEvents.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">No events scheduled — a good day for deep work.</p>
      ) : (
        <ul className="space-y-2">
          {dayEvents.map((e) => (
            <li key={e.id} className={cn('rounded-lg border-l-[3px] px-3 py-2.5', kindStyles[e.kind])}>
              <p className="text-sm font-semibold">{e.title}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Clock className="size-3" />{e.start === e.end ? e.start : `${e.start} – ${e.end}`}</span>
                <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{e.venue}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function GoalsPanel() {
  return (
    <Panel title="My Goals" icon={<TrendingUp className="size-4 text-brand-purple" />}>
      <ul className="space-y-4">
        {goals.map((g) => (
          <li key={g.id}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium">{g.title}</p>
              <span className="text-sm font-semibold tabular-nums">{g.progress}%</span>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">{g.context}</p>
            <Progress value={g.progress} className="h-1.5 bg-muted [&>[data-slot=progress-indicator]]:bg-brand-gradient" aria-label={`${g.title} progress`} />
          </li>
        ))}
      </ul>
    </Panel>
  )
}

export function RemindersPanel() {
  return (
    <Panel title="Reminders" icon={<BellRing className="size-4 text-brand-pink" />}>
      <ul className="divide-y">
        {reminders.map((r) => (
          <li key={r.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', r.urgent ? 'bg-rose-500' : 'bg-slate-300')} />
            <div className="min-w-0">
              <p className="text-sm">{r.title}</p>
              <p className="text-xs text-muted-foreground">{r.when}</p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

export function CheckInPanel() {
  const { checkInDone } = useWorkspace()
  return (
    <section className="relative overflow-hidden rounded-2xl bg-[#17152a] p-5 text-white">
      <div aria-hidden="true" className="absolute -top-16 -right-10 size-48 rounded-full bg-brand-purple/40 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-20 left-10 size-40 rounded-full bg-brand-pink/30 blur-3xl" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <SunMedium className="size-4 text-brand-blush" /> Daily Check-in
          </h2>
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', checkInDone ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/10 text-white/80')}>
            {checkInDone ? 'Planned' : 'Not started'}
          </span>
        </div>
        <p className="mt-2 text-sm text-white/70">
          {checkInDone
            ? 'Your plan for today is set. Review it this evening to close the loop.'
            : "You haven't planned today yet. Two minutes now saves hours later."}
        </p>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-white/60">🔥 6-day planning streak</span>
          <Link to="/app/check-in" className="inline-flex h-8 items-center rounded-lg bg-white px-3 text-xs font-semibold text-[#17152a] hover:bg-white/90">
            {checkInDone ? 'View plan' : "Let's plan your day"}
          </Link>
        </div>
      </div>
    </section>
  )
}

const toneIcon = {
  positive: <TrendingUp className="size-4 text-emerald-600" />,
  attention: <TriangleAlert className="size-4 text-amber-600" />,
  neutral: <Lightbulb className="size-4 text-brand-purple" />,
}

export function InsightsPanel() {
  return (
    <Panel
      title="AI Insights"
      icon={<Sparkles className="size-4 text-brand-purple" />}
      action={
        <Link to="/app/assistant" className="text-xs font-medium text-brand-deep hover:underline">
          Discuss with AI
        </Link>
      }
    >
      <ul className="grid gap-3 md:grid-cols-3">
        {insights.map((i) => (
          <li key={i.id} className="rounded-xl border bg-gradient-to-b from-accent/60 to-transparent p-4">
            <span className="grid size-8 place-items-center rounded-lg bg-white shadow-sm">{toneIcon[i.tone]}</span>
            <p className="mt-3 text-sm font-semibold">{i.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{i.detail}</p>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
