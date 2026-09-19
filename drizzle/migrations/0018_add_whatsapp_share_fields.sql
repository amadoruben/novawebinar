ALTER TABLE public.webinars
  ADD COLUMN IF NOT EXISTS share_title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS share_description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS share_image_url text;