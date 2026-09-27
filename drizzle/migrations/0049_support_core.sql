-- Atendimento: a IA tenta resolver; o que não resolve vira caso, é classificado,
-- encaminhado para a pessoa certa e fica com o rasto completo.
-- Reutiliza private_conversations / private_messages / ai_agent_messages.

-- 1. Regulariza o que já existia na base de dados sem migration.
ALTER TABLE public.private_conversations
  ADD COLUMN IF NOT EXISTS ai_paused boolean NOT NULL DEFAULT false;
ALTER TABLE public.private_messages DROP CONSTRAINT IF EXISTS private_messages_sender_kind_check;
ALTER TABLE public.private_messages ADD CONSTRAINT private_messages_sender_kind_check
  CHECK (sender_kind IN ('participant', 'team', 'ai_agent'));

-- 2. Conversa: canal e resumo da última mensagem, para a lista não ler todas as mensagens.
ALTER TABLE public.private_conversations
  ADD COLUMN channel text NOT NULL DEFAULT 'webinar_chat'
    CHECK (channel IN ('webinar_chat', 'whatsapp', 'email', 'instagram')),
  ADD COLUMN last_message_preview text NOT NULL DEFAULT '',
  ADD COLUMN last_sender_kind text;

CREATE FUNCTION public.private_messages_touch_conversation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE private_conversations
  SET last_message_at = NEW.created_at,
      last_message_preview = left(regexp_replace(NEW.body, '\s+', ' ', 'g'), 160),
      last_sender_kind = NEW.sender_kind
  WHERE id = NEW.conversation_id;
  RETURN NULL;
END $$;
CREATE TRIGGER private_messages_touch_conversation AFTER INSERT ON public.private_messages
  FOR EACH ROW EXECUTE FUNCTION public.private_messages_touch_conversation();
REVOKE EXECUTE ON FUNCTION public.private_messages_touch_conversation() FROM PUBLIC, anon, authenticated;

-- 3. Departamentos, competências, funcionários e regras de encaminhamento.
CREATE TABLE public.support_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (btrim(name) <> ''),
  position integer NOT NULL DEFAULT 0,
  -- Recebe o que não cabe em mais nenhum departamento.
  is_fallback boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_departments_org_slug_key UNIQUE (organization_id, slug),
  CONSTRAINT support_departments_id_org_key UNIQUE (id, organization_id)
);
CREATE UNIQUE INDEX support_departments_one_fallback
  ON public.support_departments (organization_id) WHERE is_fallback;

CREATE TABLE public.support_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- O slug não muda: é ele que fica guardado nos funcionários, regras e casos.
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (btrim(name) <> ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_skills_org_slug_key UNIQUE (organization_id, slug)
);

-- Quem atende. Não é um contacto nem um lead: é o perfil operacional de uma
-- pessoa da equipa. `user_id` fica vazio até a pessoa aceitar o convite.
CREATE TABLE public.support_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (btrim(name) <> ''),
  email text NOT NULL CHECK (email = lower(email) AND email LIKE '%_@_%'),
  phone text,
  job_title text NOT NULL DEFAULT '',
  department_id uuid,
  skills text[] NOT NULL DEFAULT '{}',
  channels text[] NOT NULL DEFAULT '{webinar_chat}',
  status text NOT NULL DEFAULT 'offline'
    CHECK (status IN ('online', 'available', 'busy', 'away', 'offline')),
  -- Casos abertos que aceita ao mesmo tempo.
  capacity integer NOT NULL DEFAULT 5 CHECK (capacity BETWEEN 1 AND 50),
  is_supervisor boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz,
  last_assigned_at timestamptz,
  invited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_staff_org_email_key UNIQUE (organization_id, email),
  CONSTRAINT support_staff_org_user_key UNIQUE (organization_id, user_id),
  CONSTRAINT support_staff_id_org_key UNIQUE (id, organization_id),
  CONSTRAINT support_staff_department_fk FOREIGN KEY (department_id, organization_id)
    REFERENCES public.support_departments (id, organization_id) ON DELETE SET NULL (department_id)
);
CREATE INDEX support_staff_user_idx ON public.support_staff (user_id);

CREATE TABLE public.support_routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  intent text NOT NULL CHECK (intent IN (
    'information', 'offer_question', 'purchase', 'payment', 'checkout', 'access', 'technical',
    'post_purchase', 'refund', 'complaint', 'negotiation', 'human_request', 'other')),
  department_id uuid,
  required_skills text[] NOT NULL DEFAULT '{}',
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('critical', 'high', 'normal', 'low')),
  -- Minutos até à primeira resposta de uma pessoa.
  sla_minutes integer NOT NULL DEFAULT 30 CHECK (sla_minutes BETWEEN 1 AND 10080),
  -- A IA nunca resolve sozinha, mesmo com confiança alta.
  always_human boolean NOT NULL DEFAULT false,
  call_required boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_routing_rules_org_intent_key UNIQUE (organization_id, intent),
  CONSTRAINT support_routing_rules_department_fk FOREIGN KEY (department_id, organization_id)
    REFERENCES public.support_departments (id, organization_id) ON DELETE SET NULL (department_id)
);

