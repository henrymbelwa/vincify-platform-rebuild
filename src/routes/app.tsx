import { useEffect, useState } from 'react'
import { Link, Outlet, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Bell, Menu, Search, Sparkles } from 'lucide-react'
import { z } from 'zod'
import { SidebarContent } from '@/components/app/sidebar'
import { OnboardingTour } from '@/components/app/onboarding-tour'
import { ThemeToggle } from '@/components/app/theme-toggle'
import { LogoMark } from '@/components/brand/logo'
import { Splash } from '@/components/brand/splash'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { sb } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/app')({
  ssr: false,
  validateSearch: z.object({ tour: z.coerce.number().optional() }),
  beforeLoad: async () => {
    const client = sb()
    const { data } = await client.auth.getSession()
    if (!data.session) throw redirect({ to: '/auth' })
    const { data: profile } = await client.from('profiles').select('onboarded').eq('id', data.session.user.id).maybeSingle()
    if (!profile?.onboarded) throw redirect({ to: '/onboarding' })
  },
  head: () => ({ meta: [{ title: 'Vincify workspace' }, { name: 'robots', content: 'noindex' }] }),
  pendingComponent: () => <Splash />,
  component: AppLayout,
})

const COLLAPSE_KEY = 'vincify.sidebar.collapsed'

function AppLayout() {
  const { tour } = Route.useSearch()
  const { session, ready } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1')
  }, [])
  useEffect(() => {
    if (tour === 1) setTourOpen(true)
  }, [tour])
  useEffect(() => {
    if (ready && !session) navigate({ to: '/auth', replace: true })
  }, [ready, session, navigate])

  const unread = useQuery({
    queryKey: ['notifications', 'unread'],
    enabled: Boolean(session),
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count } = await sb().from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null)
      return count ?? 0
    },
  })

  if (!session) return <Splash />

  const toggle = () =>
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      return !c
    })

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden border-r bg-sidebar transition-[width] duration-200 motion-reduce:transition-none lg:block',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        <SidebarContent collapsed={collapsed} onToggle={toggle} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Vincify main navigation</SheetDescription>
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className={cn('transition-[padding] duration-200 motion-reduce:transition-none', collapsed ? 'lg:pl-[72px]' : 'lg:pl-64')}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b bg-background/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur sm:gap-3 sm:px-6">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
            <Menu />
          </Button>
          <Link to="/app" className="lg:hidden" aria-label="Vincify home">
            <LogoMark size={26} />
          </Link>
          <form
            className="relative hidden max-w-sm flex-1 sm:block"
            onSubmit={(e) => {
              e.preventDefault()
              if (query.trim()) navigate({ to: '/app/tasks', search: { q: query.trim() } })
            }}
          >
            <label htmlFor="global-search" className="sr-only">
              Search tasks
            </label>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="global-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks"
              className="h-9 w-full rounded-lg border bg-card pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </form>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" size="sm" className="hidden text-muted-foreground md:inline-flex" onClick={() => setTourOpen(true)}>
              Take the tour
            </Button>
            <ThemeToggle />
            <Button asChild variant="ghost" size="icon-sm" aria-label={`Notifications${unread.data ? `, ${unread.data} unread` : ''}`} className="relative">
              <Link to="/app/notifications">
                <Bell />
                {Boolean(unread.data) && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-brand-pink" />}
              </Link>
            </Button>
            <Button asChild size="sm" variant="brand">
              <Link to="/app/assistant">
                <Sparkles /> <span className="hidden sm:inline">Ask AI</span>
              </Link>
            </Button>
          </div>
        </header>
        <main className="px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
      <OnboardingTour open={tourOpen} onOpenChange={setTourOpen} />
    </div>
  )
}
