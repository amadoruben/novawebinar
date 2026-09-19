ALTER TABLE public.scheduled_comments ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '';

CREATE TABLE public.social_proof_settings (
  webinar_id UUID PRIMARY KEY REFERENCES public.webinars(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  product_name TEXT NOT NULL DEFAULT '',
  start_mode TEXT NOT NULL DEFAULT 'with_offer',
  start_delay_seconds INTEGER NOT NULL DEFAULT 0,
  start_seconds INTEGER,
  end_seconds INTEGER,
  min_interval_seconds INTEGER NOT NULL DEFAULT 25,
  max_interval_seconds INTEGER NOT NULL DEFAULT 90,
  position TEXT NOT NULL DEFAULT 'bottom-left',
  display_seconds INTEGER NOT NULL DEFAULT 6,
  animation TEXT NOT NULL DEFAULT 'slide',
  sound_enabled BOOLEAN NOT NULL DEFAULT false,
  templates JSONB NOT NULL DEFAULT '[]'::jsonb,
  webhook_secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(18), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_proof_settings TO authenticated;
GRANT ALL ON public.social_proof_settings TO service_role;
ALTER TABLE public.social_proof_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "social_proof_settings_members" ON public.social_proof_settings FOR ALL TO authenticated
  USING (public.is_organization_member(organization_id)) WITH CHECK (public.is_organization_member(organization_id));

CREATE TABLE public.real_purchase_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  webinar_id UUID NOT NULL REFERENCES public.webinars(id) ON DELETE CASCADE,
  buyer_name TEXT NOT NULL,
  product_name TEXT NOT NULL DEFAULT '',
  amount TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'webhook',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX real_purchase_events_webinar_idx ON public.real_purchase_events (webinar_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.real_purchase_events TO authenticated;
GRANT ALL ON public.real_purchase_events TO service_role;
ALTER TABLE public.real_purchase_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "real_purchase_events_members" ON public.real_purchase_events FOR ALL TO authenticated
  USING (public.is_organization_member(organization_id)) WITH CHECK (public.is_organization_member(organization_id));

CREATE TABLE public.simulated_purchase_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  webinar_id UUID NOT NULL REFERENCES public.webinars(id) ON DELETE CASCADE,
  buyer_name TEXT NOT NULL,
  product_name TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  offset_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX simulated_purchase_events_webinar_idx ON public.simulated_purchase_events (webinar_id, offset_seconds);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulated_purchase_events TO authenticated;
GRANT ALL ON public.simulated_purchase_events TO service_role;
ALTER TABLE public.simulated_purchase_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "simulated_purchase_events_members" ON public.simulated_purchase_events FOR ALL TO authenticated
  USING (public.is_organization_member(organization_id)) WITH CHECK (public.is_organization_member(organization_id));