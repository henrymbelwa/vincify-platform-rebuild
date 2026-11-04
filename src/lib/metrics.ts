import type { Task } from '@/lib/types'

/** Calendar day key (yyyy-mm-dd) of an instant in the given IANA timezone. */
export function dayKey(date: Date | string, timeZone: string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/** A task is overdue when it is still open and its due instant has passed. */
export function isOverdue(t: Pick<Task, 'status' | 'due_at'>, now = new Date()): boolean {
  if (!t.due_at) return false
  if (t.status === 'completed' || t.status === 'cancelled') return false
  return new Date(t.due_at).getTime() < now.getTime()
}

export interface TaskStats {
  total: number
  eligible: number
  completed: number
  pending: number
  overdue: number
  postponed: number
  cancelled: number
  /** Completed eligible / total eligible x 100, or null when there is nothing eligible. Cancelled tasks are excluded. */
  completionRate: number | null
}

export function taskStats(tasks: Pick<Task, 'status' | 'due_at'>[], now = new Date()): TaskStats {
  const s: TaskStats = { total: tasks.length, eligible: 0, completed: 0, pending: 0, overdue: 0, postponed: 0, cancelled: 0, completionRate: null }
  for (const t of tasks) {
    if (t.status === 'cancelled') {
      s.cancelled++
      continue
    }
    s.eligible++
    if (t.status === 'completed') s.completed++
    else if (t.status === 'postponed') s.postponed++
    else s.pending++
    if (isOverdue(t, now)) s.overdue++
  }
  s.completionRate = s.eligible === 0 ? null : Math.round((s.completed / s.eligible) * 1000) / 10
  return s
}

/** Number of consecutive days, ending today, that contain at least one entry. */
export function streak(dayKeys: Set<string>, todayKey: string): number {
  let n = 0
  const d = new Date(`${todayKey}T12:00:00Z`)
  while (dayKeys.has(d.toISOString().slice(0, 10))) {
    n++
    d.setUTCDate(d.getUTCDate() - 1)
  }
  return n
}

/** Minimum days of history before trends are shown, so reports never imply patterns from too little data. */
export const MIN_TREND_DAYS = 3
