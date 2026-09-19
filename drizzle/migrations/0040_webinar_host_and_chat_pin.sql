alter table public.webinars
  add column if not exists host_name text not null default '',
  add column if not exists host_role text not null default '',
  add column if not exists host_avatar_url text not null default '',
  add column if not exists chat_pin_title text not null default 'Participe no chat!',
  add column if not exists chat_pin_message text not null default '';