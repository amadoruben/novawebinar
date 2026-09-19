ALTER TABLE public.webinars
  ADD COLUMN IF NOT EXISTS cta_price_original text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cta_price_now text NOT NULL DEFAULT '';