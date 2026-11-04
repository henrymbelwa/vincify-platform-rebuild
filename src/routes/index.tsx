import { useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  BarChart3,
  Bot,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  FileText,
  GraduationCap,
  ListChecks,
  Presentation,
  Rocket,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'

import { Logo, LogoMark } from '@/components/brand/logo'
import { Splash } from '@/components/brand/splash'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Vincify - Plan with intention. Execute with discipline.' },
      { name: 'description', content: 'Vincify is your personal AI-powered environment for planning, managing and achieving more.' },
      { property: 'og:title', content: 'Vincify - Your personal productivity operating system' },
      { property: 'og:description', content: 'Tasks, daily planning, projects, documents and an AI assistant in one private workspace.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: Home,
})

const SPLASH_KEY = 'vincify:splash-seen'

/** Show the brand splash once per browser session, then fade it out. */
function useSessionSplash() {
  const [phase, setPhase] = useState<'hidden' | 'shown' | 'leaving'>('hidden')

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SPLASH_KEY)) return
      sessionStorage.setItem(SPLASH_KEY, '1')
    } catch {
      return
    }
    const show = window.setTimeout(() => setPhase('shown'), 0)
    const leave = window.setTimeout(() => setPhase('leaving'), 1400)
    const done = window.setTimeout(() => setPhase('hidden'), 1900)
    return () => {
      window.clearTimeout(show)
      window.clearTimeout(leave)
      window.clearTimeout(done)
    }
  }, [])

  return phase
}

const pillars = [
  {
    icon: Target,
    title: 'Plan with intention',
    body: 'Set a main objective each morning, pick your top three priorities and map out the week ahead.',
  },
  {
    icon: CheckCircle2,
    title: 'Execute with discipline',
    body: 'Work from one list of tasks, projects and events - with list, board and timeline views.',
  },
  {
    icon: BarChart3,
    title: 'Measure your progress',
    body: 'Compare what you planned with what you actually did, every single day.',
  },
  {
    icon: TrendingUp,
    title: 'Improve continuously',
    body: 'Insights drawn from your real activity show where your time goes and what to change.',
  },
]

const features = [
  {
    icon: ListChecks,
    title: 'My Tasks',
    body: 'Capture, prioritise and finish work with filters, sorting and three ways to view it.',
    to: '/app/tasks' as const,
  },
  {
    icon: CalendarCheck,
    title: 'Daily Check-in',
    body: 'A guided daily plan, weekly and monthly goals, and an honest end-of-day review.',
    to: '/app/check-in' as const,
  },
  {
    icon: Bot,
    title: 'AI Assistant',
    body: 'Ask questions, attach documents and turn conversations into structured plans.',
    to: '/app/assistant' as const,
  },
  {
    icon: Sparkles,
    title: 'Dashboard',
    body: "Today's tasks, projects, events, goals and reminders together on one screen.",
    to: '/app' as const,
  },
]

const comingSoon = [
  { icon: FileText, label: 'Document & timetable intelligence' },
  { icon: Briefcase, label: 'Project workspaces' },
  { icon: BarChart3, label: 'Reports & analytics' },
  { icon: Rocket, label: 'Automations & reminders' },
]

const audiences = [
  {
    icon: GraduationCap,
    title: 'Students',
    body: 'Balance classes, assignments and personal growth.',
  },
  {
    icon: Presentation,
    title: 'Teachers',
    body: 'Coordinate lessons, research and admin work.',
  },
  {
    icon: Briefcase,
    title: 'Professionals',
    body: 'Stay on top of meetings, reports and deadlines.',
  },
  {
    icon: Rocket,
    title: 'Entrepreneurs',
    body: 'Turn business goals into day-to-day execution.',
  },
]

