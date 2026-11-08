import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Clock, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/app/page'
import { selectClass } from '@/components/app/new-task-dialog'
import { useUser } from '@/lib/auth'
import { addDays, startOfDay, startOfWeek } from '@/lib/dates'
import { useEvents, useTable, useTasks } from '@/lib/queries'
import { must, sb } from '@/lib/supabase'
import type { CalendarEvent, PlannedActivity, TimetableEntry } from '@/lib/types'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/app/calendar')({
  head: () => ({ meta: [{ title: 'Calendar & Time-blocking - Vincify' }] }),
  component: CalendarPage,
})

type View = 'day' | 'week' | 'month'
interface Item {
  id: string
  title: string
  start: Date
  end?: Date
  kind: 'event' | 'task' | 'class' | 'block'
  allDay?: boolean
  event?: CalendarEvent
  block?: PlannedActivity
}

function range(view: View, anchor: Date) {
  if (view === 'day') return [startOfDay(anchor), addDays(startOfDay(anchor), 1)] as const
  if (view === 'week') return [startOfWeek(anchor), addDays(startOfWeek(anchor), 7)] as const
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const start = startOfWeek(first)
  return [start, addDays(start, 42)] as const
}

const kindStyle = {
  event: 'bg-primary/12 text-primary',
  task: 'bg-brand-pink/12 text-brand-pink',
  class: 'bg-chart-3/12 text-chart-3',
  block: 'bg-brand-purple/15 text-brand-purple border border-brand-purple/30',
}