-- 4. Casos.
CREATE TABLE public.support_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Número por organização: "Caso 12".
  number integer NOT NULL,
  conversation_id uuid REFERENCES public.private_conversations(id) ON DELETE SET NULL,
  contact_id uuid,
  participant_id uuid REFERENCES public.participants(id) ON DELETE SET NULL,
  webinar_id uuid REFERENCES public.webinars(id) ON DELETE SET NULL,
  intent text NOT NULL DEFAULT 'other' CHECK (intent IN (
    'information', 'offer_question', 'purchase', 'payment', 'checkout', 'access', 'technical',
    'post_purchase', 'refund', 'complaint', 'negotiation', 'human_request', 'other')),
  category text NOT NULL DEFAULT 'general' CHECK (category IN (
    'offer', 'payment', 'access', 'technical', 'post_purchase', 'content', 'general')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('critical', 'high', 'normal', 'low')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 'reviewing', 'assigned', 'in_progress', 'waiting_customer', 'waiting_team',
    'escalated', 'resolved', 'reopened', 'closed')),
  department_id uuid,
  assigned_staff_id uuid,
  required_skills text[] NOT NULL DEFAULT '{}',
  source_channel text NOT NULL DEFAULT 'webinar_chat',
  summary text NOT NULL DEFAULT '',
  reason_for_escalation text NOT NULL DEFAULT '',
  recommended_action text NOT NULL DEFAULT '',
  -- Porque foi para esta pessoa (ou porque ficou sem responsável).
  routing_reason text NOT NULL DEFAULT '',
  resolution text NOT NULL DEFAULT '',
  human_intervention_required boolean NOT NULL DEFAULT true,
  call_required boolean NOT NULL DEFAULT false,
  purchase_intent boolean NOT NULL DEFAULT false,
  sentiment text CHECK (sentiment IS NULL OR sentiment IN ('positive', 'neutral', 'negative')),
  confidence numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  sla_minutes integer NOT NULL DEFAULT 30,
  sla_deadline timestamptz,
  sla_warned_at timestamptz,
  sla_breached_at timestamptz,
  first_response_at timestamptz,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  stalled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  closed_at timestamptz,
  CONSTRAINT support_cases_org_number_key UNIQUE (organization_id, number),
  CONSTRAINT support_cases_contact_fk FOREIGN KEY (contact_id, organization_id)
    REFERENCES public.contacts (id, organization_id) ON DELETE SET NULL (contact_id),
  CONSTRAINT support_cases_department_fk FOREIGN KEY (department_id, organization_id)
    REFERENCES public.support_departments (id, organization_id) ON DELETE SET NULL (department_id),
  CONSTRAINT support_cases_staff_fk FOREIGN KEY (assigned_staff_id, organization_id)
    REFERENCES public.support_staff (id, organization_id) ON DELETE SET NULL (assigned_staff_id)
);
-- Uma conversa só tem um caso aberto de cada vez.
CREATE UNIQUE INDEX support_cases_one_open_per_conversation
  ON public.support_cases (conversation_id) WHERE status NOT IN ('resolved', 'closed');
CREATE INDEX support_cases_org_status_idx ON public.support_cases (organization_id, status, created_at DESC);
CREATE INDEX support_cases_staff_open_idx
  ON public.support_cases (assigned_staff_id) WHERE status NOT IN ('resolved', 'closed');
CREATE INDEX support_cases_contact_idx ON public.support_cases (contact_id);
CREATE INDEX support_cases_conversation_idx ON public.support_cases (conversation_id);
CREATE INDEX support_cases_sla_idx
  ON public.support_cases (sla_deadline) WHERE status NOT IN ('resolved', 'closed');

-- 5. Rasto do atendimento: só se acrescenta, nunca se edita. É daqui que as
-- automações vão ler quando existirem.
CREATE TABLE public.activity_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (name ~ '^[a-z]+(_[a-z]+)*$'),
  actor_kind text NOT NULL CHECK (actor_kind IN ('ai', 'human', 'system', 'contact')),
  actor_user_id uuid,
  case_id uuid REFERENCES public.support_cases(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.private_conversations(id) ON DELETE SET NULL,
  contact_id uuid,
  webinar_id uuid REFERENCES public.webinars(id) ON DELETE SET NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_events_contact_fk FOREIGN KEY (contact_id, organization_id)
    REFERENCES public.contacts (id, organization_id) ON DELETE SET NULL (contact_id)
);
CREATE INDEX activity_events_org_time_idx ON public.activity_events (organization_id, occurred_at DESC);
CREATE INDEX activity_events_case_idx ON public.activity_events (case_id, id);
CREATE INDEX activity_events_contact_idx ON public.activity_events (contact_id, id DESC);
CREATE INDEX activity_events_conversation_idx ON public.activity_events (conversation_id, id DESC);

-- 6. Permissões. A equipa de atendimento é quem já vê as conversas:
-- proprietário, administrador e suporte.
REVOKE ALL ON public.support_departments, public.support_skills, public.support_staff,
  public.support_routing_rules, public.support_cases, public.activity_events FROM anon, authenticated;
GRANT ALL ON public.support_departments, public.support_skills, public.support_staff,
  public.support_routing_rules, public.support_cases, public.activity_events TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_departments, public.support_skills,
  public.support_routing_rules TO authenticated;
-- No perfil do funcionário, o browser nunca escolhe a conta ligada nem a presença.
GRANT SELECT, DELETE ON public.support_staff TO authenticated;
GRANT INSERT (organization_id, name, email, phone, job_title, department_id, skills, channels,
  capacity, is_supervisor, active) ON public.support_staff TO authenticated;
GRANT UPDATE (name, email, phone, job_title, department_id, skills, channels, capacity,
  is_supervisor, active, updated_at) ON public.support_staff TO authenticated;
-- Casos e rasto: o browser só lê; as alterações passam pelas funções abaixo.
GRANT SELECT ON public.support_cases, public.activity_events TO authenticated;

ALTER TABLE public.support_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['support_departments', 'support_skills', 'support_staff', 'support_routing_rules'] LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_organization_member(organization_id))',
      t || '_read', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING (public.has_organization_role(organization_id, ARRAY[''owner'', ''admin'']::public.workspace_role[]))
         WITH CHECK (public.has_organization_role(organization_id, ARRAY[''owner'', ''admin'']::public.workspace_role[]))',
      t || '_manage', t);
  END LOOP;
END $$;

