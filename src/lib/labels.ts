import type { Project } from '@/lib/types'

export const projectStatusLabel: Record<Project['status'], string> = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
  archived: 'Archived',
}
