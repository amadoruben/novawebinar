ALTER TABLE public.scheduled_comments
  ADD COLUMN IF NOT EXISTS offset_ms integer,
  ADD COLUMN IF NOT EXISTS trigger_type text,
  ADD COLUMN IF NOT EXISTS trigger_id text,
  ADD COLUMN IF NOT EXISTS trigger_start_ms integer,
  ADD COLUMN IF NOT EXISTS trigger_end_ms integer,
  ADD COLUMN IF NOT EXISTS temporal_relation text,
  ADD COLUMN IF NOT EXISTS reaction_latency_ms integer,
  ADD COLUMN IF NOT EXISTS generation_reason text,
  ADD COLUMN IF NOT EXISTS causality_confidence numeric,
  ADD COLUMN IF NOT EXISTS validation_action text,
  ADD COLUMN IF NOT EXISTS validation_rule text,
  ADD COLUMN IF NOT EXISTS transcript_version_id uuid REFERENCES public.webinar_transcript_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS scheduled_comments_webinar_offset_ms_idx
  ON public.scheduled_comments (webinar_id, offset_ms);

ALTER TABLE public.webinar_transcript_versions
  ADD COLUMN IF NOT EXISTS media_time_offset_ms integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS media_source text,
  ADD COLUMN IF NOT EXISTS report jsonb;