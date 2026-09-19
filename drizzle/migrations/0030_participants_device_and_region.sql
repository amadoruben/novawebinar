ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS device text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS country_code text;