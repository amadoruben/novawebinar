ALTER TABLE public.webinars
  ADD COLUMN IF NOT EXISTS room_theme text NOT NULL DEFAULT 'dark';

ALTER TABLE public.webinars
  DROP CONSTRAINT IF EXISTS webinars_room_theme_check;

ALTER TABLE public.webinars
  ADD CONSTRAINT webinars_room_theme_check CHECK (room_theme IN ('dark','light'));