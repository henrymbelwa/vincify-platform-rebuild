import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useProjects, useTaskMutations } from '@/lib/queries'
import type { Priority } from '@/lib/types'

const schema = z.object({
  title: z.string().trim().min(2, 'Give your task a short title.').max(200),
  description: z.string().trim().max(8000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  category: z.string().trim().max(60),
  project_id: z.string(),
  due: z.string(),
})

export const selectClass = 'h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

export function NewTaskDialog({ children, projectId }: { children: (open: () => void) => ReactNode; projectId?: string }) {
  const [open, setOpen] = useState(false)
  const { create } = useTaskMutations()
  const projects = useProjects()

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsed = schema.safeParse(Object.fromEntries(new FormData(e.currentTarget)))
    if (!parsed.success) return toast.error(parsed.error.issues[0]!.message)
    const v = parsed.data
    await create.mutateAsync({
      title: v.title,
      description: v.description || null,
      priority: v.priority as Priority,
      category: v.category || null,
      project_id: v.project_id || null,
      due_at: v.due ? new Date(v.due).toISOString() : null,
    })
    toast.success('Task created')
    setOpen(false)
  }

  return (
    <>
      {children(() => setOpen(true))}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>Capture it now, organise it later.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="t-title">Title</Label>
              <Input id="t-title" name="title" autoFocus required maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-desc">Details</Label>
              <Textarea id="t-desc" name="description" rows={3} maxLength={8000} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="t-pri">Priority</Label>
                <select id="t-pri" name="priority" defaultValue="medium" className={selectClass}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-due">Due</Label>
                <Input id="t-due" name="due" type="datetime-local" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-cat">Category</Label>
                <Input id="t-cat" name="category" placeholder="Work, Study, Personal" maxLength={60} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-proj">Project</Label>
                <select id="t-proj" name="project_id" defaultValue={projectId ?? ''} className={selectClass}>
                  <option value="">No project</option>
                  {projects.data?.filter((p) => p.status !== 'archived').map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="brand" disabled={create.isPending}>
                Create task
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