function Home() {
  const splash = useSessionSplash()

  return (
    <div className="min-h-screen bg-background text-foreground">
      {splash !== 'hidden' && <Splash leaving={splash === 'leaving'} />}

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="Vincify home">
            <Logo size={28} />
          </Link>
          <nav aria-label="Main" className="flex items-center gap-2">
            <a
              href="#features"
              className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none sm:inline-block"
            >
              Features
            </a>
            <a
              href="#who"
              className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none sm:inline-block"
            >
              Who it's for
            </a>
            <Button asChild size="sm" className="bg-brand-gradient shadow-glow">
              <Link to="/app">
                Open workspace
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(40rem 24rem at 20% 0%, rgb(236 72 153 / 0.12), transparent 70%), radial-gradient(44rem 28rem at 85% 10%, rgb(139 92 246 / 0.16), transparent 70%)',
            }}
          />
          <div className="relative mx-auto grid max-w-content items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <Badge variant="secondary" className="mb-6 gap-1.5">
                <Sparkles aria-hidden="true" className="size-3.5" />
                Your personal operating system for productivity
              </Badge>
              <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Plan with intention.{' '}
                <span className="text-brand-gradient">
                  Execute with discipline.
                </span>
              </h1>
              <p className="mt-6 max-w-reading text-lg text-muted-foreground">
                Vincify brings your tasks, daily planning, projects and an AI
                assistant into one place, so you always know what needs your
                attention, what you've achieved and what comes next.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="bg-brand-gradient shadow-glow"
                >
                  <Link to="/auth" search={{ mode: 'signup' }}>
                    Create your account
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/auth" search={{ mode: 'signin' }}>
                    Sign in
                  </Link>
                </Button>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Free to start. Your data stays private to your account.
              </p>
            </div>

            <HeroPreview />
          </div>
        </section>

        {/* Philosophy */}
        <section
          aria-labelledby="pillars-heading"
          className="border-y border-border/60 bg-muted/40"
        >
          <div className="mx-auto max-w-content px-4 py-16 sm:px-6">
            <h2
              id="pillars-heading"
              className="font-display text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              One loop for getting things done
            </h2>
            <p className="mt-3 max-w-reading text-muted-foreground">
              Every part of Vincify is built around four habits that compound
              over time.
            </p>
            <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {pillars.map((p, i) => (
                <li
                  key={p.title}
                  className="rounded-xl border border-border bg-card p-6 shadow-soft"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-brand-gradient text-white">
                      <p.icon aria-hidden="true" className="size-5" />
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="mt-4 font-semibold">{p.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section id="features" aria-labelledby="features-heading">
          <div className="mx-auto max-w-content px-4 py-16 sm:px-6 md:py-24">
            <h2
              id="features-heading"
              className="font-display text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              Everything you need, in one workspace
            </h2>
            <p className="mt-3 max-w-reading text-muted-foreground">
              Every module is available the moment you sign in.
            </p>
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {features.map((f) => (
                <Link
                  key={f.title}
                  to={f.to}
                  className="group rounded-xl border border-border bg-card p-6 shadow-soft transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <f.icon aria-hidden="true" className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="flex items-center gap-2 font-semibold">
                        {f.title}
                        <ArrowRight
                          aria-hidden="true"
                          className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                        />
                      </h3>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        {f.body}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-10 rounded-xl border border-dashed border-border p-6">
              <h3 className="text-sm font-semibold">On the way</h3>
              <ul className="mt-4 flex flex-wrap gap-3">
                {comingSoon.map((c) => (
                  <li
                    key={c.label}
                    className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground"
                  >
                    <c.icon aria-hidden="true" className="size-4" />
                    {c.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Audiences */}
        <section
          id="who"
          aria-labelledby="who-heading"
          className="border-t border-border/60 bg-muted/40"
        >
          <div className="mx-auto max-w-content px-4 py-16 sm:px-6">
            <h2
              id="who-heading"
              className="font-display text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              Built for people with a lot on their plate
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {audiences.map((a) => (
                <div key={a.title}>
                  <a.icon aria-hidden="true" className="size-6 text-primary" />
                  <h3 className="mt-3 font-semibold">{a.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section aria-labelledby="cta-heading">
          <div className="mx-auto max-w-content px-4 py-16 sm:px-6 md:py-24">
            <div className="relative overflow-hidden rounded-2xl bg-brand-gradient px-6 py-12 text-center text-white shadow-glow sm:px-12">
              <LogoMark size={48} className="mx-auto" />
              <h2
                id="cta-heading"
                className="mt-6 font-display text-2xl font-semibold tracking-tight sm:text-3xl"
              >
                Measure your progress. Improve continuously.
              </h2>
              <p className="mx-auto mt-3 max-w-reading text-white/85">
                Create your account and plan your first day with Vincify.
              </p>
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="mt-8 bg-white text-brand-deep hover:bg-white/90"
              >
                <Link to="/app">
                  Open workspace
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-content flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <Logo size={22} />
          <p>© {new Date().getFullYear()} Vincify. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

/** Decorative illustration of the dashboard layout (not user data). */
function HeroPreview() {
  const rows = [
    { label: 'Draft quarterly report', tag: 'High', done: true },
    { label: 'Prepare lesson slides', tag: 'Medium', done: false },
    { label: 'Review project milestones', tag: 'High', done: false },
  ]
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-soft"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            Today's main objective
          </p>
          <p className="mt-0.5 font-semibold">Ship the quarterly report</p>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          Day 12 streak
        </span>
      </div>

      <div className="mt-5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Daily progress</span>
          <span>1 of 3</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/3 rounded-full bg-brand-gradient" />
        </div>
      </div>

      <ul className="mt-5 space-y-2">
        {rows.map((r) => (
          <li
            key={r.label}
            className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
          >
            <CheckCircle2
              className={
                r.done
                  ? 'size-4 text-primary'
                  : 'size-4 text-muted-foreground/50'
              }
            />
            <span
              className={
                r.done
                  ? 'flex-1 text-sm text-muted-foreground line-through'
                  : 'flex-1 text-sm'
              }
            >
              {r.label}
            </span>
            <span className="text-xs text-muted-foreground">{r.tag}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex items-start gap-3 rounded-lg bg-muted p-3">
        <Bot className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-xs text-muted-foreground">
          You finish most deep work before noon - try scheduling the report
          review for tomorrow morning.
        </p>
      </div>
    </div>
  )
}
