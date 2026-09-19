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
  personality jsonb NOT NULL DEFAULT '{"tone":"proximo","length":"equilibrado","emojis":"poucos","language":"pt-PT","examples":[]}'::jsonb,
  response_speed text NOT NULL DEFAULT 'natural',
  show_typing boolean NOT NULL DEFAULT true,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  never_say text NOT NULL DEFAULT '',
  escalation jsonb NOT NULL DEFAULT '{"reasons":[],"message":"Vou chamar alguém da equipa para confirmar isso para si."}'::jsonb,
  confidence_threshold numeric NOT NULL DEFAULT 0.75,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agents TO authenticated;
GRANT ALL ON public.ai_agents TO service_role;
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage ai_agents" ON public.ai_agents FOR ALL TO authenticated
  USING (public.is_organization_member(organization_id)) WITH CHECK (public.is_organization_member(organization_id));

CREATE TABLE public.ai_agent_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  section text NOT NULL,
  field text NOT NULL,
  label text NOT NULL,
  value text NOT NULL DEFAULT '',
  visibility text NOT NULL DEFAULT 'always',
  presented_after_ms integer,
  source text NOT NULL DEFAULT 'manual',
  approved boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agent_knowledge TO authenticated;
GRANT ALL ON public.ai_agent_knowledge TO service_role;
ALTER TABLE public.ai_agent_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage ai_agent_knowledge" ON public.ai_agent_knowledge FOR ALL TO authenticated
  USING (public.is_organization_member(organization_id)) WITH CHECK (public.is_organization_member(organization_id));

CREATE TABLE public.ai_agent_faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL DEFAULT '',
  visibility text NOT NULL DEFAULT 'always',
  source text NOT NULL DEFAULT 'manual',
  approved boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agent_faqs TO authenticated;
GRANT ALL ON public.ai_agent_faqs TO service_role;
ALTER TABLE public.ai_agent_faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage ai_agent_faqs" ON public.ai_agent_faqs FOR ALL TO authenticated
  USING (public.is_organization_member(organization_id)) WITH CHECK (public.is_organization_member(organization_id));

CREATE TABLE public.ai_agent_objections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  objection text NOT NULL,
  response text NOT NULL DEFAULT '',
  key_points text NOT NULL DEFAULT '',
  never_say text NOT NULL DEFAULT '',
  allowed_cta text NOT NULL DEFAULT '',
  escalate_when text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'manual',
  approved boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agent_objections TO authenticated;
GRANT ALL ON public.ai_agent_objections TO service_role;
ALTER TABLE public.ai_agent_objections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage ai_agent_objections" ON public.ai_agent_objections FOR ALL TO authenticated
  USING (public.is_organization_member(organization_id)) WITH CHECK (public.is_organization_member(organization_id));

CREATE TABLE public.ai_agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  webinar_id uuid NOT NULL REFERENCES public.webinars(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.private_conversations(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.participants(id) ON DELETE SET NULL,
  inbound_text text NOT NULL DEFAULT '',
  classification text NOT NULL DEFAULT 'UNKNOWN',
  decision text NOT NULL DEFAULT 'IGNORE',
  answer text NOT NULL DEFAULT '',
  confidence numeric NOT NULL DEFAULT 0,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  escalation_reason text,
  reason text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  session_ms integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'suggested',
  human_edit text,
  final_answer text,
  feedback text,
  latency_ms integer NOT NULL DEFAULT 0,
  is_simulation boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agent_messages TO authenticated;
GRANT ALL ON public.ai_agent_messages TO service_role;
ALTER TABLE public.ai_agent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage ai_agent_messages" ON public.ai_agent_messages FOR ALL TO authenticated
  USING (public.is_organization_member(organization_id)) WITH CHECK (public.is_organization_member(organization_id));

CREATE INDEX ai_agent_messages_webinar_idx ON public.ai_agent_messages (webinar_id, created_at DESC);
CREATE INDEX ai_agent_messages_conversation_idx ON public.ai_agent_messages (conversation_id, created_at DESC);

ALTER TABLE public.private_conversations ADD COLUMN needs_human boolean NOT NULL DEFAULT false;
ALTER TABLE public.private_conversations ADD COLUMN escalation_reason text;
ALTER TABLE public.private_messages ADD COLUMN agent_message_id uuid REFERENCES public.ai_agent_messages(id) ON DELETE SET NULL;