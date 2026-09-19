ALTER TABLE public.webinars
  ADD COLUMN IF NOT EXISTS prelive_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prelive_seconds integer NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS prelive_sound boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS prelive_message text NOT NULL DEFAULT 'A transmissão começa já a seguir';