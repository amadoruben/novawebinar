ALTER TABLE public.webinars
  ADD COLUMN IF NOT EXISTS cta_image_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cta_countdown_seconds integer NOT NULL DEFAULT 300;