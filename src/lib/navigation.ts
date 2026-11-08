import {
  Bell,
  Bot,
  CalendarDays,
  ChartNoAxesCombined,
  CircleCheckBig,
  FileText,
  Flame,
  FolderKanban,
  Gift,
  House,
  Inbox,
  Settings,
  SunMedium,
  UserRound,
  Workflow,
  type LucideIcon,
} from 'lucide-react'

export type AppPath =
  | '/app'
  | '/app/assistant'
  | '/app/check-in'
  | '/app/tasks'
  | '/app/habits'
  | '/app/inbox'
  | '/app/calendar'
  | '/app/reports'
  | '/app/projects'
  | '/app/documents'
  | '/app/automations'
  | '/app/rewards'
  | '/app/notifications'
  | '/app/settings'
  | '/app/profile'

export interface NavItem {
  label: string
  icon: LucideIcon
  path: AppPath
}

export const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Workspace',
    items: [
      { label: 'Home', icon: House, path: '/app' },
      { label: 'AI Assistant', icon: Bot, path: '/app/assistant' },
      { label: 'Daily Check-in', icon: SunMedium, path: '/app/check-in' },
      { label: 'My Tasks', icon: CircleCheckBig, path: '/app/tasks' },
      { label: 'Habits & Streaks', icon: Flame, path: '/app/habits' },
      { label: 'Inbox', icon: Inbox, path: '/app/inbox' },
      { label: 'Calendar & Time-blocking', icon: CalendarDays, path: '/app/calendar' },
      { label: 'Reports & Analytics', icon: ChartNoAxesCombined, path: '/app/reports' },
      { label: 'My Projects', icon: FolderKanban, path: '/app/projects' },
      { label: 'My Documents', icon: FileText, path: '/app/documents' },
    ],
  },
  {
    label: 'Automation & Growth',
    items: [
      { label: 'Automations', icon: Workflow, path: '/app/automations' },
      { label: 'Invite Friends & Rewards', icon: Gift, path: '/app/rewards' },
      { label: 'Notifications', icon: Bell, path: '/app/notifications' },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Settings', icon: Settings, path: '/app/settings' },
      { label: 'Profile', icon: UserRound, path: '/app/profile' },
    ],
  },
]
