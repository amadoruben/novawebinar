CREATE TABLE IF NOT EXISTS public.background_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  webinar_id uuid NOT NULL REFERENCES public.webinars(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('chat', 'sync')),
  webinar_title text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'ready', 'error', 'done')),
  stage integer NOT NULL DEFAULT 0,
  progress integer NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  error text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.background_jobs TO authenticated;
GRANT ALL ON public.background_jobs TO service_role;

ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage their background jobs" ON public.background_jobs;
CREATE POLICY "Owners manage their background jobs"
ON public.background_jobs
FOR ALL
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE INDEX IF NOT EXISTS background_jobs_pending_idx ON public.background_jobs (status, updated_at);
CREATE INDEX IF NOT EXISTS background_jobs_webinar_idx ON public.background_jobs (webinar_id, kind);