import { useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CircleCheckBig, Plus, Search, Trash2 } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Empty, LoadingRows, PageHeader } from '@/components/app/page'
import { NewTaskDialog, selectClass } from '@/components/app/new-task-dialog'
import { PriorityBadge, StatusPill, TaskCheck, priorityRank, statusLabel } from '@/components/app/task-meta'
import { formatDue, startOfDay } from '@/lib/dates'
import { isOverdue } from '@/lib/metrics'
import { useProjects, useTaskMutations, useTasks } from '@/lib/queries'
import type { Task, TaskStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/app/tasks')({
  validateSearch: z.object({ q: z.string().max(100).optional() }),
  head: () => ({ meta: [{ title: 'My Tasks - Vincify' }] }),
  component: TasksPage,
})

const STATUSES: TaskStatus[] = ['not_started', 'in_progress', 'postponed', 'completed', 'cancelled']

function TasksPage() {
  const { q = '' } = Route.useSearch()
  const navigate = useNavigate()
  const tasks = useTasks()
  const projects = useProjects()
  const { setStatus, toggle, remove } = useTaskMutations()
  const [view, setView] = useState<'list' | 'board' | 'timeline'>('list')
  const [status, setStatusFilter] = useState<'open' | 'all' | TaskStatus>('open')
  const [priority, setPriority] = useState('all')
  const [project, setProject] = useState('all')
  const [sort, setSort] = useState<'due' | 'priority' | 'created'>('due')

  const projectName = useMemo(() => new Map((projects.data ?? []).map((p) => [p.id, p.name])), [projects.data])
  const filtered = useMemo(() => {
    const needle = q.toLowerCase()
    return (tasks.data ?? [])
      .filter((t) => !needle || t.title.toLowerCase().includes(needle) || t.description?.toLowerCase().includes(needle))
      .filter((t) => (status === 'all' ? true : status === 'open' ? !['completed', 'cancelled'].includes(t.status) : t.status === status))
      .filter((t) => priority === 'all' || t.priority === priority)
      .filter((t) => project === 'all' || (project === 'none' ? !t.project_id : t.project_id === project))
      .sort((a, b) =>
        sort === 'priority'
          ? priorityRank[a.priority] - priorityRank[b.priority]
          : sort === 'created'
            ? b.created_at.localeCompare(a.created_at)
            : (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999'),
      )
  }, [tasks.data, q, status, priority, project, sort])

  const row = (t: Task) => (
    <li key={t.id} className="group flex items-center gap-3 px-4 py-3">
      <TaskCheck checked={t.status === 'completed'} onToggle={() => toggle(t)} label={`Complete ${t.title}`} />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium', t.status === 'completed' && 'text-muted-foreground line-through')}>{t.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className={cn(isOverdue(t) && 'text-destructive')}>{formatDue(t.due_at)}</span>
          {t.project_id && <span className="truncate">{projectName.get(t.project_id)}</span>}
          {t.category && <span>{t.category}</span>}
        </p>
      </div>
      <PriorityBadge priority={t.priority} className="hidden sm:inline-flex" />
      <select
        aria-label="Status"
        value={t.status}
        onChange={(e) => setStatus(t.id, e.target.value as TaskStatus)}
        className="hidden h-8 rounded-md border bg-background px-1.5 text-xs md:block"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {statusLabel[s]}
          </option>
        ))}
      </select>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${t.title}`}
        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
        onClick={() => confirm('Delete this task permanently?') && remove.mutate(t.id)}
      >
        <Trash2 />
      </Button>
    </li>
  )

  const timeline = useMemo(() => {
    const groups = new Map<string, Task[]>()
    for (const t of filtered) {
      const key = t.due_at ? startOfDay(new Date(t.due_at)).toISOString() : 'none'
      groups.set(key, [...(groups.get(key) ?? []), t])
    }
    return [...groups.entries()].sort(([a], [b]) => (a === 'none' ? 1 : b === 'none' ? -1 : a.localeCompare(b)))
  }, [filtered])

  return (
    <div className="mx-auto max-w-content">
      <PageHeader
        title="My Tasks"
        description="Everything you are responsible for, in one list."
        actions={
          <NewTaskDialog>
            {(open) => (
              <Button variant="brand" onClick={open}>
                <Plus /> <span className="hidden sm:inline">New task</span>
              </Button>
            )}
          </NewTaskDialog>
        }
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
          <TabsList>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>
        </Tabs>
        <label className="relative flex-1">
          <span className="sr-only">Search tasks</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={q}
            onChange={(e) => navigate({ to: '/app/tasks', search: { q: e.target.value || undefined }, replace: true })}
            placeholder="Search"
            className="h-9 w-full rounded-lg border bg-card pr-3 pl-9 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[34rem]">
          <select aria-label="Status filter" className={selectClass} value={status} onChange={(e) => setStatusFilter(e.target.value as typeof status)}>
            <option value="open">Open</option>
            <option value="all">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel[s]}
              </option>
            ))}
          </select>
          <select aria-label="Priority filter" className={selectClass} value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="all">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select aria-label="Project filter" className={selectClass} value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="all">All projects</option>
            <option value="none">No project</option>
            {projects.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select aria-label="Sort" className={selectClass} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="due">Sort by due date</option>
            <option value="priority">Sort by priority</option>
            <option value="created">Newest first</option>
          </select>
        </div>
      </div>

      {tasks.isLoading ? (
        <LoadingRows rows={5} />
      ) : filtered.length === 0 ? (
        <Empty icon={CircleCheckBig} title={tasks.data?.length ? 'No tasks match these filters' : 'No tasks yet'} body="Create a task to get started." />
      ) : view === 'list' ? (
        <ul className="divide-y rounded-2xl border bg-card shadow-soft">{filtered.map(row)}</ul>
      ) : view === 'board' ? (
        <div className="grid gap-4 overflow-x-auto md:grid-cols-3 xl:grid-cols-5">
          {STATUSES.map((s) => {
            const col = filtered.filter((t) => t.status === s)
            return (
              <div
                key={s}
                className="min-w-60 rounded-2xl border bg-muted/40 p-3"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => setStatus(e.dataTransfer.getData('text/plain'), s)}
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <StatusPill status={s} />
                  <span className="text-xs text-muted-foreground">{col.length}</span>
                </div>
                <ul className="space-y-2">
                  {col.map((t) => (
                    <li
                      key={t.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
                      className="cursor-grab rounded-xl border bg-card p-3 shadow-soft active:cursor-grabbing"
                    >
                      <p className="text-sm font-medium">{t.title}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className={cn('text-xs', isOverdue(t) ? 'text-destructive' : 'text-muted-foreground')}>{formatDue(t.due_at)}</span>
                        <PriorityBadge priority={t.priority} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-6">
          {timeline.map(([key, items]) => (
            <section key={key}>
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {key === 'none' ? 'No due date' : new Date(key).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
              </h2>
              <ul className="divide-y rounded-2xl border bg-card shadow-soft">{items.map(row)}</ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
