CREATE TABLE IF NOT EXISTS public.webinar_transcript_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webinar_id uuid NOT NULL REFERENCES public.webinars(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  video_source_id uuid REFERENCES public.video_sources(id) ON DELETE SET NULL,
  video_fingerprint text NOT NULL DEFAULT '',
  provider text NOT NULL,
  provider_model text NOT NULL DEFAULT '',
  timestamp_precision text NOT NULL CHECK (timestamp_precision IN ('word', 'block', 'estimated')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'ready', 'failed', 'superseded')),
  duration_seconds integer NOT NULL DEFAULT 0,
  raw_text text NOT NULL DEFAULT '',
  words jsonb NOT NULL DEFAULT '[]'::jsonb,
  sentences jsonb NOT NULL DEFAULT '[]'::jsonb,
  moments jsonb NOT NULL DEFAULT '[]'::jsonb,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  provider_job_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webinar_transcript_versions_webinar_idx
  ON public.webinar_transcript_versions (webinar_id, status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webinar_transcript_versions TO authenticated;
GRANT ALL ON public.webinar_transcript_versions TO service_role;

ALTER TABLE public.webinar_transcript_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members manage transcript versions" ON public.webinar_transcript_versions;
CREATE POLICY "Members manage transcript versions"
ON public.webinar_transcript_versions
FOR ALL
TO authenticated
USING (public.is_organization_member(organization_id))
WITH CHECK (public.is_organization_member(organization_id));