-- Migration: 20261108070000_reconcile_missing_admin_ai_schema.sql
-- Description:
-- Safe, fully non-destructive, idempotent reconciliation migration.
-- ZERO data deletion: all DELETE, TRUNCATE, DROP statements are completely prohibited.
--
-- Objects covered:
-- 1. Adds planned_activities.task_id and planned_activities.project_id conditionally.
-- 2. Checks public.reports for duplicates. If found, raises an exception and halts without touching data.
--    If no duplicates exist, conditionally applies the unique constraint.
-- 3. Creates public.admin_users (with table-specific trigger check and RLS).
-- 4. Creates public.is_admin() helper function.
-- 5. Creates public.ai_configurations (with default seed, table-specific trigger, and RLS).
-- 6. Creates public.ai_usage_events (with indexes and RLS).
-- 7. Creates public.admin_audit_logs (with index and RLS).
-- 8. Creates public.platform_settings (with table-specific trigger check and RLS).

-- ============================================================================
-- 1. Enhance planned_activities with optional task and project links
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'planned_activities' AND column_name = 'task_id'
  ) THEN
    ALTER TABLE public.planned_activities
      ADD COLUMN task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'planned_activities' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE public.planned_activities
      ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_planned_activities_task ON public.planned_activities(task_id);
CREATE INDEX IF NOT EXISTS idx_planned_activities_project ON public.planned_activities(project_id);

-- ============================================================================
-- 2. Validate public.reports for duplicates and apply UNIQUE constraint safely
-- ============================================================================
DO $$
DECLARE
  dup_count integer := 0;
BEGIN
  -- Check if duplicate snapshots exist for (user_id, period, period_start)
  SELECT count(*) INTO dup_count
  FROM (
    SELECT user_id, period, period_start
    FROM public.reports
    GROUP BY user_id, period, period_start
    HAVING count(*) > 1
  ) dups;

  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Cannot apply unique constraint reports_user_period_start_key: % set(s) of duplicate report records detected. No data has been modified. Please review duplicates manually before reapplying.', dup_count;
  END IF;

  -- If no duplicates exist, add unique constraint conditionally
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reports_user_period_start_key'
      AND conrelid = 'public.reports'::regclass
  ) THEN
    ALTER TABLE public.reports
      ADD CONSTRAINT reports_user_period_start_key UNIQUE (user_id, period, period_start);
  END IF;
END $$;

-- ============================================================================
-- 3. Admin Roles Table & is_admin() verification function
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin', 'auditor')),
  is_active boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT false,
  password_changed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger check verifying BOTH trigger name AND target table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'touch_admin_users'
      AND tgrelid = 'public.admin_users'::regclass
  ) THEN
    CREATE TRIGGER touch_admin_users
      BEFORE UPDATE ON public.admin_users
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;

-- Admin authorization verification function
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

GRANT SELECT ON public.admin_users TO authenticated;
GRANT ALL ON public.admin_users TO service_role;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_users'
      AND policyname = 'admin_view_own_role'
  ) THEN
    CREATE POLICY "admin_view_own_role" ON public.admin_users
      FOR SELECT TO authenticated USING (id = auth.uid());
  END IF;
END $$;

-- ============================================================================
-- 4. AI Configurations (Vault for provider models and encrypted API keys)
-- ============================================================================
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

-- Seed default configuration record only if not already present
INSERT INTO public.ai_configurations (id, active_provider, model_name, timeout_ms, daily_analysis_limit)
VALUES ('default', 'gemini', 'gemini-3.5-flash-lite', 45000, 3)
ON CONFLICT (id) DO NOTHING;

-- Trigger check verifying BOTH trigger name AND target table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'touch_ai_configurations'
      AND tgrelid = 'public.ai_configurations'::regclass
  ) THEN
    CREATE TRIGGER touch_ai_configurations
      BEFORE UPDATE ON public.ai_configurations
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;

GRANT SELECT ON public.ai_configurations TO authenticated;
GRANT ALL ON public.ai_configurations TO service_role;
ALTER TABLE public.ai_configurations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_configurations'
      AND policyname = 'admin_view_ai_config'
  ) THEN
    CREATE POLICY "admin_view_ai_config" ON public.ai_configurations
      FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
  END IF;
END $$;

-- ============================================================================
-- 5. AI Usage Events (Detailed telemetry per AI generation)
-- ============================================================================
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

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user_created ON public.ai_usage_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_status ON public.ai_usage_events(status);

GRANT SELECT ON public.ai_usage_events TO authenticated;
GRANT ALL ON public.ai_usage_events TO service_role;
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_usage_events'
      AND policyname = 'user_view_own_usage'
  ) THEN
    CREATE POLICY "user_view_own_usage" ON public.ai_usage_events
      FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
  END IF;
END $$;

-- ============================================================================
-- 6. Admin Audit Logs (Administrative actions & bootstrap tracking)
-- ============================================================================
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

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON public.admin_audit_logs(created_at DESC);

GRANT SELECT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_audit_logs'
      AND policyname = 'admin_view_audit_logs'
  ) THEN
    CREATE POLICY "admin_view_audit_logs" ON public.admin_audit_logs
      FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
  END IF;
END $$;

-- ============================================================================
-- 7. Platform Settings (Global key-value feature toggles)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger check verifying BOTH trigger name AND target table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'touch_platform_settings'
      AND tgrelid = 'public.platform_settings'::regclass
  ) THEN
    CREATE TRIGGER touch_platform_settings
      BEFORE UPDATE ON public.platform_settings
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;

GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'platform_settings'
      AND policyname = 'read_platform_settings'
  ) THEN
    CREATE POLICY "read_platform_settings" ON public.platform_settings
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
