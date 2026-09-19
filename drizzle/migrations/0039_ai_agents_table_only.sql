CREATE TABLE public.ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webinar_id uuid NOT NULL UNIQUE REFERENCES public.webinars(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'hibrido',
  use_webinar_transcript boolean NOT NULL DEFAULT false,
  agent_name text NOT NULL DEFAULT 'Assistente',
  avatar_url text,
  intro text NOT NULL DEFAULT 'Assistente virtual da equipa',
  personality jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_speed text NOT NULL DEFAULT 'natural',
  show_typing boolean NOT NULL DEFAULT true,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  never_say text NOT NULL DEFAULT '',
  escalation jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_threshold numeric NOT NULL DEFAULT 0.75,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agents TO authenticated;
GRANT ALL ON public.ai_agents TO service_role;
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage ai_agents" ON public.ai_agents FOR ALL TO authenticated
  USING (public.is_organization_member(organization_id)) WITH CHECK (public.is_organization_member(organization_id));