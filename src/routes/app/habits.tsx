import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, Flame, Plus, Sparkles, Trash2, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Empty, PageHeader, Panel, Stat } from '@/components/app/page'
import { useUser } from '@/lib/auth'
import { addDays, startOfDay } from '@/lib/dates'
import { must, sb } from '@/lib/supabase'
import type { Habit, HabitLog } from '@/lib/types'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/app/habits')({
  head: () => ({ meta: [{ title: 'Habits & Consistency - Vincify' }] }),
  component: HabitsPage,
})

function HabitsPage() {
  const user = useUser()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingHabit, setEditingHabit] = useState<Partial<Habit> | null>(null)

  const habits = useQuery({
    queryKey: ['habits'],
    queryFn: async () => {
      const res = await sb().from('habits').select('*').eq('archived', false).order('created_at', { ascending: false })
      return must(res) as Habit[]
    },
  })

  // Past 14 days for streak visualization
  const pastDays = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(startOfDay(), -(13 - i))
    return d.toISOString().slice(0, 10)
  })
  const todayStr = pastDays[13]!

  const logs = useQuery({
    queryKey: ['habit_logs'],
    queryFn: async () => {
      const res = await sb()
        .from('habit_logs')
        .select('*')
        .gte('log_date', pastDays[0]!)
        .lte('log_date', todayStr)
      return must(res) as HabitLog[]
    },
  })

  const saveHabit = useMutation({
    mutationFn: async (h: Partial<Habit>) => {
      if (h.id) {
        return must(await sb().from('habits').update(h).eq('id', h.id))
      }
      return must(await sb().from('habits').insert({ ...h, user_id: user.id }))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] })
      setDialogOpen(false)
      setEditingHabit(null)
      toast.success('Habit saved')
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save habit'),
  })

  const deleteHabit = useMutation({
    mutationFn: async (id: string) => {
      return must(await sb().from('habits').update({ archived: true }).eq('id', id))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] })
      toast.success('Habit archived')
    },
  })

  const toggleLog = useMutation({
    mutationFn: async ({ habitId, date, completed }: { habitId: string; date: string; completed: boolean }) => {
      if (completed) {
        return must(await sb().from('habit_logs').delete().eq('habit_id', habitId).eq('log_date', date))
      }
      return must(await sb().from('habit_logs').insert({ user_id: user.id, habit_id: habitId, log_date: date, completed: true }))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habit_logs'] })
    },
  })

  const habitList = habits.data ?? []
  const logList = logs.data ?? []

  // Compute stats
  const completedToday = habitList.filter((h) => logList.some((l) => l.habit_id === h.id && l.log_date === todayStr && l.completed)).length
  const totalHabits = habitList.length

  // Calculate streaks
  const getStreak = (habitId: string) => {
    let streak = 0
    for (let i = 13; i >= 0; i--) {
      const d = pastDays[i]!
      const done = logList.some((l) => l.habit_id === habitId && l.log_date === d && l.completed)
      if (done) streak++
      else if (i !== 13) break // don't break if today isn't done yet, check yesterday
    }
    return streak
  }

  const bestStreak = habitList.reduce((max, h) => Math.max(max, getStreak(h.id)), 0)

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Habits & Consistency"
        description="Build daily discipline and maintain uninterrupted momentum."
        action={
          <Button onClick={() => { setEditingHabit({ frequency: 'daily', target_days_per_week: 7 }); setDialogOpen(true) }}>
            <Plus className="size-4 mr-1.5" />
            New Habit
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Active Habits" value={totalHabits} />
        <Stat label="Done Today" value={`${completedToday} / ${totalHabits}`} />
        <Stat label="Today's Pace" value={totalHabits ? `${Math.round((completedToday / totalHabits) * 100)}%` : '0%'} />
        <Stat label="Best Streak" value={`${bestStreak} days`} icon={<Flame className="size-4 text-brand-pink" />} />
      </div>

      <Panel title="Daily Habit Tracker" description="Mark completed habits to preserve consistency.">
        {habitList.length === 0 ? (
          <Empty
            icon={Flame}
            title="No habits tracked yet"
            description="Start building consistent academic and personal routines today."
            action={
              <Button onClick={() => { setEditingHabit({ frequency: 'daily', target_days_per_week: 7 }); setDialogOpen(true) }}>
                <Plus className="size-4 mr-1.5" />
                Create your first habit
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            <div className="hidden grid-cols-12 items-center gap-2 border-b pb-2 text-xs font-semibold text-muted-foreground sm:grid">
              <div className="col-span-5">Habit</div>
              <div className="col-span-1 text-center">Streak</div>
              <div className="col-span-5 grid grid-cols-7 gap-1 text-center">
                {pastDays.slice(7).map((d) => (
                  <span key={d}>{new Date(d).toLocaleDateString([], { weekday: 'narrow' })}</span>
                ))}
              </div>
              <div className="col-span-1 text-right">Actions</div>
            </div>

            {habitList.map((h) => {
              const currentStreak = getStreak(h.id)
              const doneToday = logList.some((l) => l.habit_id === h.id && l.log_date === todayStr && l.completed)

              return (
                <div key={h.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:grid sm:grid-cols-12 sm:items-center">
                  <div className="col-span-5 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleLog.mutate({ habitId: h.id, date: todayStr, completed: doneToday })}
                      className={cn(
                        'grid size-8 shrink-0 place-items-center rounded-lg border transition-colors',
                        doneToday ? 'border-brand-purple bg-brand-purple text-white' : 'hover:border-foreground/40',
                      )}
                    >
                      {doneToday && <Check className="size-4" />}
                    </button>
                    <div>
                      <h4 className="text-sm font-medium leading-none">{h.title}</h4>
                      {h.description && <p className="mt-1 text-xs text-muted-foreground">{h.description}</p>}
                    </div>
                  </div>

                  <div className="col-span-1 flex items-center justify-start sm:justify-center">
                    <span className="flex items-center gap-1 rounded-full bg-brand-pink/10 px-2 py-0.5 text-xs font-semibold text-brand-pink">
                      <Flame className="size-3" />
                      {currentStreak}d
                    </span>
                  </div>

                  <div className="col-span-5 grid grid-cols-7 gap-1">
                    {pastDays.slice(7).map((d) => {
                      const isDone = logList.some((l) => l.habit_id === h.id && l.log_date === d && l.completed)
                      const isToday = d === todayStr
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleLog.mutate({ habitId: h.id, date: d, completed: isDone })}
                          title={`${new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' })}: ${isDone ? 'Completed' : 'Missed'}`}
                          className={cn(
                            'h-7 rounded transition-colors',
                            isDone ? 'bg-brand-purple text-white' : 'bg-muted/60 hover:bg-muted',
                            isToday && !isDone && 'ring-1 ring-brand-purple/50',
                          )}
                        />
                      )
                    })}
                  </div>

                  <div className="col-span-1 flex items-center justify-end">
                    <Button variant="ghost" size="icon-sm" onClick={() => deleteHabit.mutate(h.id)} title="Archive habit">
                      <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingHabit?.id ? 'Edit Habit' : 'New Habit'}</DialogTitle>
            <DialogDescription>Define a regular routine you want to track consistently.</DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (editingHabit?.title?.trim()) {
                saveHabit.mutate(editingHabit)
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="h-title">Habit title</Label>
              <Input
                id="h-title"
                required
                value={editingHabit?.title ?? ''}
                onChange={(e) => setEditingHabit((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Review lecture notes for 30 minutes"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="h-desc">Notes or Motivation (optional)</Label>
              <Textarea
                id="h-desc"
                rows={2}
                value={editingHabit?.description ?? ''}
                onChange={(e) => setEditingHabit((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Why this habit matters for your academic growth"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveHabit.isPending}>
                Save Habit
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
