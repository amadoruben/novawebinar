ALTER TABLE public.webinars
  ADD COLUMN cta_color TEXT NOT NULL DEFAULT 'green';

ALTER TABLE public.webinars
  ADD CONSTRAINT webinars_cta_color_check
  CHECK (cta_color IN ('green', 'red', 'blue', 'amber', 'violet'));