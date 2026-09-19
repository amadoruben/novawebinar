ALTER TABLE public.webinars
  ADD COLUMN IF NOT EXISTS registration_headline text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS registration_subtitle text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS registration_button_text text NOT NULL DEFAULT 'Entrar na sala',
  ADD COLUMN IF NOT EXISTS registration_collect_phone boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS registration_require_phone boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS waiting_room_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS phone text;

UPDATE public.webinars w
SET slug = w.slug || '-' || left(replace(w.id::text, '-', ''), 6)
WHERE EXISTS (
  SELECT 1 FROM public.webinars o
  WHERE o.slug = w.slug AND o.id <> w.id AND o.created_at <= w.created_at
);

CREATE UNIQUE INDEX IF NOT EXISTS webinars_slug_unique ON public.webinars (slug);