CREATE POLICY support_cases_team_read ON public.support_cases FOR SELECT TO authenticated
  USING (public.has_organization_role(organization_id, ARRAY['owner', 'admin', 'support']::public.workspace_role[]));
CREATE POLICY activity_events_team_read ON public.activity_events FOR SELECT TO authenticated
  USING (public.has_organization_role(organization_id, ARRAY['owner', 'admin', 'support']::public.workspace_role[]));

-- Carga de cada funcionário, para o encaminhamento e para o ecrã das equipas.
CREATE VIEW public.support_staff_load WITH (security_invoker = on) AS
SELECT s.id AS staff_id, s.organization_id,
  count(c.id) FILTER (WHERE c.status NOT IN ('resolved', 'closed'))::int AS open_cases
FROM public.support_staff s
LEFT JOIN public.support_cases c ON c.assigned_staff_id = s.id
GROUP BY s.id;
REVOKE ALL ON public.support_staff_load FROM anon;
GRANT SELECT ON public.support_staff_load TO authenticated, service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_cases;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_staff;

-- 7. Valores iniciais de cada organização. Só entram se a organização ainda não
-- tiver nada: o que o dono apagar não volta a aparecer.
CREATE FUNCTION public.support_seed_defaults(_organization_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM support_departments WHERE organization_id = _organization_id) THEN
    INSERT INTO support_departments (organization_id, slug, name, position, is_fallback) VALUES
      (_organization_id, 'vendas', 'Vendas', 1, false),
      (_organization_id, 'suporte', 'Suporte', 2, false),
      (_organization_id, 'financeiro', 'Financeiro', 3, false),
      (_organization_id, 'pos-venda', 'Pós-venda', 4, false),
      (_organization_id, 'atendimento-geral', 'Atendimento geral', 5, true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM support_skills WHERE organization_id = _organization_id) THEN
    INSERT INTO support_skills (organization_id, slug, name) VALUES
      (_organization_id, 'vendas', 'Vendas'),
      (_organization_id, 'negociacao', 'Negociação'),
      (_organization_id, 'checkout', 'Checkout'),
      (_organization_id, 'pagamentos', 'Pagamentos'),
      (_organization_id, 'acesso', 'Acesso'),
      (_organization_id, 'webinar', 'Webinar'),
      (_organization_id, 'suporte-tecnico', 'Suporte técnico'),
      (_organization_id, 'pos-compra', 'Pós-compra'),
      (_organization_id, 'reembolso', 'Reembolso'),
      (_organization_id, 'agendamento', 'Agendamento'),
      (_organization_id, 'mentoria', 'Mentoria'),
      (_organization_id, 'atendimento', 'Atendimento'),
      (_organization_id, 'informacoes', 'Informações');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM support_routing_rules WHERE organization_id = _organization_id) THEN
    INSERT INTO support_routing_rules
      (organization_id, intent, department_id, required_skills, priority, sla_minutes, always_human, call_required)
    SELECT _organization_id, r.intent, d.id, r.skills, r.priority, r.sla, r.always_human, r.call_required
    FROM (VALUES
      ('purchase',       'vendas',            ARRAY['vendas', 'negociacao'],      'high',     10, false, false),
      ('negotiation',    'vendas',            ARRAY['vendas', 'negociacao'],      'high',     10, true,  false),
      ('payment',        'vendas',            ARRAY['checkout', 'pagamentos'],    'high',     10, false, false),
      ('checkout',       'vendas',            ARRAY['checkout'],                  'high',     10, false, false),
      ('offer_question', 'vendas',            ARRAY['vendas'],                    'normal',   20, false, false),
      ('access',         'suporte',           ARRAY['acesso', 'webinar'],         'high',     10, false, false),
      ('technical',      'suporte',           ARRAY['suporte-tecnico'],           'normal',   20, false, false),
      ('post_purchase',  'pos-venda',         ARRAY['pagamentos', 'acesso'],      'high',     15, false, false),
      ('refund',         'financeiro',        ARRAY['reembolso', 'pagamentos'],   'high',     30, true,  false),
      ('complaint',      'pos-venda',         ARRAY['pos-compra'],                'critical', 10, true,  true),
      ('human_request',  'atendimento-geral', ARRAY['atendimento'],               'normal',   10, true,  false),
      ('information',    'atendimento-geral', ARRAY['informacoes'],               'low',      30, false, false),
      ('other',          'atendimento-geral', ARRAY[]::text[],                    'normal',   30, false, false)
    ) AS r(intent, department, skills, priority, sla, always_human, call_required)
    LEFT JOIN support_departments d
      ON d.organization_id = _organization_id AND d.slug = r.department;
  END IF;
END $$;

-- O perfil de atendimento de um membro da equipa; cria-o se ainda não existir.
CREATE FUNCTION public.support_staff_for_user(_organization_id uuid, _user_id uuid)
RETURNS public.support_staff
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s support_staff;
  r workspace_role;
  mail text;
  full_name text;
BEGIN
  SELECT * INTO s FROM support_staff WHERE organization_id = _organization_id AND user_id = _user_id;
  IF FOUND THEN RETURN s; END IF;

  SELECT role INTO r FROM organization_members
  WHERE organization_id = _organization_id AND user_id = _user_id;
  IF r IS NULL OR r NOT IN ('owner', 'admin', 'support') THEN RETURN NULL; END IF;

  SELECT lower(u.email), nullif(btrim(coalesce(p.full_name, '')), '')
  INTO mail, full_name
  FROM auth.users u LEFT JOIN profiles p ON p.id = u.id
  WHERE u.id = _user_id;
  IF mail IS NULL THEN RETURN NULL; END IF;

  -- Já registado pelo email (convite): liga a conta em vez de duplicar.
  UPDATE support_staff SET user_id = _user_id, updated_at = now()
  WHERE organization_id = _organization_id AND email = mail AND user_id IS NULL
  RETURNING * INTO s;
  IF FOUND THEN RETURN s; END IF;

  INSERT INTO support_staff (organization_id, user_id, name, email, job_title, is_supervisor, department_id)
  VALUES (
    _organization_id, _user_id, coalesce(full_name, split_part(mail, '@', 1)), mail,
    CASE r WHEN 'owner' THEN 'Proprietário' WHEN 'admin' THEN 'Administrador' ELSE 'Atendimento' END,
    r IN ('owner', 'admin'),
    (SELECT id FROM support_departments WHERE organization_id = _organization_id AND is_fallback LIMIT 1)
  )
  ON CONFLICT (organization_id, email) DO UPDATE SET user_id = excluded.user_id, updated_at = now()
  RETURNING * INTO s;
  RETURN s;
