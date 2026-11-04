import { useState } from 'react'
import {
  Bot,
  ChartNoAxesCombined,
  FileText,
  FolderKanban,
  House,
  SunMedium,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const steps: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: House,
    title: 'Your Home dashboard',
    body: 'Tasks, projects, calendar, goals and reminders in one calm overview. Complete tasks right from here.',
  },
  {
    icon: Bot,
    title: 'Vincify AI knows your context',
    body: 'Ask the assistant to plan your day, break down projects or review your week — it understands your tasks, goals and timetable.',
  },
  {
    icon: SunMedium,
    title: 'Plan with a Daily Check-in',
    body: 'Set your main objective and top 3 priorities each morning, then review what actually happened at the end of the day.',
  },
  {
    icon: FileText,
    title: 'Upload a timetable',
    body: 'Drop in a timetable and Vincify extracts time, module, type, instructor and venue for you to review before it reaches your calendar.',
  },
  {
    icon: FolderKanban,
    title: 'Projects with real structure',
    body: 'Objectives, milestones, notes, custom tables and resources — a dedicated workspace for every ambition.',
  },
  {
    icon: ChartNoAxesCombined,
    title: 'Measure your progress',
    body: 'Reports built from your real activity show completion rates, consistency and trends over time.',
  },
]

export function OnboardingTour({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [step, setStep] = useState(0)
  const current = steps[step]!
  const Icon = current.icon
  const last = step === steps.length - 1

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setStep(0)
      }}
    >
      <DialogContent className="overflow-hidden p-0 sm:max-w-md">
        <div className="relative h-36 bg-[#17152a]">
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(18rem 9rem at 30% 40%, rgb(236 72 153 / 0.35), transparent 70%), radial-gradient(18rem 10rem at 75% 60%, rgb(139 92 246 / 0.45), transparent 70%)',
            }}
          />
          <div className="relative flex h-full items-center justify-center">
            <span className="grid size-16 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
              <Icon className="size-7 text-white" strokeWidth={1.6} />
            </span>
          </div>
        </div>
        <div className="px-6 pt-2 pb-6">
          <p className="text-xs font-medium text-brand-deep">
            Step {step + 1} of {steps.length}
          </p>
          <DialogTitle className="mt-1 text-lg">{current.title}</DialogTitle>
          <DialogDescription className="mt-2 leading-relaxed">
            {current.body}
          </DialogDescription>
          <div className="mt-6 flex items-center justify-between">
            <div className="flex gap-1.5" aria-hidden="true">
              {steps.map((s, i) => (
                <span
                  key={s.title}
                  className={cn(
                    'h-1.5 rounded-full transition-all motion-reduce:transition-none',
                    i === step ? 'w-5 bg-brand-gradient' : 'w-1.5 bg-slate-200',
                  )}
                />
              ))}
            </div>
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              )}
              <Button
                size="sm"
                className="bg-brand-gradient shadow-glow hover:opacity-95"
                onClick={() => (last ? onOpenChange(false) : setStep(step + 1))}
              >
                {last ? 'Start using Vincify' : 'Next'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
