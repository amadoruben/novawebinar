CREATE TABLE public.webinar_analysis (
  webinar_id uuid PRIMARY KEY REFERENCES public.webinars(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  objective text NOT NULL DEFAULT 'balanced',
  duration_seconds integer NOT NULL DEFAULT 0,
  segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  personas jsonb NOT NULL DEFAULT '[]'::jsonb,
  insights jsonb NOT NULL DEFAULT '[]'::jsonb,
  rescue jsonb NOT NULL DEFAULT '[]'::jsonb,
  score jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webinar_analysis TO authenticated;
GRANT ALL ON public.webinar_analysis TO service_role;

ALTER TABLE public.webinar_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros do workspace gerem a analise"
ON public.webinar_analysis
FOR ALL
TO authenticated
USING (public.is_organization_member(organization_id))
WITH CHECK (public.is_organization_member(organization_id));

CREATE TABLE public.webinar_prediction_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  webinar_id uuid NOT NULL REFERENCES public.webinars(id) ON DELETE CASCADE,
  webinar_session_id uuid REFERENCES public.webinar_sessions(id) ON DELETE SET NULL,
  predicted jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webinar_prediction_snapshots TO authenticated;
GRANT ALL ON public.webinar_prediction_snapshots TO service_role;

ALTER TABLE public.webinar_prediction_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros do workspace veem as previsoes"
ON public.webinar_prediction_snapshots
FOR ALL
TO authenticated
USING (public.is_organization_member(organization_id))
WITH CHECK (public.is_organization_member(organization_id));

CREATE INDEX webinar_prediction_snapshots_webinar_idx
  ON public.webinar_prediction_snapshots (webinar_id, created_at DESC);

ALTER TABLE public.scheduled_comments ADD COLUMN IF NOT EXISTS ai_intent text;
ALTER TABLE public.scheduled_comments ADD COLUMN IF NOT EXISTS ai_persona text;
ALTER TABLE public.scheduled_comments ADD COLUMN IF NOT EXISTS ai_thread text;