import type { Priority, TaskStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const priorityStyles: Record<Priority, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-chart-3/12 text-chart-3',
  high: 'bg-warning/15 text-warning',
  urgent: 'bg-destructive/12 text-destructive',
}

export const priorityLabel: Record<Priority, string> = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' }
export const priorityRank: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

export const statusLabel: Record<TaskStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
}

export const statusDot: Record<TaskStatus, string> = {
  not_started: 'bg-muted-foreground/40',
  in_progress: 'bg-brand-purple',
  completed: 'bg-success',
  postponed: 'bg-warning',
  cancelled: 'bg-muted-foreground/60',
}

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium', priorityStyles[priority], className)}>
      {priorityLabel[priority]}
    </span>
  )
}

export function StatusPill({ status }: { status: TaskStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn('size-1.5 rounded-full', statusDot[status])} />
      {statusLabel[status]}
    </span>
  )
}

export function TaskCheck({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        'grid size-[18px] shrink-0 place-items-center rounded-full border transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none',
        checked ? 'border-transparent bg-brand-gradient text-white' : 'border-input bg-card hover:border-brand-purple',
      )}
    >
      {checked && (
        <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden="true">
          <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}
