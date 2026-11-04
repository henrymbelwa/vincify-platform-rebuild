import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, ExternalLink, Flag, Plus, Table2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Empty, LoadingRows, Panel } from '@/components/app/page'
import { NewTaskDialog, selectClass } from '@/components/app/new-task-dialog'
import { PriorityBadge, TaskCheck } from '@/components/app/task-meta'
import { formatDue } from '@/lib/dates'
import { taskStats } from '@/lib/metrics'
import { keys, useTable, useTaskMutations, useTasks } from '@/lib/queries'
import { must, sb } from '@/lib/supabase'
import type { Project } from '@/lib/types'
import { cn } from '@/lib/utils'
import { projectStatusLabel } from '@/lib/labels'

export const Route = createFileRoute('/app/projects/$projectId')({
  head: () => ({ meta: [{ title: 'Project - Vincify' }] }),
  component: ProjectPage,
})

interface Row {
  id: string
  [k: string]: unknown
}

function useChildren(table: string, projectId: string, order = 'created_at') {
  return useQuery({
    queryKey: [table, projectId],
    queryFn: async () => must(await sb().from(table).select('*').eq('project_id', projectId).order(order)) as Row[],
  })
}

function ProjectPage() {
  const { projectId } = Route.useParams()
  const navigate = useNavigate()
  const project = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => must(await sb().from('projects').select('*').eq('id', projectId).maybeSingle()) as Project | null,
  })
  const tasks = useTasks()
  const projT = useTable<Project>('projects', keys.projects)
  const qc = useQueryClient()
  const { toggle } = useTaskMutations()

  if (project.isLoading) return <LoadingRows rows={4} />
  const p = project.data
  if (!p) return <Empty icon={Flag} title="Project not found" action={<Link to="/app/projects" className="text-sm text-primary">Back to projects</Link>} />

  const ptasks = (tasks.data ?? []).filter((t) => t.project_id === p.id)
  const stats = taskStats(ptasks)
  const patch = async (patch: Partial<Project>) => {
    await projT.update.mutateAsync({ id: p.id, patch })
    qc.invalidateQueries({ queryKey: ['project', projectId] })
  }

  return (
    <div className="mx-auto max-w-content space-y-6">
      <Link to="/app/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Projects
      </Link>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{p.name}</h1>
          {p.description && <p className="mt-1 max-w-reading text-sm text-muted-foreground">{p.description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Project status" className={cn(selectClass, 'w-36')} value={p.status} onChange={(e) => patch({ status: e.target.value as Project['status'] })}>
            {Object.entries(projectStatusLabel).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={async () => {
              if (!confirm('Delete this project and its notes, milestones and tables? Tasks are kept without a project.')) return
              await projT.remove.mutateAsync(p.id)
              navigate({ to: '/app/projects' })
            }}
          >
            <Trash2 /> Delete
          </Button>
        </div>
      </div>
      <Panel>
        <div className="flex justify-between text-sm">
          <span>Progress</span>
          <span className="text-muted-foreground">{stats.completionRate == null ? 'Add tasks to measure progress' : `${stats.completionRate}% (${stats.completed}/${stats.eligible})`}</span>
        </div>
        <Progress value={stats.completionRate ?? 0} className="mt-2 h-2" />
      </Panel>

      <Tabs defaultValue="tasks">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="objectives">Objectives</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="tables">Tables</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>
        <TabsContent value="tasks">
          <Panel
            action={
              <NewTaskDialog projectId={p.id}>
                {(open) => (
                  <Button size="sm" variant="brand" onClick={open}>
                    <Plus /> Task
                  </Button>
                )}
              </NewTaskDialog>
            }
            title="Project tasks"
          >
            {ptasks.length === 0 ? (
              <Empty icon={Flag} title="No tasks in this project" />
            ) : (
              <ul className="divide-y">
                {ptasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <TaskCheck checked={t.status === 'completed'} onToggle={() => toggle(t)} label={`Complete ${t.title}`} />
                    <span className={cn('min-w-0 flex-1 truncate text-sm', t.status === 'completed' && 'text-muted-foreground line-through')}>{t.title}</span>
                    <span className="hidden text-xs text-muted-foreground sm:inline">{formatDue(t.due_at)}</span>
                    <PriorityBadge priority={t.priority} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>
        <TabsContent value="objectives">
          <SimpleList table="project_objectives" projectId={p.id} placeholder="New objective" doneKey="achieved" />
        </TabsContent>
        <TabsContent value="milestones">
          <Milestones projectId={p.id} />
        </TabsContent>
        <TabsContent value="notes">
          <Notes projectId={p.id} />
        </TabsContent>
        <TabsContent value="tables">
          <Tables projectId={p.id} />
        </TabsContent>
        <TabsContent value="resources">
          <Resources projectId={p.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SimpleList({ table, projectId, placeholder, doneKey }: { table: string; projectId: string; placeholder: string; doneKey: string }) {
  const q = useChildren(table, projectId)
  const t = useTable<Row>(table, [table, projectId])
  const [v, setV] = useState('')
  return (
    <Panel>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (v.trim()) t.insert.mutate({ project_id: projectId, title: v.trim().slice(0, 300) }, { onSuccess: () => setV('') })
        }}
      >
        <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
        <Button type="submit" variant="brand">Add</Button>
      </form>
      {!q.data?.length ? (
        <p className="text-sm text-muted-foreground">Nothing here yet.</p>
      ) : (
        <ul className="divide-y">
          {q.data.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2.5">
              <TaskCheck checked={Boolean(r[doneKey])} onToggle={() => t.update.mutate({ id: r.id, patch: { [doneKey]: !r[doneKey] } })} label={String(r.title)} />
              <span className={cn('flex-1 text-sm', Boolean(r[doneKey]) && 'text-muted-foreground line-through')}>{String(r.title)}</span>
              <Button variant="ghost" size="icon-xs" aria-label="Delete" onClick={() => t.remove.mutate(r.id)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function Milestones({ projectId }: { projectId: string }) {
  const q = useChildren('project_milestones', projectId, 'due_date')
  const t = useTable<Row>('project_milestones', ['project_milestones', projectId])
  return (
    <Panel>
      <form
        className="mb-5 grid gap-2 sm:grid-cols-[1fr_11rem_auto]"
        onSubmit={(e) => {
          e.preventDefault()
          const f = new FormData(e.currentTarget)
          const title = String(f.get('title')).trim()
          if (!title) return
          t.insert.mutate({ project_id: projectId, title: title.slice(0, 200), due_date: String(f.get('due') || '') || null })
          e.currentTarget.reset()
        }}
      >
        <Input name="title" placeholder="Milestone" aria-label="Milestone" />
        <Input name="due" type="date" aria-label="Due date" />
        <Button type="submit" variant="brand">Add</Button>
      </form>
      {!q.data?.length ? (
        <p className="text-sm text-muted-foreground">No milestones yet.</p>
      ) : (
        <ol className="relative space-y-4 border-l pl-6">
          {q.data.map((m) => (
            <li key={m.id} className="relative">
              <span className={cn('absolute top-1 -left-[29px] size-3 rounded-full border-2 border-card', m.completed_at ? 'bg-success' : 'bg-brand-purple')} />
              <div className="flex flex-wrap items-center gap-3">
                <span className={cn('text-sm font-medium', Boolean(m.completed_at) && 'text-muted-foreground line-through')}>{String(m.title)}</span>
                {Boolean(m.due_date) && <span className="text-xs text-muted-foreground">{new Date(`${m.due_date}T12:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                <Button size="xs" variant="outline" className="ml-auto" onClick={() => t.update.mutate({ id: m.id, patch: { completed_at: m.completed_at ? null : new Date().toISOString() } })}>
                  {m.completed_at ? 'Reopen' : 'Mark done'}
                </Button>
                <Button variant="ghost" size="icon-xs" aria-label="Delete" onClick={() => t.remove.mutate(m.id)}>
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

function Notes({ projectId }: { projectId: string }) {
  const q = useChildren('project_notes', projectId)
  const t = useTable<Row>('project_notes', ['project_notes', projectId])
  const [active, setActive] = useState<string | null>(null)
  const note = q.data?.find((n) => n.id === active) ?? q.data?.[0]
  return (
    <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
      <Panel>
        <Button size="sm" variant="outline" className="mb-3 w-full" onClick={() => t.insert.mutate({ project_id: projectId, title: 'Untitled note' }, { onSuccess: (n) => setActive(n.id) })}>
          <Plus /> New note
        </Button>
        <ul className="space-y-0.5">
          {q.data?.map((n) => (
            <li key={n.id}>
              <button onClick={() => setActive(n.id)} className={cn('w-full truncate rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted', note?.id === n.id && 'bg-accent text-accent-foreground')}>
                {String(n.title)}
              </button>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel>
        {!note ? (
          <p className="text-sm text-muted-foreground">Create a note to capture ideas, minutes or research.</p>
        ) : (
          <form
            key={note.id}
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              const f = new FormData(e.currentTarget)
              t.update.mutate({ id: note.id, patch: { title: String(f.get('title')).slice(0, 200) || 'Untitled note', body: String(f.get('body')).slice(0, 100000) } }, { onSuccess: () => toast.success('Note saved') })
            }}
          >
            <Input name="title" defaultValue={String(note.title)} aria-label="Note title" className="font-medium" />
            <Textarea name="body" defaultValue={String(note.body ?? '')} rows={14} aria-label="Note body" />
            <div className="flex justify-between">
              <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => t.remove.mutate(note.id)}>
                <Trash2 /> Delete
              </Button>
              <Button type="submit" variant="brand" size="sm">Save note</Button>
            </div>
          </form>
        )}
      </Panel>
    </div>
  )
}

function Tables({ projectId }: { projectId: string }) {
  const tables = useChildren('custom_tables', projectId)
  const t = useTable<Row>('custom_tables', ['custom_tables', projectId])
  const [name, setName] = useState('')
  return (
    <div className="space-y-4">
      <Panel>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) t.insert.mutate({ project_id: projectId, name: name.trim().slice(0, 120) }, { onSuccess: () => setName('') })
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New table name, for example Budget or Reading list" aria-label="Table name" />
          <Button type="submit" variant="brand">Create table</Button>
        </form>
      </Panel>
      {!tables.data?.length ? (
        <Empty icon={Table2} title="No custom tables" body="Track anything structured: budgets, contacts, reading lists." />
      ) : (
        tables.data.map((tb) => <CustomTable key={tb.id} id={tb.id} name={String(tb.name)} onDelete={() => t.remove.mutate(tb.id)} />)
      )}
    </div>
  )
}

function CustomTable({ id, name, onDelete }: { id: string; name: string; onDelete: () => void }) {
  const qc = useQueryClient()
  const cols = useQuery({
    queryKey: ['custom_table_columns', id],
    queryFn: async () => must(await sb().from('custom_table_columns').select('*').eq('table_id', id).order('position')) as Row[],
  })
  const rows = useQuery({
    queryKey: ['custom_table_rows', id],
    queryFn: async () => must(await sb().from('custom_table_rows').select('*').eq('table_id', id).order('position').order('created_at')) as Row[],
  })
  const colT = useTable<Row>('custom_table_columns', ['custom_table_columns', id])
  const rowT = useTable<Row>('custom_table_rows', ['custom_table_rows', id])
  const columns = cols.data ?? []

  const saveCell = (row: Row, colId: string, value: unknown) => {
    const data = { ...(row.data as Record<string, unknown>), [colId]: value }
    qc.setQueryData<Row[]>(['custom_table_rows', id], (old) => old?.map((r) => (r.id === row.id ? { ...r, data } : r)))
    rowT.update.mutate({ id: row.id, patch: { data } })
  }

  return (
    <Panel
      title={name}
      action={
        <div className="flex gap-1">
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              const n = prompt('Column name')?.trim()
              if (!n) return
              const kind = prompt('Type: text, number, date or checkbox', 'text')?.trim().toLowerCase()
              colT.insert.mutate({ table_id: id, name: n.slice(0, 80), kind: ['number', 'date', 'checkbox'].includes(kind ?? '') ? kind : 'text', position: columns.length })
            }}
          >
            <Plus /> Column
          </Button>
          <Button size="xs" variant="outline" disabled={!columns.length} onClick={() => rowT.insert.mutate({ table_id: id, data: {}, position: rows.data?.length ?? 0 })}>
            <Plus /> Row
          </Button>
          <Button size="icon-xs" variant="ghost" aria-label="Delete table" onClick={() => confirm('Delete this table?') && onDelete()}>
            <Trash2 />
          </Button>
        </div>
      }
    >
      {!columns.length ? (
        <p className="text-sm text-muted-foreground">Add a column to start.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                {columns.map((c) => (
                  <th key={c.id} className="px-2 py-2 font-medium">
                    <span className="inline-flex items-center gap-1">
                      {String(c.name)}
                      <button aria-label={`Delete column ${c.name}`} className="opacity-50 hover:opacity-100" onClick={() => confirm('Delete column?') && colT.remove.mutate(c.id)}>
                        <Trash2 className="size-3" />
                      </button>
                    </span>
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.data?.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  {columns.map((c) => {
                    const val = (r.data as Record<string, unknown>)[c.id]
                    return (
                      <td key={c.id} className="px-1 py-1">
                        {c.kind === 'checkbox' ? (
                          <input type="checkbox" className="accent-primary" checked={Boolean(val)} onChange={(e) => saveCell(r, c.id, e.target.checked)} aria-label={String(c.name)} />
                        ) : (
                          <input
                            type={c.kind === 'number' ? 'number' : c.kind === 'date' ? 'date' : 'text'}
                            defaultValue={(val as string) ?? ''}
                            onBlur={(e) => e.target.value !== String(val ?? '') && saveCell(r, c.id, c.kind === 'number' ? Number(e.target.value) : e.target.value.slice(0, 1000))}
                            aria-label={String(c.name)}
                            className="h-8 w-full rounded-md bg-transparent px-1.5 outline-none focus:bg-muted"
                          />
                        )}
                      </td>
                    )
                  })}
                  <td>
                    <button aria-label="Delete row" className="p-1 text-muted-foreground hover:text-destructive" onClick={() => rowT.remove.mutate(r.id)}>
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

function Resources({ projectId }: { projectId: string }) {
  const q = useChildren('project_resources', projectId)
  const t = useTable<Row>('project_resources', ['project_resources', projectId])
  return (
    <Panel>
      <form
        className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault()
          const f = new FormData(e.currentTarget)
          const title = String(f.get('title')).trim()
          const url = String(f.get('url')).trim()
          if (!title) return
          if (url && !/^https?:\/\//i.test(url)) return toast.error('Links must start with http:// or https://')
          t.insert.mutate({ project_id: projectId, title: title.slice(0, 200), url: url.slice(0, 2000) || null })
          e.currentTarget.reset()
        }}
      >
        <Input name="title" placeholder="Title" aria-label="Resource title" />
        <Input name="url" placeholder="https://" aria-label="Link" />
        <Button type="submit" variant="brand">Add</Button>
      </form>
      {!q.data?.length ? (
        <p className="text-sm text-muted-foreground">Save links and references for this project.</p>
      ) : (
        <ul className="divide-y">
          {q.data.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm">{String(r.title)}</span>
              {Boolean(r.url) && (
                <a href={String(r.url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  Open <ExternalLink className="size-3" />
                </a>
              )}
              <Button variant="ghost" size="icon-xs" aria-label="Delete" onClick={() => t.remove.mutate(r.id)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
