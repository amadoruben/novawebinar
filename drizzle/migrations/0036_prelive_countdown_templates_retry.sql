ALTER TABLE public.webinars
  ADD COLUMN IF NOT EXISTS prelive_template text NOT NULL DEFAULT 'minimal';
ALTER TABLE public.webinars
  ADD COLUMN IF NOT EXISTS prelive_appearance jsonb NOT NULL DEFAULT '{}'::jsonb;