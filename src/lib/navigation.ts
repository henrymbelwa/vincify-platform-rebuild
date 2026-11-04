import {
  Bell,
  Bot,
  CalendarDays,
  ChartNoAxesCombined,
  CircleCheckBig,
  FileText,
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

export type StaticPath = '/app' | '/app/assistant' | '/app/check-in' | '/app/tasks'

export type NavItem = {
  label: string
  icon: LucideIcon
} & ({ path: StaticPath } | { section: SectionSlug })

export type SectionSlug =
  | 'inbox'
  | 'calendar'
  | 'reports'
  | 'projects'
  | 'documents'
  | 'automations'
  | 'rewards'
  | 'notifications'
  | 'settings'
  | 'profile'

export const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Workspace',
    items: [
      { label: 'Home', icon: House, path: '/app' },
      { label: 'AI Assistant', icon: Bot, path: '/app/assistant' },
      { label: 'Daily Check-in', icon: SunMedium, path: '/app/check-in' },
      { label: 'My Tasks', icon: CircleCheckBig, path: '/app/tasks' },
      { label: 'Inbox', icon: Inbox, section: 'inbox' },
      { label: 'Calendar', icon: CalendarDays, section: 'calendar' },
      {
        label: 'Reports & Analytics',
        icon: ChartNoAxesCombined,
        section: 'reports',
      },
      { label: 'My Projects', icon: FolderKanban, section: 'projects' },
      { label: 'My Documents', icon: FileText, section: 'documents' },
    ],
  },
  {
    label: 'Automation & Growth',
    items: [
      { label: 'Automations', icon: Workflow, section: 'automations' },
      { label: 'Invite Friends & Rewards', icon: Gift, section: 'rewards' },
      { label: 'Notifications', icon: Bell, section: 'notifications' },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Settings', icon: Settings, section: 'settings' },
      { label: 'Profile', icon: UserRound, section: 'profile' },
    ],
  },
]

export interface SectionInfo {
  title: string
  icon: LucideIcon
  tagline: string
  milestone: number
  highlights: string[]
}

export const sections: Record<SectionSlug, SectionInfo> = {
  inbox: {
    title: 'Inbox',
    icon: Inbox,
    tagline:
      'One calm place to capture ideas, quick tasks and messages before you organise them.',
    milestone: 3,
    highlights: [
      'Quick capture from anywhere in Vincify',
      'Convert items into tasks, events or project notes',
      'AI triage suggestions you approve before anything changes',
    ],
  },
  calendar: {
    title: 'Calendar',
    icon: CalendarDays,
    tagline:
      'Daily, weekly and monthly views of classes, meetings, deadlines and milestones — in your timezone.',
    milestone: 3,
    highlights: [
      'Day, week and month views',
      'Timetable entries populated automatically after review',
      'Reminders and project-linked events',
    ],
  },
  reports: {
    title: 'Reports & Analytics',
    icon: ChartNoAxesCombined,
    tagline:
      'Turn your real activity into honest insight: completion rates, consistency and trends.',
    milestone: 6,
    highlights: [
      'KPIs for tasks, goals and projects',
      'Daily, weekly and monthly reports with comparisons',
      'Trend lines, heatmaps and PDF / CSV export',
    ],
  },
  projects: {
    title: 'My Projects',
    icon: FolderKanban,
    tagline:
      'A dedicated workspace for every project — objectives, milestones, notes, tables and resources.',
    milestone: 5,
    highlights: [
      'Objectives and visual milestone timelines',
      'Rich-text notes and custom tables',
      'Progress tracking and archiving with full history',
    ],
  },
  documents: {
    title: 'My Documents',
    icon: FileText,
    tagline:
      'Private document storage with automatic analysis — upload a timetable and get an organised schedule.',
    milestone: 4,
    highlights: [
      'Drag-and-drop PDF, DOCX, DOC and TXT uploads',
      'Automatic timetable extraction with review before saving',
      'Honest processing states: uploading, extracting, analysing',
    ],
  },
  automations: {
    title: 'Automations',
    icon: Workflow,
    tagline:
      'Let Vincify deliver summaries, reminders and reports through the channels you authorise.',
    milestone: 7,
    highlights: [
      'Email via secure OAuth authorisation',
      'WhatsApp through the official Business Platform',
      'Rules, schedules and a truthful delivery history',
    ],
  },
  rewards: {
    title: 'Invite Friends & Rewards',
    icon: Gift,
    tagline:
      'Share Vincify with your personal link and earn points for qualified referrals.',
    milestone: 8,
    highlights: [
      'Unique referral link with copy and share',
      'Points awarded only for verified sign-ups',
      'Built-in protection against self-referrals and abuse',
    ],
  },
  notifications: {
    title: 'Notifications',
    icon: Bell,
    tagline:
      'Classes, deadlines, milestones and AI recommendations — with full control over what reaches you.',
    milestone: 2,
    highlights: [
      'Read and unread history',
      'Per-category preferences',
      'In-app first, email and WhatsApp later',
    ],
  },
  settings: {
    title: 'Settings',
    icon: Settings,
    tagline:
      'Preferences, security, memory controls, integrations and your data — all in one place.',
    milestone: 2,
    highlights: [
      'Timezone, date and time formats',
      'Inspect, correct or disable AI memory',
      'Data export and account deletion',
    ],
  },
  profile: {
    title: 'Profile',
    icon: UserRound,
    tagline: 'How Vincify knows you: name, occupation and goals.',
    milestone: 2,
    highlights: [
      'Name, preferred name and occupation',
      'Productivity objectives used for personalisation',
      'Account information',
    ],
  },
}
