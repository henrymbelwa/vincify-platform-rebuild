import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/app/page'
import { selectClass } from '@/components/app/new-task-dialog'
import { addDays, startOfDay, startOfWeek } from '@/lib/dates'
import { useEvents, useTable, useTasks } from '@/lib/queries'
import { must, sb } from '@/lib/supabase'
import type { CalendarEvent, TimetableEntry } from '@/lib/types'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/app/calendar')({
  head: () => ({ meta: [{ title: 'Calendar - Vincify' }] }),
  component: CalendarPage,
})

type View = 'day' | 'week' | 'month'
interface Item {
  id: string
  title: string
  start: Date
  kind: 'event' | 'task' | 'class'
  allDay?: boolean
  event?: CalendarEvent
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
}

function CalendarPage() {
  const [view, setView] = useState<View>('week')
  const [anchor, setAnchor] = useState(() => new Date())
  const [editing, setEditing] = useState<Partial<CalendarEvent> | null>(null)
  const [from, to] = range(view, anchor)
  const events = useEvents(from, to)
  const tasks = useTasks()
  const timetable = useQuery({
    queryKey: ['timetable_entries'],
    queryFn: async () => must(await sb().from('timetable_entries').select('*')) as TimetableEntry[],
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
      .map((e) => ({ id: e.id, title: e.title, start: new Date(e.starts_at), kind: 'event', allDay: e.all_day, event: e }))
    const tk: Item[] = (tasks.data ?? [])
      .filter((t) => t.due_at && t.status !== 'cancelled' && new Date(t.due_at) >= day && new Date(t.due_at) < next)
      .map((t) => ({ id: t.id, title: t.title, start: new Date(t.due_at!), kind: 'task' }))
    const cl: Item[] = (timetable.data ?? [])
      .filter((c) => c.weekday === day.getDay())
      .map((c) => {
        const [h, m] = c.start_time.split(':').map(Number)
        const s = new Date(day)
        s.setHours(h!, m!, 0, 0)
        return { id: `${c.id}-${day.toDateString()}`, title: c.location ? `${c.title}, ${c.location}` : c.title, start: s, kind: 'class' }
      })
    return [...ev, ...tk, ...cl].sort((a, b) => a.start.getTime() - b.start.getTime())
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
      disabled={it.kind !== 'event'}
      onClick={() => it.event && setEditing(it.event)}
      className={cn('block w-full truncate rounded-md px-1.5 py-0.5 text-left text-xs', kindStyle[it.kind], it.kind === 'event' && 'hover:opacity-80')}
    >
      {!it.allDay && !compact && <span className="mr-1 opacity-70">{it.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
      {it.title}
    </button>
  )

  return (
    <div className="mx-auto max-w-content">
      <PageHeader
        title="Calendar"
        description="Events, task deadlines and your timetable in one view."
        actions={
          <Button variant="brand" onClick={() => setEditing({ starts_at: new Date(Math.ceil(Date.now() / 3600000) * 3600000).toISOString() })}>
            <Plus /> <span className="hidden sm:inline">New event</span>
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon-sm" aria-label="Previous" onClick={() => shift(-1)}>
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
          Today
        </Button>
        <Button variant="outline" size="icon-sm" aria-label="Next" onClick={() => shift(1)}>
          <ChevronRight />
        </Button>
        <h2 className="ml-2 text-sm font-semibold">{title}</h2>
        <Tabs value={view} onValueChange={(v) => setView(v as View)} className="ml-auto">
          <TabsList>
            <TabsTrigger value="day">Day</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="mb-3 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" /> Events</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-brand-pink" /> Task deadlines</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-chart-3" /> Timetable</span>
      </div>

      {view === 'day' ? (
        <div className="rounded-2xl border bg-card p-4 shadow-soft">
          {itemsFor(days[0]!).length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nothing scheduled.</p>
          ) : (
            <ul className="space-y-2">{itemsFor(days[0]!).map((it) => <li key={it.id}>{chip(it)}</li>)}</ul>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const items = itemsFor(d)
              const muted = view === 'month' && d.getMonth() !== anchor.getMonth()
              return (
                <div key={d.toISOString()} className={cn('border-r border-b p-1.5 last:border-r-0 [&:nth-child(7n)]:border-r-0', view === 'week' ? 'min-h-48' : 'min-h-24', muted && 'bg-muted/30')}>
                  <button
                    onClick={() => {
                      setAnchor(d)
                      setView('day')
                    }}
                    className={cn('mb-1 grid size-6 place-items-center rounded-full text-xs', d.getTime() === today ? 'bg-brand-gradient font-semibold text-white' : muted ? 'text-muted-foreground/60' : 'text-muted-foreground')}
                  >
                    {d.getDate()}
                  </button>
                  <div className="space-y-0.5">
                    {items.slice(0, view === 'week' ? 8 : 3).map((it) => chip(it, view === 'month'))}
                    {items.length > (view === 'week' ? 8 : 3) && <p className="px-1 text-[11px] text-muted-foreground">+{items.length - (view === 'week' ? 8 : 3)} more</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      <EventDialog value={editing} onClose={() => setEditing(null)} />
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
                <select id="ev-rem" name="remind" defaultValue={value.remind_minutes?.toString() ?? '15'} className={selectClass}>
                  <option value="">None</option>
                  <option value="5">5 minutes before</option>
                  <option value="15">15 minutes before</option>
                  <option value="60">1 hour before</option>
                  <option value="1440">1 day before</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="all_day" defaultChecked={value.all_day ?? false} className="accent-primary" /> All day
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="ev-desc">Notes</Label>
              <Textarea id="ev-desc" name="description" rows={2} defaultValue={value.description ?? ''} maxLength={4000} />
            </div>
            <DialogFooter className="gap-2">
              {value.id && (
                <Button
                  type="button"
                  variant="ghost"
                  className="mr-auto text-destructive"
                  onClick={async () => {
                    await t.remove.mutateAsync(value.id!)
                    onClose()
                  }}
                >
                  <Trash2 /> Delete
                </Button>
              )}
              <Button type="submit" variant="brand" disabled={t.insert.isPending || t.update.isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
