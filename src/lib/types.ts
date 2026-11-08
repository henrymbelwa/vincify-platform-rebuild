export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'postponed' | 'cancelled'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export interface Profile {
  id: string
  full_name: string
  preferred_name: string
  phone: string | null
  occupation: string | null
  organization: string | null
  goals: string[]
  timezone: string
  work_start: string | null
  work_end: string | null
  onboarded: boolean
}

export interface Task {
  id: string
  user_id: string
  project_id: string | null
  goal_id: string | null
  title: string
  description: string | null
  category: string | null
  priority: Priority
  status: TaskStatus
  due_at: string | null
  completed_at: string | null
  created_at: string
}

export interface Project {
  id: string
  name: string
  description: string | null
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'archived'
  color: string
  start_date: string | null
  due_date: string | null
  created_at: string
}

export interface Goal {
  id: string
  title: string
  description: string | null
  horizon: 'week' | 'month' | 'quarter' | 'year'
  target_date: string | null
  progress: number
  achieved_at: string | null
}

export interface CalendarEvent {
  id: string
  title: string
  description: string | null
  location: string | null
  starts_at: string
  ends_at: string
  all_day: boolean
  remind_minutes: number | null
  project_id: string | null
}

export interface TimetableEntry {
  id: string
  timetable_id: string
  title: string
  weekday: number
  start_time: string
  end_time: string
  location: string | null
}

export interface Notification {
  id: string
  category: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

export interface DocumentRow {
  id: string
  name: string
  storage_path: string
  mime_type: string
  size_bytes: number
  status: 'uploaded' | 'processing' | 'ready' | 'failed'
  summary: string | null
  created_at: string
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface Habit {
  id: string
  user_id: string
  title: string
  description: string | null
  frequency: 'daily' | 'weekly'
  target_days_per_week: number
  category: string | null
  color: string | null
  archived: boolean
  created_at: string
  updated_at: string
}

export interface HabitLog {
  id: string
  user_id: string
  habit_id: string
  completed_date: string
  notes: string | null
  created_at: string
}

export interface PlannedActivity {
  id: string
  user_id: string
  checkin_id: string | null
  task_id: string | null
  project_id: string | null
  title: string
  starts_at: string | null
  ends_at: string | null
  done: boolean
  created_at: string
  updated_at: string
}

export interface SavedReport {
  id: string
  user_id: string
  period: 'daily' | 'weekly' | 'monthly'
  period_start: string
  period_end: string
  data: Record<string, any>
  narrative: string | null
  created_at: string
  updated_at: string
}

export interface AdminUser {
  id: string
  role: 'superadmin' | 'admin' | 'auditor'
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AiConfigurationRecord {
  id: string
  active_provider: string
  fallback_provider: string | null
  fallback_enabled: boolean
  model_name: string
  api_base_url: string | null
  timeout_ms: number
  daily_analysis_limit: number
  settings: Record<string, any>
  updated_at: string
}

export interface AiUsageEvent {
  id: string
  user_id: string | null
  feature: string
  provider: string
  model: string
  input_tokens: number | null
  output_tokens: number | null
  total_tokens: number | null
  estimated_cost_usd: number
  duration_ms: number | null
  status: 'succeeded' | 'failed'
  error_message: string | null
  created_at: string
}

export interface AdminAuditLog {
  id: string
  admin_id: string | null
  admin_email: string | null
  action: string
  target_type: string
  target_id: string | null
  details: Record<string, any>
  ip_address: string | null
  created_at: string
}
