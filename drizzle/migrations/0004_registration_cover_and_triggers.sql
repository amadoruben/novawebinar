ALTER TABLE public.webinars
  ADD COLUMN IF NOT EXISTS registration_cover_url text,
  ADD COLUMN IF NOT EXISTS registration_badge_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS registration_progress_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS registration_progress_value integer NOT NULL DEFAULT 92,
  ADD COLUMN IF NOT EXISTS registration_scarcity_note text NOT NULL DEFAULT '';