END $$;

-- Chamada ao abrir o Atendimento: garante os valores iniciais e o perfil de quem entra.
CREATE FUNCTION public.ensure_support_setup(_organization_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s support_staff;
  r workspace_role;
BEGIN
  SELECT role INTO r FROM organization_members
  WHERE organization_id = _organization_id AND user_id = auth.uid();
  IF r IS NULL THEN RAISE EXCEPTION 'Sem acesso a esta organização.'; END IF;

  PERFORM support_seed_defaults(_organization_id);
  s := support_staff_for_user(_organization_id, auth.uid());
  RETURN jsonb_build_object(
    'staff_id', s.id,
    'role', r,
    'is_supervisor', r IN ('owner', 'admin') OR coalesce(s.is_supervisor, false)
  );
END $$;

-- Presença: o ecrã aberto diz "estou cá" de minuto a minuto; o estado é escolhido pela pessoa.
CREATE FUNCTION public.support_presence(_organization_id uuid, _status text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current text;
BEGIN
  IF _status IS NOT NULL AND _status NOT IN ('online', 'available', 'busy', 'away', 'offline') THEN
    RAISE EXCEPTION 'Estado desconhecido.';
  END IF;
  UPDATE support_staff
  SET last_seen_at = now(), status = coalesce(_status, status), updated_at = now()
  WHERE organization_id = _organization_id AND user_id = auth.uid() AND active
  RETURNING status INTO current;
  RETURN current;
END $$;

-- 8. Rasto.
CREATE FUNCTION public.support_log_event(
  _case public.support_cases, _name text, _actor_kind text, _actor_user_id uuid, _data jsonb
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO activity_events
    (organization_id, name, actor_kind, actor_user_id, case_id, conversation_id, contact_id, webinar_id, data)
  VALUES
    (_case.organization_id, _name, _actor_kind, _actor_user_id, _case.id, _case.conversation_id,
     _case.contact_id, _case.webinar_id, coalesce(_data, '{}'::jsonb));
$$;

-- Eventos que não pertencem a um caso (resposta da IA, intenção de compra, mensagem recebida).
CREATE FUNCTION public.support_log_conversation_event(
  _conversation_id uuid, _name text, _actor_kind text, _data jsonb
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO activity_events
    (organization_id, name, actor_kind, conversation_id, contact_id, webinar_id, data)
  SELECT c.organization_id, _name, _actor_kind, c.id, p.contact_id, c.webinar_id, coalesce(_data, '{}'::jsonb)
  FROM private_conversations c
  LEFT JOIN participants p ON p.id = c.participant_id
  WHERE c.id = _conversation_id;
$$;

-- 9. Abrir um caso. Tudo numa transacção: ou fica o caso, a conversa em pausa
-- para a IA e o rasto, ou não fica nada.
CREATE FUNCTION public.open_support_case(_p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  org uuid := (_p->>'organization_id')::uuid;
  conv uuid := nullif(_p->>'conversation_id', '')::uuid;
  staff uuid := nullif(_p->>'assigned_staff_id', '')::uuid;
  dept uuid := nullif(_p->>'department_id', '')::uuid;
  actor text := coalesce(nullif(_p->>'actor_kind', ''), 'system');
  actor_user uuid := nullif(_p->>'actor_user_id', '')::uuid;
  sla integer := least(10080, greatest(1, coalesce((_p->>'sla_minutes')::integer, 30)));
  reopen_hours integer := greatest(0, coalesce((_p->>'reopen_window_hours')::integer, 72));
  skills text[] := ARRAY(SELECT jsonb_array_elements_text(coalesce(_p->'required_skills', '[]'::jsonb)));
  staff_user uuid;
  conversation private_conversations;
  c support_cases;
  previous uuid;
  reopened boolean := false;
BEGIN
  IF org IS NULL THEN RAISE EXCEPTION 'organization_id em falta.'; END IF;

  IF conv IS NOT NULL THEN
    SELECT * INTO conversation FROM private_conversations
    WHERE id = conv AND organization_id = org FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Conversa não encontrada.'; END IF;

    SELECT * INTO c FROM support_cases
    WHERE conversation_id = conv AND status NOT IN ('resolved', 'closed') LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('case_id', c.id, 'number', c.number, 'created', false,
        'reopened', false, 'assigned_staff_id', c.assigned_staff_id);
    END IF;

    SELECT id INTO previous FROM support_cases
    WHERE conversation_id = conv AND status = 'resolved'
      AND resolved_at > now() - make_interval(hours => reopen_hours)
    ORDER BY resolved_at DESC LIMIT 1;
  END IF;

  IF staff IS NOT NULL THEN
    SELECT s.user_id, coalesce(dept, s.department_id) INTO staff_user, dept
    FROM support_staff s WHERE s.id = staff AND s.organization_id = org AND s.active;
    IF NOT FOUND THEN staff := NULL; END IF;
  END IF;
  IF dept IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM support_departments WHERE id = dept AND organization_id = org
  ) THEN dept := NULL; END IF;

  IF previous IS NOT NULL THEN
    reopened := true;
    UPDATE support_cases SET
      status = 'reopened',
      intent = coalesce(nullif(_p->>'intent', ''), intent),
      category = coalesce(nullif(_p->>'category', ''), category),
      priority = coalesce(nullif(_p->>'priority', ''), priority),
      department_id = coalesce(dept, department_id),
      assigned_staff_id = staff,
      required_skills = skills,
      summary = coalesce(nullif(_p->>'summary', ''), summary),
      reason_for_escalation = coalesce(nullif(_p->>'reason_for_escalation', ''), reason_for_escalation),
      recommended_action = coalesce(nullif(_p->>'recommended_action', ''), recommended_action),
      routing_reason = coalesce(_p->>'routing_reason', ''),
      call_required = coalesce((_p->>'call_required')::boolean, call_required),
      purchase_intent = coalesce((_p->>'purchase_intent')::boolean, purchase_intent),
      sentiment = coalesce(nullif(_p->>'sentiment', ''), sentiment),
      confidence = coalesce((_p->>'confidence')::numeric, confidence),
      sla_minutes = sla,
      sla_deadline = now() + make_interval(mins => sla),
      sla_warned_at = NULL, sla_breached_at = NULL, first_response_at = NULL,
      stalled_at = NULL, last_activity_at = now(), resolved_at = NULL, closed_at = NULL,
      resolution = '', updated_at = now()
    WHERE id = previous
    RETURNING * INTO c;
  ELSE
    -- Número seguinte da organização, sem dois casos com o mesmo número.
    PERFORM pg_advisory_xact_lock(hashtext('support_case_number'), hashtext(org::text));
    INSERT INTO support_cases (
      organization_id, number, conversation_id, contact_id, participant_id, webinar_id,
      intent, category, priority, status, department_id, assigned_staff_id, required_skills,
      source_channel, summary, reason_for_escalation, recommended_action, routing_reason,
      human_intervention_required, call_required, purchase_intent, sentiment, confidence,
      sla_minutes, sla_deadline
    ) VALUES (
      org,
      (SELECT coalesce(max(number), 0) + 1 FROM support_cases WHERE organization_id = org),
      conv,
      nullif(_p->>'contact_id', '')::uuid,
      coalesce(nullif(_p->>'participant_id', '')::uuid, conversation.participant_id),
      coalesce(nullif(_p->>'webinar_id', '')::uuid, conversation.webinar_id),
      coalesce(nullif(_p->>'intent', ''), 'other'),
      coalesce(nullif(_p->>'category', ''), 'general'),
      coalesce(nullif(_p->>'priority', ''), 'normal'),
      CASE WHEN staff IS NULL THEN 'new' ELSE 'assigned' END,
      dept, staff, skills,
      coalesce(nullif(_p->>'source_channel', ''), conversation.channel, 'webinar_chat'),
      coalesce(_p->>'summary', ''),
      coalesce(_p->>'reason_for_escalation', ''),
      coalesce(_p->>'recommended_action', ''),
      coalesce(_p->>'routing_reason', ''),
      coalesce((_p->>'human_intervention_required')::boolean, true),
      coalesce((_p->>'call_required')::boolean, false),
      coalesce((_p->>'purchase_intent')::boolean, false),
      nullif(_p->>'sentiment', ''),
      (_p->>'confidence')::numeric,
      sla, now() + make_interval(mins => sla)
    ) RETURNING * INTO c;
  END IF;

  IF staff IS NOT NULL THEN
    UPDATE support_staff SET last_assigned_at = now() WHERE id = staff;
  END IF;

  IF conv IS NOT NULL THEN
    UPDATE private_conversations SET
      ai_paused = true, needs_human = true, status = 'waiting',
      escalation_reason = nullif(c.reason_for_escalation, ''),
      assigned_to = staff_user
    WHERE id = conv;
  END IF;

  IF actor = 'ai' THEN
    PERFORM support_log_event(c, 'ai_escalation', 'ai', NULL,
      jsonb_build_object('reason', c.reason_for_escalation, 'confidence', c.confidence));
  END IF;
  PERFORM support_log_event(c, CASE WHEN reopened THEN 'case_reopened' ELSE 'case_created' END,
    actor, actor_user, jsonb_build_object('number', c.number, 'summary', c.summary));
  PERFORM support_log_event(c, 'case_classified', actor, actor_user, jsonb_build_object(
    'intent', c.intent, 'category', c.category, 'priority', c.priority,
    'department_id', c.department_id, 'required_skills', to_jsonb(c.required_skills),
    'sla_minutes', c.sla_minutes));
  IF c.purchase_intent THEN
    PERFORM support_log_event(c, 'purchase_intent_detected', actor, actor_user, '{}'::jsonb);
  END IF;
  IF c.call_required THEN
    PERFORM support_log_event(c, 'call_requested', actor, actor_user, '{}'::jsonb);
  END IF;
  PERFORM support_log_event(c,
    CASE WHEN staff IS NULL THEN 'case_unassigned' ELSE 'case_assigned' END,
    'system', NULL,
    jsonb_build_object('staff_id', staff, 'department_id', c.department_id, 'reason', c.routing_reason));

  RETURN jsonb_build_object('case_id', c.id, 'number', c.number, 'created', NOT reopened,
    'reopened', reopened, 'assigned_staff_id', c.assigned_staff_id);
END $$;

-- 10. O que uma pessoa da equipa faz a um caso.
CREATE FUNCTION public.support_case_action(
  _case_id uuid, _action text, _actor_user_id uuid, _payload jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c support_cases;
  me support_staff;
  target support_staff;
  p jsonb := coalesce(_payload, '{}'::jsonb);
  supervisor boolean;
  is_open boolean;
  previous_staff uuid;
  body text;
  message_id uuid;
  give_back boolean;
  dept uuid;
  value text;
BEGIN
  SELECT * INTO c FROM support_cases WHERE id = _case_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Caso não encontrado.'; END IF;
  IF NOT has_organization_role(
    c.organization_id, ARRAY['owner', 'admin', 'support']::workspace_role[], _actor_user_id
  ) THEN
    RAISE EXCEPTION 'Sem permissão para este caso.';
  END IF;

  me := support_staff_for_user(c.organization_id, _actor_user_id);
  supervisor := coalesce(me.is_supervisor, false) OR has_organization_role(
    c.organization_id, ARRAY['owner', 'admin']::workspace_role[], _actor_user_id);
  is_open := c.status NOT IN ('resolved', 'closed');
  previous_staff := c.assigned_staff_id;

  IF NOT is_open AND _action NOT IN ('reopen', 'close', 'note') THEN
    RAISE EXCEPTION 'Este caso já está concluído. Reabra-o primeiro.';
  END IF;

  CASE _action
  WHEN 'assume' THEN
    IF me.id IS NULL THEN RAISE EXCEPTION 'Não tem perfil de atendimento.'; END IF;
    UPDATE support_cases SET assigned_staff_id = me.id, status = 'in_progress',
      department_id = coalesce(department_id, me.department_id)
    WHERE id = c.id RETURNING * INTO c;
    UPDATE support_staff SET last_assigned_at = now() WHERE id = me.id;
    UPDATE private_conversations SET ai_paused = true, needs_human = true,
      assigned_to = _actor_user_id, status = 'active' WHERE id = c.conversation_id;
    PERFORM support_log_event(c, 'human_assumed', 'human', _actor_user_id,
      jsonb_build_object('staff_id', me.id, 'from_staff_id', previous_staff));

  WHEN 'reply' THEN
    body := btrim(coalesce(p->>'body', ''));
    IF body = '' THEN RAISE EXCEPTION 'A mensagem está vazia.'; END IF;
    IF length(body) > 2000 THEN RAISE EXCEPTION 'A mensagem é demasiado longa.'; END IF;
    IF c.conversation_id IS NULL THEN RAISE EXCEPTION 'Este caso não tem conversa.'; END IF;
    INSERT INTO private_messages
      (conversation_id, organization_id, participant_id, sender_kind, sender_user_id, body)
    VALUES (c.conversation_id, c.organization_id, c.participant_id, 'team', _actor_user_id, body)
    RETURNING id INTO message_id;
    IF c.assigned_staff_id IS NULL AND me.id IS NOT NULL THEN
      UPDATE support_cases SET assigned_staff_id = me.id,
        department_id = coalesce(department_id, me.department_id) WHERE id = c.id;
      UPDATE support_staff SET last_assigned_at = now() WHERE id = me.id;
      PERFORM support_log_event(c, 'human_assumed', 'human', _actor_user_id,
        jsonb_build_object('staff_id', me.id, 'from_staff_id', NULL));
    END IF;
    UPDATE support_cases SET
      status = CASE WHEN status = 'waiting_customer' THEN status ELSE 'in_progress' END,
      first_response_at = coalesce(first_response_at, now())
    WHERE id = c.id RETURNING * INTO c;
    UPDATE private_conversations SET ai_paused = true, status = 'active',
      assigned_to = coalesce(assigned_to, _actor_user_id) WHERE id = c.conversation_id;
    PERFORM support_log_event(c, 'human_replied', 'human', _actor_user_id,
      jsonb_build_object('message_id', message_id));

  WHEN 'transfer' THEN
    IF nullif(p->>'staff_id', '') IS NOT NULL THEN
      SELECT * INTO target FROM support_staff
      WHERE id = (p->>'staff_id')::uuid AND organization_id = c.organization_id AND active;
      IF NOT FOUND THEN RAISE EXCEPTION 'Funcionário não encontrado.'; END IF;
      UPDATE support_cases SET assigned_staff_id = target.id, status = 'assigned',
        department_id = coalesce(nullif(p->>'department_id', '')::uuid, target.department_id, department_id),
        routing_reason = 'Transferido à mão'
      WHERE id = c.id RETURNING * INTO c;
      UPDATE support_staff SET last_assigned_at = now() WHERE id = target.id;
    ELSIF nullif(p->>'department_id', '') IS NOT NULL THEN
      SELECT id INTO dept FROM support_departments
      WHERE id = (p->>'department_id')::uuid AND organization_id = c.organization_id;
      IF dept IS NULL THEN RAISE EXCEPTION 'Departamento não encontrado.'; END IF;
      UPDATE support_cases SET assigned_staff_id = NULL, status = 'new', department_id = dept,
        routing_reason = 'Na fila do departamento'
      WHERE id = c.id RETURNING * INTO c;
    ELSE
      RAISE EXCEPTION 'Escolha para quem transferir.';
    END IF;
    UPDATE private_conversations SET ai_paused = true, needs_human = true,
      assigned_to = target.user_id WHERE id = c.conversation_id;
    PERFORM support_log_event(c, 'case_transferred', 'human', _actor_user_id, jsonb_build_object(
      'from_staff_id', previous_staff, 'to_staff_id', c.assigned_staff_id,
      'to_department_id', c.department_id, 'note', nullif(btrim(coalesce(p->>'note', '')), '')));
    PERFORM support_log_event(c,
      CASE WHEN c.assigned_staff_id IS NULL THEN 'case_unassigned' ELSE 'case_assigned' END,
      'human', _actor_user_id,
      jsonb_build_object('staff_id', c.assigned_staff_id, 'department_id', c.department_id,
        'reason', c.routing_reason));

  WHEN 'waiting' THEN
    value := coalesce(nullif(p->>'on', ''), 'customer');
    IF value NOT IN ('customer', 'team') THEN RAISE EXCEPTION 'Espera desconhecida.'; END IF;
    UPDATE support_cases SET status = 'waiting_' || value WHERE id = c.id RETURNING * INTO c;
    PERFORM support_log_event(c, 'case_waiting', 'human', _actor_user_id,
      jsonb_build_object('on', value));

  WHEN 'resume' THEN
    UPDATE support_cases SET status = 'in_progress' WHERE id = c.id RETURNING * INTO c;
    PERFORM support_log_event(c, 'case_resumed', 'human', _actor_user_id, '{}'::jsonb);

  WHEN 'escalate' THEN
    IF nullif(p->>'staff_id', '') IS NOT NULL THEN
      SELECT * INTO target FROM support_staff
      WHERE id = (p->>'staff_id')::uuid AND organization_id = c.organization_id AND active;
      IF NOT FOUND THEN RAISE EXCEPTION 'Supervisor não encontrado.'; END IF;
    END IF;
    UPDATE support_cases SET status = 'escalated', assigned_staff_id = target.id,
      routing_reason = 'Escalado para o supervisor'
    WHERE id = c.id RETURNING * INTO c;
    UPDATE private_conversations SET assigned_to = target.user_id WHERE id = c.conversation_id;
    PERFORM support_log_event(c, 'case_escalated', 'human', _actor_user_id, jsonb_build_object(
      'from_staff_id', previous_staff, 'to_staff_id', target.id,
      'reason', nullif(btrim(coalesce(p->>'reason', '')), '')));

  WHEN 'review' THEN
    IF NOT supervisor THEN RAISE EXCEPTION 'Só o supervisor pode analisar casos.'; END IF;
    UPDATE support_cases SET status = 'reviewing' WHERE id = c.id RETURNING * INTO c;
    PERFORM support_log_event(c, 'case_reviewing', 'human', _actor_user_id, '{}'::jsonb);

  WHEN 'classify' THEN
    IF NOT supervisor THEN RAISE EXCEPTION 'Só o supervisor pode reclassificar casos.'; END IF;
    IF p ? 'department_id' AND nullif(p->>'department_id', '') IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM support_departments
      WHERE id = (p->>'department_id')::uuid AND organization_id = c.organization_id
    ) THEN RAISE EXCEPTION 'Departamento não encontrado.'; END IF;
    UPDATE support_cases SET
      intent = coalesce(nullif(p->>'intent', ''), intent),
      category = coalesce(nullif(p->>'category', ''), category),
      priority = coalesce(nullif(p->>'priority', ''), priority),
      department_id = CASE WHEN p ? 'department_id'
        THEN nullif(p->>'department_id', '')::uuid ELSE department_id END,
      required_skills = CASE WHEN p ? 'required_skills'
        THEN ARRAY(SELECT jsonb_array_elements_text(p->'required_skills')) ELSE required_skills END,
      call_required = coalesce((p->>'call_required')::boolean, call_required)
    WHERE id = c.id RETURNING * INTO c;
    PERFORM support_log_event(c, 'case_classified', 'human', _actor_user_id, jsonb_build_object(
      'intent', c.intent, 'category', c.category, 'priority', c.priority,
      'department_id', c.department_id, 'required_skills', to_jsonb(c.required_skills)));

  WHEN 'request_call' THEN
    UPDATE support_cases SET call_required = true WHERE id = c.id RETURNING * INTO c;
    PERFORM support_log_event(c, 'call_requested', 'human', _actor_user_id, '{}'::jsonb);

  WHEN 'note' THEN
    body := btrim(coalesce(p->>'body', ''));
    IF body = '' THEN RAISE EXCEPTION 'A nota está vazia.'; END IF;
    PERFORM support_log_event(c, 'case_note', 'human', _actor_user_id,
      jsonb_build_object('body', left(body, 2000)));

  WHEN 'return_to_ai', 'resolve' THEN
    give_back := _action = 'return_to_ai' OR coalesce((p->>'return_to_ai')::boolean, true);
    UPDATE support_cases SET status = 'resolved', resolved_at = now(),
      resolution = CASE WHEN _action = 'return_to_ai' THEN 'Devolvido à IA'
        ELSE left(btrim(coalesce(p->>'resolution', '')), 2000) END
    WHERE id = c.id RETURNING * INTO c;
    UPDATE private_conversations SET needs_human = false, escalation_reason = NULL,
      ai_paused = NOT give_back,
      assigned_to = CASE WHEN give_back THEN NULL ELSE assigned_to END,
      status = CASE WHEN _action = 'return_to_ai' THEN 'active' ELSE 'resolved' END::conversation_status
    WHERE id = c.conversation_id;
    PERFORM support_log_event(c, 'case_resolved', 'human', _actor_user_id,
      jsonb_build_object('resolution', c.resolution));
    IF give_back THEN
      PERFORM support_log_event(c, 'ai_resumed', 'human', _actor_user_id, '{}'::jsonb);
    END IF;

  WHEN 'reopen' THEN
    IF is_open THEN RAISE EXCEPTION 'Este caso já está aberto.'; END IF;
    BEGIN
      UPDATE support_cases SET status = 'reopened', resolved_at = NULL, closed_at = NULL,
        resolution = '', first_response_at = NULL, sla_warned_at = NULL, sla_breached_at = NULL,
        sla_deadline = now() + make_interval(mins => sla_minutes)
      WHERE id = c.id RETURNING * INTO c;
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'Esta conversa já tem outro caso aberto.';
    END;
    UPDATE private_conversations SET ai_paused = true, needs_human = true, status = 'waiting'
    WHERE id = c.conversation_id;
    PERFORM support_log_event(c, 'case_reopened', 'human', _actor_user_id,
      jsonb_build_object('reason', nullif(btrim(coalesce(p->>'reason', '')), '')));

  WHEN 'close' THEN
    IF c.status <> 'resolved' THEN RAISE EXCEPTION 'Resolva o caso antes de o fechar.'; END IF;
    UPDATE support_cases SET status = 'closed', closed_at = now() WHERE id = c.id RETURNING * INTO c;
    PERFORM support_log_event(c, 'case_closed', 'human', _actor_user_id, '{}'::jsonb);

  ELSE
    RAISE EXCEPTION 'Acção desconhecida: %', _action;
  END CASE;

  UPDATE support_cases SET last_activity_at = now(), stalled_at = NULL, updated_at = now()
  WHERE id = c.id RETURNING * INTO c;
  RETURN to_jsonb(c);
END $$;

-- 11. Chegou uma mensagem de quem está a ser atendido por uma pessoa.
CREATE FUNCTION public.support_case_inbound(_conversation_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c support_cases;
BEGIN
  SELECT * INTO c FROM support_cases
  WHERE conversation_id = _conversation_id AND status NOT IN ('resolved', 'closed')
  FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE support_cases SET
    status = CASE WHEN status = 'waiting_customer' THEN 'in_progress' ELSE status END,
    last_activity_at = now(), stalled_at = NULL, updated_at = now()
  WHERE id = c.id;
  PERFORM support_log_event(c, 'message_received', 'contact', NULL,
    jsonb_build_object('was_waiting', c.status = 'waiting_customer'));
  RETURN c.id;
END $$;

-- 12. Supervisor automático: prazos e casos parados. Corre de minuto a minuto.
CREATE FUNCTION public.support_sla_sweep() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c support_cases;
  n integer := 0;
BEGIN
  -- Prazo ultrapassado sem resposta de uma pessoa: sobe para o supervisor.
  FOR c IN
    SELECT * FROM support_cases
    WHERE status NOT IN ('resolved', 'closed', 'waiting_customer')
      AND first_response_at IS NULL AND sla_breached_at IS NULL
      AND sla_deadline IS NOT NULL AND sla_deadline <= now()
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE support_cases SET sla_breached_at = now(), status = 'escalated', updated_at = now()
    WHERE id = c.id RETURNING * INTO c;
    PERFORM support_log_event(c, 'sla_breached', 'system', NULL,
      jsonb_build_object('sla_minutes', c.sla_minutes, 'deadline', c.sla_deadline));
    PERFORM support_log_event(c, 'case_escalated', 'system', NULL,
      jsonb_build_object('reason', 'Prazo de resposta ultrapassado', 'from_staff_id', c.assigned_staff_id));
    n := n + 1;
  END LOOP;

  -- Falta um quarto do prazo: avisa.
  FOR c IN
    SELECT * FROM support_cases
    WHERE status NOT IN ('resolved', 'closed', 'waiting_customer')
      AND first_response_at IS NULL AND sla_warned_at IS NULL AND sla_breached_at IS NULL
      AND sla_deadline IS NOT NULL AND sla_deadline > now()
      AND sla_deadline - make_interval(secs => sla_minutes * 15) <= now()
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE support_cases SET sla_warned_at = now() WHERE id = c.id RETURNING * INTO c;
    PERFORM support_log_event(c, 'sla_warning', 'system', NULL,
      jsonb_build_object('sla_minutes', c.sla_minutes, 'deadline', c.sla_deadline));
    n := n + 1;
  END LOOP;

  -- Já houve resposta, mas o caso está parado há uma hora.
  FOR c IN
    SELECT * FROM support_cases
    WHERE status IN ('assigned', 'in_progress', 'reopened', 'escalated', 'reviewing', 'waiting_team')
      AND first_response_at IS NOT NULL AND stalled_at IS NULL
      AND last_activity_at < now() - interval '60 minutes'
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE support_cases SET stalled_at = now() WHERE id = c.id RETURNING * INTO c;
    PERFORM support_log_event(c, 'case_stalled', 'system', NULL,
      jsonb_build_object('last_activity_at', c.last_activity_at));
    n := n + 1;
  END LOOP;

  RETURN n;
END $$;

-- 13. Convites: quem é convidado para uma equipa entra na organização de quem
-- convidou e não ganha um workspace próprio vazio. A adesão é sempre criada
-- pelo servidor; este campo só evita o workspace a mais.
CREATE OR REPLACE FUNCTION public.handle_new_novawebinar_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_organization_id uuid;
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', ''), new.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  IF new.raw_user_meta_data ? 'invited_to_organization' THEN RETURN new; END IF;
  INSERT INTO public.organizations (name, slug, created_by)
  VALUES (COALESCE(NULLIF(new.raw_user_meta_data->>'full_name', ''), 'Meu Workspace'),
    'workspace-' || replace(new.id::text, '-', ''), new.id)
  RETURNING id INTO new_organization_id;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_organization_id, new.id, 'owner');
  RETURN new;
END;
$$;

CREATE FUNCTION public.auth_user_id_for_email(_email text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(btrim(_email)) LIMIT 1;
$$;

-- 14. Quem pode chamar o quê.
REVOKE EXECUTE ON FUNCTION public.handle_new_novawebinar_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_support_setup(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.support_presence(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_support_setup(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.support_presence(uuid, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.support_seed_defaults(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.support_staff_for_user(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.support_log_event(public.support_cases, text, text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.support_log_conversation_event(uuid, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.open_support_case(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.support_case_action(uuid, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.support_case_inbound(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.support_sla_sweep() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auth_user_id_for_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_seed_defaults(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.support_staff_for_user(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.support_log_event(public.support_cases, text, text, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.support_log_conversation_event(uuid, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.open_support_case(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.support_case_action(uuid, text, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.support_case_inbound(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.support_sla_sweep() TO service_role;
GRANT EXECUTE ON FUNCTION public.auth_user_id_for_email(text) TO service_role;

-- 15. Organizações que já existem.
DO $$
DECLARE o record;
BEGIN
  FOR o IN SELECT id FROM public.organizations LOOP
    PERFORM public.support_seed_defaults(o.id);
  END LOOP;
END $$;
