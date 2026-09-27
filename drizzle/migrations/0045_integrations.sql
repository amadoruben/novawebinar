-- Integrações da organização: plataformas de venda, pixels e webhook de saída.

-- Uma venda pode chegar de quem nunca viu um webinar; nesse caso fica sem webinar.
ALTER TABLE public.real_purchase_events ALTER COLUMN webinar_id DROP NOT NULL;

CREATE TABLE public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN (
    'hotmart', 'kiwify', 'eduzz', 'kambafy', 'stripe', 'webhook',
    'meta_pixel', 'tiktok_pixel', 'google_tag', 'outgoing_webhook'
  )),
  enabled boolean NOT NULL DEFAULT true,
  -- Identifica a integração no endereço do webhook; não é o segredo da plataforma.
  endpoint_key text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  -- Token/assinatura da plataforma (Hottok, whsec_…). O browser escreve mas não lê.
  secret text NOT NULL DEFAULT '',
  has_secret boolean GENERATED ALWAYS AS (secret <> '') STORED,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT integrations_org_provider_key UNIQUE (organization_id, provider),
  CONSTRAINT integrations_endpoint_key_key UNIQUE (endpoint_key)
);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.integrations FROM anon, authenticated;
GRANT SELECT (id, organization_id, provider, enabled, endpoint_key, has_secret, settings,
  last_event_at, created_at, updated_at) ON public.integrations TO authenticated;
GRANT INSERT (organization_id, provider, enabled, secret, settings) ON public.integrations TO authenticated;
GRANT UPDATE (enabled, secret, settings, updated_at) ON public.integrations TO authenticated;
GRANT DELETE ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;
CREATE POLICY "integrations_members" ON public.integrations FOR ALL TO authenticated
  USING (public.is_organization_member(organization_id))
  WITH CHECK (public.is_organization_member(organization_id));

-- Tudo o que chega aos webhooks, aceite ou não, com o motivo.
-- ponytail: sem limpeza automática; apagar registos antigos quando o volume o pedir.
CREATE TABLE public.integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES public.integrations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL CHECK (status IN ('accepted', 'rejected', 'ignored')),
  reason text NOT NULL DEFAULT '',
  event_type text NOT NULL DEFAULT '',
  buyer_email text,
  product_name text,
  amount_value numeric(12, 2),
  currency text,
  purchase_id uuid REFERENCES public.real_purchase_events(id) ON DELETE SET NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX integration_events_org_idx ON public.integration_events (organization_id, received_at DESC);
CREATE INDEX integration_events_integration_idx ON public.integration_events (integration_id);
CREATE INDEX integration_events_purchase_idx ON public.integration_events (purchase_id);

ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.integration_events FROM anon, authenticated;
GRANT SELECT ON public.integration_events TO authenticated;
GRANT ALL ON public.integration_events TO service_role;
CREATE POLICY "integration_events_members_read" ON public.integration_events FOR SELECT TO authenticated
  USING (public.is_organization_member(organization_id));
