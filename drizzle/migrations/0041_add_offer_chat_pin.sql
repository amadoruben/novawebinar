alter table public.webinars
  add column if not exists offer_pin_title text not null default 'Vagas abertas :',
  add column if not exists offer_pin_message text not null default '';