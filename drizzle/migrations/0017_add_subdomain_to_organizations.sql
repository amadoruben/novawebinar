ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS subdomain text;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_subdomain_format
  CHECK (subdomain IS NULL OR subdomain ~ '^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$');

CREATE UNIQUE INDEX IF NOT EXISTS organizations_subdomain_key
  ON public.organizations (subdomain)
  WHERE subdomain IS NOT NULL;