import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { currentUserId, must, sb } from '@/lib/supabase'
import type { CalendarEvent, Goal, Project, Task, TaskStatus } from '@/lib/types'

export const keys = {
  tasks: ['tasks'] as const,
  projects: ['projects'] as const,
  goals: ['goals'] as const,
  events: (from: string, to: string) => ['events', from, to] as const,
}

export function useTasks() {
  return useQuery({
    queryKey: keys.tasks,
    queryFn: async () =>
      must(await sb().from('tasks').select('*').order('due_at', { ascending: true, nullsFirst: false }).limit(1000)) as Task[],
  })
}

export function useProjects() {
  return useQuery({
    queryKey: keys.projects,
    queryFn: async () => must(await sb().from('projects').select('*').order('updated_at', { ascending: false })) as Project[],
  })
}

export function useGoals() {
  return useQuery({
    queryKey: keys.goals,
    queryFn: async () => must(await sb().from('goals').select('*').order('created_at', { ascending: false })) as Goal[],
  })
}

export function useEvents(from: Date, to: Date) {
  const f = from.toISOString()
  const t = to.toISOString()
  return useQuery({
    queryKey: keys.events(f, t),
    queryFn: async () =>
      must(await sb().from('calendar_events').select('*').lt('starts_at', t).gte('ends_at', f).order('starts_at')) as CalendarEvent[],
  })
}

export type NewTask = Pick<Task, 'title' | 'priority'> & Partial<Pick<Task, 'description' | 'category' | 'project_id' | 'due_at' | 'status' | 'goal_id'>>

export function useTaskMutations() {
  const qc = useQueryClient()
  const onError = (e: Error) => toast.error(e.message)
  const patchCache = (id: string, patch: Partial<Task>) =>
    qc.setQueryData<Task[]>(keys.tasks, (old) => old?.map((t) => (t.id === id ? { ...t, ...patch } : t)))

  const create = useMutation({
    mutationFn: async (t: NewTask) =>
      must(await sb().from('tasks').insert({ ...t, user_id: await currentUserId() }).select('*').single()) as Task,
    onSuccess: (task) => qc.setQueryData<Task[]>(keys.tasks, (old) => [task, ...(old ?? [])]),
    onError,
  })
  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Task> }) => {
      patchCache(id, patch)
      return must(await sb().from('tasks').update(patch).eq('id', id).select('*').single()) as Task
    },
    onSuccess: (task) => patchCache(task.id, task),
    onError: (e: Error) => {
      onError(e)
      qc.invalidateQueries({ queryKey: keys.tasks })
    },
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      must(await sb().from('tasks').delete().eq('id', id))
      return id
    },
    onSuccess: (id) => qc.setQueryData<Task[]>(keys.tasks, (old) => old?.filter((t) => t.id !== id)),
    onError,
  })
  const setStatus = (id: string, status: TaskStatus) => update.mutate({ id, patch: { status } })
  const toggle = (t: Task) => setStatus(t.id, t.status === 'completed' ? 'in_progress' : 'completed')
  return { create, update, remove, setStatus, toggle }
}

/** Generic owner-scoped insert/update/delete with cache invalidation, for simpler tables. */
export function useTable<T extends { id: string }>(table: string, invalidate: readonly unknown[]) {
  const qc = useQueryClient()
  const done = () => qc.invalidateQueries({ queryKey: invalidate })
  const onError = (e: Error) => toast.error(e.message)
  return {
    insert: useMutation({
      mutationFn: async (row: Partial<T>) =>
        must(await sb().from(table).insert({ ...row, user_id: await currentUserId() }).select('*').single()) as T,
      onSuccess: done,
      onError,
    }),
    update: useMutation({
      mutationFn: async ({ id, patch }: { id: string; patch: Partial<T> }) => must(await sb().from(table).update(patch).eq('id', id)),
      onSuccess: done,
      onError,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => must(await sb().from(table).delete().eq('id', id)),
      onSuccess: done,
      onError,
    }),
  }
}
