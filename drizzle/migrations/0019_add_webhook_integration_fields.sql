ALTER TABLE public.webinars
  ADD COLUMN IF NOT EXISTS webhook_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS webhook_enabled boolean NOT NULL DEFAULT false;