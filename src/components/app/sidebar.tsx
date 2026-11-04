import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronsLeft, ChevronsRight, LogOut, MoreHorizontal, Settings, UserRound } from 'lucide-react'
import { Logo, LogoMark } from '@/components/brand/logo'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { navGroups, type NavItem } from '@/lib/navigation'
import { initials, useWorkspace } from '@/lib/workspace'
import { cn } from '@/lib/utils'

const itemBase =
  'group relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-accent hover:text-foreground motion-reduce:transition-none'
const itemActive =
  'bg-accent text-accent-foreground before:absolute before:inset-y-2 before:-left-3 before:w-[3px] before:rounded-r-full before:bg-brand-gradient'

function NavLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem
  collapsed: boolean
  onNavigate?: () => void
}) {
  const Icon = item.icon
  const inner = (
    <>
      <Icon className="size-[17px] shrink-0 group-data-[status=active]:text-brand-deep" strokeWidth={1.8} />
      <span className={cn('truncate', collapsed && 'sr-only')}>{item.label}</span>
    </>
  )
  const link =
    'path' in item ? (
      <Link
        to={item.path}
        activeOptions={{ exact: item.path === '/app' }}
        className={cn(itemBase, collapsed && 'justify-center px-0')}
        activeProps={{ className: itemActive }}
        onClick={onNavigate}
      >
        {inner}
      </Link>
    ) : (
      <Link
        to="/app/$section"
        params={{ section: item.section }}
        className={cn(itemBase, collapsed && 'justify-center px-0')}
        activeProps={{ className: itemActive }}
        onClick={onNavigate}
      >
        {inner}
      </Link>
    )
  if (!collapsed) return link
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  )
}

export function SidebarContent({
  collapsed = false,
  onToggle,
  onNavigate,
}: {
  collapsed?: boolean
  onToggle?: () => void
  onNavigate?: () => void
}) {
  const { user } = useWorkspace()
  const navigate = useNavigate()

  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-16 items-center px-4', collapsed ? 'justify-center' : 'justify-between')}>
        <Link to="/app" aria-label="Vincify home" onClick={onNavigate}>
          {collapsed ? <LogoMark size={30} /> : <Logo size={28} />}
        </Link>
        {onToggle && !collapsed && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse sidebar"
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronsLeft className="size-4" />
          </button>
        )}
      </div>

      <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto px-3 pt-2 pb-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p
              className={cn(
                'mb-1.5 px-2.5 text-[10.5px] font-semibold tracking-[0.12em] text-slate-400 uppercase',
                collapsed && 'sr-only',
              )}
            >
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.label}>
                  <NavLink item={item} collapsed={collapsed} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
        {onToggle && collapsed && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Expand sidebar"
            className="mx-auto grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronsRight className="size-4" />
          </button>
        )}
      </nav>

      {!collapsed && (
        <div className="mx-3 mb-3 overflow-hidden rounded-xl bg-[#17152a] p-4 text-white">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <LogoMark size={18} /> Invite & earn
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-white/65">
            Share Vincify with friends and earn points for every verified sign-up.
          </p>
          <Link
            to="/app/$section"
            params={{ section: 'rewards' }}
            onClick={onNavigate}
            className="mt-3 inline-flex h-7 items-center rounded-md bg-white px-2.5 text-xs font-medium text-[#17152a] hover:bg-white/90"
          >
            Invite friends
          </Link>
        </div>
      )}

      <div className="border-t p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-3 rounded-lg p-1.5 text-left hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                collapsed && 'justify-center',
              )}
              aria-label="Account menu"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-gradient text-xs font-semibold text-white">
                {initials(user.fullName)}
              </span>
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{user.fullName}</span>
                    <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                  </span>
                  <MoreHorizontal className="size-4 text-muted-foreground" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <span className="block text-sm font-medium">{user.fullName}</span>
              <span className="block text-xs text-muted-foreground">{user.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate({ to: '/app/$section', params: { section: 'profile' } })}>
              <UserRound /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate({ to: '/app/$section', params: { section: 'settings' } })}>
              <Settings /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => navigate({ to: '/login' })}>
              <LogOut /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
