CREATE TABLE public.document_analysis_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
GRANT SELECT ON public.document_analysis_usage TO authenticated;
GRANT ALL ON public.document_analysis_usage TO service_role;
ALTER TABLE public.document_analysis_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own analysis usage" ON public.document_analysis_usage
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.document_analysis_usage
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Atomically reserves one analysis for the user's current Tanzania-local day.
-- Returns the new used count, or -1 when the daily limit is already reached.
CREATE OR REPLACE FUNCTION public.reserve_document_analysis(_user_id uuid, _limit integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  today date := (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date;
  new_used integer;
BEGIN
  IF _user_id IS NULL OR _limit IS NULL OR _limit < 1 THEN
    RETURN -1;
  END IF;
  INSERT INTO public.document_analysis_usage AS u (user_id, day, used)
  VALUES (_user_id, today, 1)
  ON CONFLICT (user_id, day) DO UPDATE SET used = u.used + 1
    WHERE u.used < _limit
  RETURNING u.used INTO new_used;
  RETURN COALESCE(new_used, -1);
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_document_analysis(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_document_analysis(uuid, integer) TO service_role;