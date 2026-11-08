import { useState, useEffect } from 'react'
import { Link, Outlet, createFileRoute, redirect, useLocation, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Activity,
  Bot,
  Cpu,
  FileText,
  KeyRound,
  LayoutDashboard,
  LogOut,
  ShieldAlert,
  Sliders,
  Users,
} from 'lucide-react'
import { Logo, LogoMark } from '@/components/brand/logo'
import { Splash } from '@/components/brand/splash'
import { RouteErrorPage } from '@/components/error-pages'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ThemeToggle } from '@/components/app/theme-toggle'
import { checkIsAdmin, completeAdminPasswordChange } from '@/lib/admin-middleware'
import { signOut, useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { sb } from '@/lib/supabase'

export const Route = createFileRoute('/admin')({
  ssr: false,
  beforeLoad: async () => {
    const client = sb()
    const { data } = await client.auth.getSession()
    if (!data.session) {
      throw redirect({
        to: '/auth',
        search: { mode: 'signin', redirect: '/admin' } as any,
      })
    }

    try {
      const res = await checkIsAdmin()
      if (!res.isAdmin) {
        throw redirect({ to: '/app' })
      }
      return { admin: res }
    } catch (err: any) {
      // If the error was already a TanStack Router redirect, rethrow it
      if (err && typeof err === 'object' && ('to' in err || 'href' in err || 'status' in err || 'statusCode' in err)) {
        throw err
      }
      console.error('[AdminRoute:beforeLoad] Admin verification check failed:', err)
      // DO NOT redirect to /app on server or verification errors: let errorComponent render the error state
      throw err
    }
  },
  head: () => ({
    meta: [{ title: 'Vincify Administrator Portal' }, { name: 'robots', content: 'noindex,nofollow' }],
  }),
  errorComponent: RouteErrorPage,
  pendingComponent: () => <Splash />,
  component: AdminLayout,
})

const adminNav = [
  { label: 'Overview', icon: LayoutDashboard, path: '/admin' },
  { label: 'AI Control Centre', icon: Cpu, path: '/admin/ai' },
  { label: 'User Management', icon: Users, path: '/admin/users' },
  { label: 'Documents & Analysis', icon: FileText, path: '/admin/documents' },
  { label: 'API & Resource Monitor', icon: Activity, path: '/admin/monitoring' },
  { label: 'Audit Logs', icon: ShieldAlert, path: '/admin/audit' },
  { label: 'System Settings', icon: Sliders, path: '/admin/settings' },
]

function AdminLayout() {
  const { session, ready } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const adminCheck = useQuery({
    queryKey: ['admin_check'],
    queryFn: () => checkIsAdmin(),
    staleTime: 30_000,
  })

  useEffect(() => {
    if (ready && !session) {
      navigate({ to: '/auth', replace: true })
    }
  }, [ready, session, navigate])

  if (!session || adminCheck.isLoading) return <Splash />

  // If check returned not admin and finished loading without throwing, show Access Denied rather than blind redirect
  if (adminCheck.data && !adminCheck.data.isAdmin) {
    return (
      <main className="grid min-h-svh place-items-center px-6 text-center">
        <div className="max-w-sm space-y-4">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="size-6" />
          </div>
          <h1 className="text-xl font-semibold">Access Denied</h1>
          <p className="text-sm text-muted-foreground">
            Your account does not have active administrative privileges for the Vincify Central Administration.
          </p>
          <div className="pt-2">
            <Button onClick={() => navigate({ to: '/app', replace: true })}>
              Return to Workspace
            </Button>
          </div>
        </div>
      </main>
    )
  }

  // If initial password change is mandatory, enforce screen blocker
  if (adminCheck.data?.mustChangePassword) {
    return <MandatoryPasswordChangeScreen onComplete={() => queryClient.invalidateQueries({ queryKey: ['admin_check'] })} />
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-sidebar lg:block">
        <div className="flex h-16 items-center justify-between px-6 border-b">
          <Link to="/admin" className="flex items-center gap-2">
            <Logo size={26} />
            <span className="rounded bg-brand-purple/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand-purple uppercase tracking-wider">
              Admin
            </span>
          </Link>
        </div>

        <nav className="space-y-1 p-4">
          <div className="mb-2 px-3 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Platform Administration
          </div>
          {adminNav.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.path}
                to={item.path}
                activeOptions={{ exact: item.path === '/admin' }}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                activeProps={{ className: 'bg-accent text-accent-foreground font-semibold' }}
              >
                <Icon className="size-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="absolute inset-x-0 bottom-0 border-t p-4 space-y-2">
          <Link to="/app" className="block text-center text-xs text-muted-foreground hover:text-foreground">
            &larr; Back to User Workspace
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-destructive"
            onClick={async () => {
              await signOut()
              navigate({ to: '/auth' })
            }}
          >
            <LogOut className="size-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/85 px-6 backdrop-blur">
          <div className="flex items-center gap-2 lg:hidden">
            <LogoMark size={24} />
            <span className="font-semibold text-sm">Vincify Admin</span>
          </div>

          <div className="hidden lg:block text-xs text-muted-foreground font-mono">
            Vincify Central Administration & Control Plane
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-500 border border-emerald-500/20">
              Operational
            </span>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function MandatoryPasswordChangeScreen({ onComplete }: { onComplete: () => void }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const navigate = useNavigate()

  const changeMutation = useMutation({
    mutationFn: (pwd: string) => completeAdminPasswordChange({ data: { newPassword: pwd } }),
    onSuccess: () => {
      toast.success('Administrator password updated successfully. Welcome to Vincify Admin.')
      onComplete()
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update password'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      return toast.error('Password must be at least 8 characters long')
    }
    if (newPassword !== confirmPassword) {
      return toast.error('Passwords do not match')
    }
    if (newPassword === 'admin') {
      return toast.error('You cannot reuse the temporary password')
    }
    changeMutation.mutate(newPassword)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-6 shadow-xl sm:p-8">
        <div className="space-y-2 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-brand-purple/10 text-brand-purple">
            <KeyRound className="size-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Set Permanent Password</h1>
          <p className="text-xs text-muted-foreground">
            You are signed in with the initial temporary superadmin credentials. To secure the administrator portal,
            you must establish a new permanent password before proceeding.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-pass">New Permanent Password</Label>
            <Input
              id="new-pass"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 chars, 1 uppercase, 1 number"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="conf-pass">Confirm Permanent Password</Label>
            <Input
              id="conf-pass"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
            />
          </div>

          <Button type="submit" className="w-full" disabled={changeMutation.isPending}>
            {changeMutation.isPending ? 'Updating Credentials...' : 'Save Password & Enter Portal'}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground"
            onClick={async () => {
              await signOut()
              navigate({ to: '/auth' })
            }}
          >
            Cancel and Sign Out
          </Button>
        </form>
      </div>
    </div>
  )
}
