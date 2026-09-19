CREATE TABLE public.webinar_transcripts (
  webinar_id uuid PRIMARY KEY REFERENCES public.webinars(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  video_source_id uuid REFERENCES public.video_sources(id) ON DELETE SET NULL,
  video_fingerprint text NOT NULL DEFAULT '',
  duration_seconds integer NOT NULL DEFAULT 0,
  segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webinar_transcripts TO authenticated;
GRANT ALL ON public.webinar_transcripts TO service_role;

ALTER TABLE public.webinar_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage webinar transcripts"
ON public.webinar_transcripts
FOR ALL
TO authenticated
USING (public.is_organization_member(organization_id))
WITH CHECK (public.is_organization_member(organization_id));
