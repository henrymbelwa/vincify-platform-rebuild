-- Migration: 20261108000000_habits_admin_ai_usage.sql
-- Description:
-- 1. Create habits and habit_logs tables with RLS and owner enforcement
-- 2. Enhance planned_activities to link to tasks/projects
-- 3. Enhance reports with unique constraints per user/period/period_start
-- 4. Create admin roles, audit logs, ai_configs, and ai_usage_events tables

-- 1. Habits and Habit Logs
CREATE TABLE IF NOT EXISTS public.habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description text,
  frequency text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly')),
  target_days_per_week integer NOT NULL DEFAULT 7 CHECK (target_days_per_week BETWEEN 1 AND 7),
  category text,
  color text,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.habit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id uuid NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  completed_date date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT habit_logs_user_habit_date_key UNIQUE (user_id, habit_id, completed_date)
);

-- RLS & triggers for habits & habit_logs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habits TO authenticated;
GRANT ALL ON public.habits TO service_role;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all_habits" ON public.habits FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER touch_habits BEFORE UPDATE ON public.habits FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.habit_logs TO authenticated;
GRANT ALL ON public.habit_logs TO service_role;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all_habit_logs" ON public.habit_logs FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER check_habit_log_owner BEFORE INSERT OR UPDATE ON public.habit_logs FOR EACH ROW EXECUTE FUNCTION public.assert_same_owner('habit_id', 'habits');

-- 2. Link planned_activities to tasks or projects
ALTER TABLE public.planned_activities
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

-- 3. Reports unique constraint to prevent duplicate snapshots
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reports_user_period_start_key'
  ) THEN
    ALTER TABLE public.reports ADD CONSTRAINT reports_user_period_start_key UNIQUE (user_id, period, period_start);
  END IF;
END $$;

-- 4. Admin roles, AI configurations, AI usage events, and Audit logs
CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin', 'auditor')),
  is_active boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT false,
  password_changed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- AI Configuration (provider, models, credentials encrypted or server-env references)
CREATE TABLE IF NOT EXISTS public.ai_configurations (
  id text PRIMARY KEY DEFAULT 'default',
  active_provider text NOT NULL DEFAULT 'gemini',
  fallback_provider text,
  fallback_enabled boolean NOT NULL DEFAULT false,
  model_name text NOT NULL DEFAULT 'gemini-3.5-flash-lite',
  api_base_url text,
  encrypted_api_key text,
  timeout_ms integer NOT NULL DEFAULT 45000,
  daily_analysis_limit integer NOT NULL DEFAULT 3,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- AI Usage Events: detailed tracking per request
CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  feature text NOT NULL CHECK (feature IN ('assistant', 'document_summary', 'timetable_analysis', 'system_test')),
  provider text NOT NULL,
  model text NOT NULL,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  estimated_cost_usd numeric(10, 6) DEFAULT 0,
  duration_ms integer,
  status text NOT NULL CHECK (status IN ('succeeded', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Admin Audit Logs
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_email text,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Platform Settings (maintenance mode, limit toggles, etc.)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Admin User verification function
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = _user_id AND is_active = true
  );
$$;

-- Secure RLS policies for admin tables
GRANT SELECT ON public.admin_users TO authenticated;
GRANT ALL ON public.admin_users TO service_role;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_view_own_role" ON public.admin_users FOR SELECT TO authenticated USING (id = auth.uid());

GRANT SELECT ON public.ai_configurations TO authenticated;
GRANT ALL ON public.ai_configurations TO service_role;
ALTER TABLE public.ai_configurations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_view_ai_config" ON public.ai_configurations FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

GRANT SELECT ON public.ai_usage_events TO authenticated;
GRANT ALL ON public.ai_usage_events TO service_role;
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_view_own_usage" ON public.ai_usage_events FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

GRANT SELECT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_view_audit_logs" ON public.admin_audit_logs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_platform_settings" ON public.platform_settings FOR SELECT TO authenticated USING (true);
