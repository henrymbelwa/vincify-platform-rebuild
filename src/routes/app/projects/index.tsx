import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { FolderKanban, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Empty, LoadingRows, PageHeader } from '@/components/app/page'
import { taskStats } from '@/lib/metrics'
import { keys, useProjects, useTable, useTasks } from '@/lib/queries'
import type { Project } from '@/lib/types'
import { cn } from '@/lib/utils'
import { projectStatusLabel } from '@/lib/labels'

export const Route = createFileRoute('/app/projects/')({
  head: () => ({ meta: [{ title: 'My Projects - Vincify' }] }),
  component: ProjectsPage,
})


function ProjectsPage() {
  const projects = useProjects()
  const tasks = useTasks()
  const t = useTable<Project>('projects', keys.projects)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const list = (projects.data ?? []).filter((p) => showArchived || p.status !== 'archived')

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const name = String(f.get('name')).trim()
    if (name.length < 2) return toast.error('Give your project a name')
    const p = await t.insert.mutateAsync({
      name: name.slice(0, 160),
      description: String(f.get('description') || '').slice(0, 8000) || null,
      start_date: String(f.get('start') || '') || null,
      due_date: String(f.get('due') || '') || null,
    })
    setOpen(false)
    navigate({ to: '/app/projects/$projectId', params: { projectId: p.id } })
  }

  return (
    <div className="mx-auto max-w-content">
      <PageHeader
        title="My Projects"
        description="A dedicated workspace for every project."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowArchived((s) => !s)}>
              {showArchived ? 'Hide archived' : 'Show archived'}
            </Button>
            <Button variant="brand" onClick={() => setOpen(true)}>
              <Plus /> <span className="hidden sm:inline">New project</span>
            </Button>
          </>
        }
      />
      {projects.isLoading ? (
        <LoadingRows />
      ) : list.length === 0 ? (
        <Empty icon={FolderKanban} title="No projects yet" body="Create a project to organise objectives, milestones, notes and tasks." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const s = taskStats((tasks.data ?? []).filter((x) => x.project_id === p.id))
            return (
              <Link
                key={p.id}
                to="/app/projects/$projectId"
                params={{ projectId: p.id }}
                className={cn('rounded-2xl border bg-card p-5 shadow-soft transition-colors hover:border-primary/40', p.status === 'archived' && 'opacity-60')}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 truncate font-semibold">{p.name}</h2>
                  <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] text-accent-foreground">{projectStatusLabel[p.status]}</span>
                </div>
                {p.description && <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
                <div className="mt-4 flex justify-between text-xs text-muted-foreground">
                  <span>{s.eligible ? `${s.completed} of ${s.eligible} tasks` : 'No tasks yet'}</span>
                  {p.due_date && <span>Due {new Date(`${p.due_date}T12:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>}
                </div>
                <Progress value={s.completionRate ?? 0} className="mt-2 h-1.5" />
              </Link>
            )
          })}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>You can add objectives, milestones and notes next.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Name</Label>
              <Input id="p-name" name="name" required maxLength={160} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-desc">Description</Label>
              <Textarea id="p-desc" name="description" rows={3} maxLength={8000} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="p-start">Start date</Label>
                <Input id="p-start" name="start" type="date" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-due">Due date</Label>
                <Input id="p-due" name="due" type="date" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" variant="brand" disabled={t.insert.isPending}>
                Create project
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
