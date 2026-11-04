import type { Priority, TaskStatus } from '@/lib/fixtures'
import { cn } from '@/lib/utils'

const priorityStyles: Record<Priority, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-sky-50 text-sky-700',
  high: 'bg-amber-50 text-amber-700',
  urgent: 'bg-rose-50 text-rose-700',
}

export const priorityLabel: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

export const statusLabel: Record<TaskStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
}

export const statusDot: Record<TaskStatus, string> = {
  not_started: 'bg-slate-300',
  in_progress: 'bg-violet-500',
  completed: 'bg-emerald-500',
  postponed: 'bg-amber-400',
  cancelled: 'bg-slate-400',
}

export function PriorityBadge({
  priority,
  className,
}: {
  priority: Priority
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium',
        priorityStyles[priority],
        className,
      )}
    >
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

export function TaskCheck({
  checked,
  onToggle,
  label,
}: {
  checked: boolean
  onToggle: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        'grid size-[18px] shrink-0 place-items-center rounded-full border transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none',
        checked
          ? 'border-transparent bg-brand-gradient text-white'
          : 'border-slate-300 bg-white hover:border-brand-purple',
      )}
    >
      {checked && (
        <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden="true">
          <path
            d="M2.5 6.2 5 8.5l4.5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  )
}