function CalendarPage() {
  const user = useUser()
  const queryClient = useQueryClient()
  const [view, setView] = useState<View>('week')
  const [anchor, setAnchor] = useState(() => new Date())
  const [editing, setEditing] = useState<Partial<CalendarEvent> | null>(null)
  const [blockDialogOpen, setBlockDialogOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState<Partial<PlannedActivity> | null>(null)
  const [from, to] = range(view, anchor)
  const events = useEvents(from, to)
  const tasks = useTasks()

  const timetable = useQuery({
    queryKey: ['timetable_entries'],
    queryFn: async () => must(await sb().from('timetable_entries').select('*')) as TimetableEntry[],
  })

  const timeBlocks = useQuery({
    queryKey: ['planned_activities', from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const res = await sb()
        .from('planned_activities')
        .select('*')
        .gte('starts_at', from.toISOString())
        .lte('starts_at', to.toISOString())
        .order('starts_at')
      return must(res) as PlannedActivity[]
    },
  })

  const saveBlock = useMutation({
    mutationFn: async (blk: Partial<PlannedActivity>) => {
      if (blk.id) {
        return must(await sb().from('planned_activities').update(blk).eq('id', blk.id))
      }
      return must(await sb().from('planned_activities').insert({ ...blk, user_id: user.id }))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned_activities'] })
      setBlockDialogOpen(false)
      setEditingBlock(null)
      toast.success('Time block saved')
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save time block'),
  })

  const deleteBlock = useMutation({
    mutationFn: async (id: string) => {
      return must(await sb().from('planned_activities').delete().eq('id', id))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned_activities'] })
      setBlockDialogOpen(false)
      setEditingBlock(null)
      toast.success('Time block deleted')
    },
  })

  const days = useMemo(() => {
    const out: Date[] = []
    for (let d = new Date(from); d < to; d = addDays(d, 1)) out.push(d)
    return out
  }, [from, to])

  const itemsFor = (day: Date): Item[] => {
    const next = addDays(day, 1)
    const ev: Item[] = (events.data ?? [])
      .filter((e) => new Date(e.starts_at) < next && new Date(e.ends_at) >= day)
      .map((e) => ({ id: e.id, title: e.title, start: new Date(e.starts_at), end: new Date(e.ends_at), kind: 'event', allDay: e.all_day, event: e }))
    const tk: Item[] = (tasks.data ?? [])
      .filter((t) => t.due_at && t.status !== 'cancelled' && new Date(t.due_at) >= day && new Date(t.due_at) < next)
      .map((t) => ({ id: t.id, title: t.title, start: new Date(t.due_at!), kind: 'task' }))
    const tb: Item[] = (timeBlocks.data ?? [])
      .filter((b) => b.starts_at && new Date(b.starts_at) >= day && new Date(b.starts_at) < next)
      .map((b) => ({ id: b.id, title: `Block: ${b.title}`, start: new Date(b.starts_at!), end: b.ends_at ? new Date(b.ends_at) : undefined, kind: 'block', block: b }))
    const cl: Item[] = (timetable.data ?? [])
      .filter((c) => c.weekday === day.getDay())
      .map((c) => {
        const [h, m] = c.start_time.split(':').map(Number)
        const s = new Date(day)
        s.setHours(h!, m!, 0, 0)
        return { id: `${c.id}-${day.toDateString()}`, title: c.location ? `${c.title}, ${c.location}` : c.title, start: s, kind: 'class' }
      })
    return [...ev, ...tk, ...tb, ...cl].sort((a, b) => a.start.getTime() - b.start.getTime())
  }

  const shift = (dir: number) =>
    setAnchor((a) => (view === 'month' ? new Date(a.getFullYear(), a.getMonth() + dir, 1) : addDays(a, dir * (view === 'week' ? 7 : 1))))
  const today = startOfDay().getTime()
  const title =
    view === 'month'
      ? anchor.toLocaleDateString([], { month: 'long', year: 'numeric' })
      : view === 'week'
        ? `${from.toLocaleDateString([], { day: 'numeric', month: 'short' })} - ${addDays(to, -1).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}`
        : anchor.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })

  const chip = (it: Item, compact = false) => (
    <button
      key={it.id}
      type="button"
      onClick={() => {
        if (it.kind === 'event') setEditing(it.event!)
        else if (it.kind === 'block') {
          setEditingBlock(it.block!)
          setBlockDialogOpen(true)
        }
      }}
      disabled={it.kind !== 'event' && it.kind !== 'block'}
      className={cn(
        'group flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs font-medium transition-colors',
        kindStyle[it.kind],
        (it.kind === 'event' || it.kind === 'block') && 'hover:brightness-95 cursor-pointer',
      )}
    >
      <span className="truncate">{it.title}</span>
      {!compact && !it.allDay && (
        <span className="ml-1 text-[10px] opacity-70">
          {it.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
        </span>
      )}
    </button>
  )

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Calendar & Time-blocking"
        description="Consolidate events, tasks, timetable classes and focused study blocks."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const s = new Date(anchor)
                s.setHours(9, 0, 0, 0)
                const e = new Date(s.getTime() + 2 * 3600000)
                setEditingBlock({
                  title: '',
                  starts_at: s.toISOString(),
                  ends_at: e.toISOString(),
                })
                setBlockDialogOpen(true)
              }}
            >
              <Clock className="size-4 mr-1.5" />
              Time Block
            </Button>
            <Button size="sm" onClick={() => setEditing({ starts_at: new Date().toISOString() })}>
              <Plus className="size-4 mr-1.5" />
              New Event
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-xs">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => shift(-1)} aria-label="Previous">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => shift(1)} aria-label="Next">
            <ChevronRight className="size-4" />
          </Button>
          <h2 className="ml-2 font-medium">{title}</h2>
        </div>

        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList>
            <TabsTrigger value="day">Day</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-xs">
        <div className={cn('grid gap-2', view === 'month' ? 'grid-cols-7' : view === 'week' ? 'grid-cols-7' : 'grid-cols-1')}>
          {days.map((d) => {
            const items = itemsFor(d)
            const isToday = d.getTime() === today
            return (
              <div key={d.toISOString()} className={cn('min-h-[140px] rounded-lg border p-2', isToday && 'border-brand-purple/60 bg-brand-purple/5')}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {d.toLocaleDateString([], { weekday: 'short' })}
                  </span>
                  <span className={cn('grid size-6 place-items-center rounded-full text-xs font-semibold', isToday ? 'bg-brand-purple text-white' : 'text-foreground')}>
                    {d.getDate()}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {items.map((it) => chip(it, view === 'month'))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <EventDialog value={editing} onClose={() => setEditing(null)} />

      {/* Time-blocking Dialog */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBlock?.id ? 'Edit Time Block' : 'Schedule Focused Time Block'}</DialogTitle>
            <DialogDescription>Reserve dedicated time on your schedule for uninterrupted study or project work.</DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (editingBlock?.title?.trim()) {
                saveBlock.mutate(editingBlock)
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="blk-title">Activity Title</Label>
              <Input
                id="blk-title"
                required
                value={editingBlock?.title ?? ''}
                onChange={(e) => setEditingBlock((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Deep Work: Algorithm Analysis"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="blk-start">Start Time</Label>
                <Input
                  id="blk-start"
                  type="datetime-local"
                  required
                  value={editingBlock?.starts_at ? toLocalInput(editingBlock.starts_at) : ''}
                  onChange={(e) => setEditingBlock((prev) => ({ ...prev, starts_at: new Date(e.target.value).toISOString() }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="blk-end">End Time</Label>
                <Input
                  id="blk-end"
                  type="datetime-local"
                  required
                  value={editingBlock?.ends_at ? toLocalInput(editingBlock.ends_at) : ''}
                  onChange={(e) => setEditingBlock((prev) => ({ ...prev, ends_at: new Date(e.target.value).toISOString() }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="blk-task">Link to Task (Optional)</Label>
              <select
                id="blk-task"
                className={selectClass}
                value={editingBlock?.task_id ?? ''}
                onChange={(e) => setEditingBlock((prev) => ({ ...prev, task_id: e.target.value || null }))}
              >
                <option value="">No task linked</option>
                {(tasks.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>

            <DialogFooter className="flex items-center justify-between">
              {editingBlock?.id ? (
                <Button variant="ghost" type="button" onClick={() => deleteBlock.mutate(editingBlock.id!)} className="text-destructive">
                  <Trash2 className="size-4 mr-1" />
                  Delete
                </Button>
              ) : <div />}
              <div className="flex gap-2">
                <Button variant="outline" type="button" onClick={() => setBlockDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveBlock.isPending}>
                  Save Block
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const toLocalInput = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function EventDialog({ value, onClose }: { value: Partial<CalendarEvent> | null; onClose: () => void }) {
  const t = useTable<CalendarEvent>('calendar_events', ['events'])
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const title = String(f.get('title')).trim()
    const start = new Date(String(f.get('start')))
    const end = new Date(String(f.get('end') || f.get('start')))
    if (title.length < 1) return toast.error('Add a title')
    if (isNaN(start.getTime()) || end < start) return toast.error('End must be after start')
    const remind = String(f.get('remind'))
    const row = {
      title: title.slice(0, 200),
      description: String(f.get('description') || '').slice(0, 4000) || null,
      location: String(f.get('location') || '').slice(0, 200) || null,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      all_day: f.get('all_day') === 'on',
      remind_minutes: remind ? Number(remind) : null,
      reminded_at: null,
    }
    if (value?.id) await t.update.mutateAsync({ id: value.id, patch: row })
    else await t.insert.mutateAsync(row)
    toast.success('Event saved')
    onClose()
  }
  const defaultEnd = value?.ends_at ?? (value?.starts_at ? new Date(new Date(value.starts_at).getTime() + 3600000).toISOString() : undefined)
  return (
    <Dialog open={Boolean(value)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{value?.id ? 'Edit event' : 'New event'}</DialogTitle>
          <DialogDescription>Events appear on your calendar and in reminders.</DialogDescription>
        </DialogHeader>
        {value && (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ev-title">Title</Label>
              <Input id="ev-title" name="title" defaultValue={value.title ?? ''} required maxLength={200} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ev-start">Starts</Label>
                <Input id="ev-start" name="start" type="datetime-local" defaultValue={toLocalInput(value.starts_at)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-end">Ends</Label>
                <Input id="ev-end" name="end" type="datetime-local" defaultValue={toLocalInput(defaultEnd)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-loc">Location</Label>
                <Input id="ev-loc" name="location" defaultValue={value.location ?? ''} maxLength={200} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-rem">Reminder</Label>
                <select id="ev-rem" name="remind" defaultValue={value.remind_minutes ?? ''} className={selectClass}>
                  <option value="">None</option>
                  <option value="5">5 minutes before</option>
                  <option value="15">15 minutes before</option>
                  <option value="30">30 minutes before</option>
                  <option value="60">1 hour before</option>
                  <option value="1440">1 day before</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-desc">Notes</Label>
              <Textarea id="ev-desc" name="description" defaultValue={value.description ?? ''} rows={3} maxLength={4000} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
