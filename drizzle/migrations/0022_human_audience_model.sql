-- Engagement Intelligence 2.0 — Human Audience Model
-- Momentos semânticos e estado coletivo estimado da audiência.
ALTER TABLE public.webinar_analysis
  ADD COLUMN IF NOT EXISTS moments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS audience_state jsonb NOT NULL DEFAULT '[]'::jsonb;
