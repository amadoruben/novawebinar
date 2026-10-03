-- Webinar + Automação + Workflow: captura externa (formulário embed ou API), automações com
-- passos (esperas, ramos, mensagens por canal) e o workflow que as agrupa por webinar.
--
-- Uma só fonte de verdade: a automação (gatilho, condições de entrada, passos). O workflow
-- é o agrupamento visual das automações de um webinar e guarda só o que não se executa
-- (páginas externas, origens de tráfego e posições no canvas). O motor é o mesmo do Bloco 4:
-- automation_dispatch cria a execução, automation_runs_tick confirma as condições, o
-- servidor reserva (claim_automation_runs) e executa; a execução passa a avançar passo a
-- passo (advance_automation_run) com as esperas no mesmo agendamento (scheduled_for).
-- Só acrescenta: nada é apagado e as automações existentes (sem passos) funcionam como antes.

-- 1. Formulários de inscrição: a página continua externa; o formulário (embed ou API)
-- identifica o webinar e, por ele, a organização. O browser nunca a escolhe.
CREATE TABLE public.registration_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  webinar_id uuid NOT NULL REFERENCES public.webinars(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  -- A página externa onde o formulário vive (WordPress, Framer, HTML...).
  page_name text CHECK (page_name IS NULL OR length(page_name) <= 120),
  page_url text CHECK (page_url IS NULL OR (page_url ~ '^https?://\S+$' AND length(page_url) <= 2000)),
  -- Origens autorizadas (https://meusite.com). Vazio: qualquer origem, com limite de ritmo.
  allowed_origins text[] NOT NULL DEFAULT '{}' CHECK (cardinality(allowed_origins) <= 10),
  ask_phone boolean NOT NULL DEFAULT true,
  require_phone boolean NOT NULL DEFAULT false,
  -- Com texto, o consentimento é obrigatório e fica gravado na inscrição.
  consent_text text CHECK (consent_text IS NULL OR length(consent_text) <= 500),
  success_message text CHECK (success_message IS NULL OR length(success_message) <= 300),
  redirect_url text CHECK (redirect_url IS NULL OR (redirect_url ~ '^https?://\S+$' AND length(redirect_url) <= 2000)),
  active boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT registration_forms_id_org_key UNIQUE (id, organization_id)
);
CREATE INDEX registration_forms_webinar_idx ON public.registration_forms (webinar_id);
CREATE TRIGGER registration_forms_touch BEFORE UPDATE ON public.registration_forms
  FOR EACH ROW EXECUTE FUNCTION public.automations_touch();

ALTER TABLE public.registration_forms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.registration_forms FROM anon, authenticated;
GRANT SELECT ON public.registration_forms TO authenticated;
GRANT INSERT (organization_id, webinar_id, name, page_name, page_url, allowed_origins, ask_phone,
              require_phone, consent_text, success_message, redirect_url, active)
  ON public.registration_forms TO authenticated;
GRANT UPDATE (name, page_name, page_url, allowed_origins, ask_phone, require_phone, consent_text,
              success_message, redirect_url, active)
  ON public.registration_forms TO authenticated;
GRANT ALL ON public.registration_forms TO service_role;
CREATE POLICY registration_forms_read ON public.registration_forms FOR SELECT TO authenticated
  USING (public.is_organization_member(organization_id));
CREATE POLICY registration_forms_insert ON public.registration_forms FOR INSERT TO authenticated
  WITH CHECK (
    public.has_organization_role(organization_id, ARRAY['owner', 'admin', 'member']::workspace_role[])
    AND EXISTS (SELECT 1 FROM public.webinars w
                 WHERE w.id = registration_forms.webinar_id
                   AND w.organization_id = registration_forms.organization_id));
CREATE POLICY registration_forms_update ON public.registration_forms FOR UPDATE TO authenticated
  USING (public.has_organization_role(organization_id, ARRAY['owner', 'admin', 'member']::workspace_role[]))
  WITH CHECK (public.has_organization_role(organization_id, ARRAY['owner', 'admin', 'member']::workspace_role[]));

-- 2. Inscrição: de onde veio (sala, formulário embed, API), o formulário, o consentimento,
-- o identificador da submissão (a mesma submissão repetida não cria outra inscrição no mesmo
-- webinar, com ou sem formulário) e o utm_term (as outras quatro UTM e o referrer já existem).
ALTER TABLE public.participants
  ADD COLUMN form_id uuid REFERENCES public.registration_forms(id) ON DELETE SET NULL,
  ADD COLUMN registration_source text CHECK (registration_source IN ('room', 'embed', 'api')),
  ADD COLUMN consent_at timestamptz,
  ADD COLUMN submission_id text CHECK (submission_id IS NULL OR length(submission_id) BETWEEN 8 AND 100),
  ADD COLUMN utm_term text CHECK (utm_term IS NULL OR length(utm_term) <= 120);
CREATE UNIQUE INDEX participants_webinar_submission_key ON public.participants (webinar_id, submission_id)
  WHERE submission_id IS NOT NULL;

-- 3. Workflows: o agrupamento visual das automações de um webinar. O canvas guarda só o que
-- não se executa (páginas, origens, posições); a lógica fica nas automações.
CREATE TABLE public.automation_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  webinar_id uuid REFERENCES public.webinars(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  canvas jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(canvas) = 'object' AND pg_column_size(canvas) < 200000),
  archived_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT automation_workflows_id_org_key UNIQUE (id, organization_id)
);
CREATE INDEX automation_workflows_webinar_idx ON public.automation_workflows (webinar_id);
CREATE TRIGGER automation_workflows_touch BEFORE UPDATE ON public.automation_workflows
  FOR EACH ROW EXECUTE FUNCTION public.automations_touch();

ALTER TABLE public.automation_workflows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.automation_workflows FROM anon, authenticated;
GRANT SELECT ON public.automation_workflows TO authenticated;
GRANT INSERT (organization_id, webinar_id, name, canvas) ON public.automation_workflows TO authenticated;
GRANT UPDATE (name, canvas, archived_at) ON public.automation_workflows TO authenticated;
GRANT ALL ON public.automation_workflows TO service_role;
CREATE POLICY automation_workflows_read ON public.automation_workflows FOR SELECT TO authenticated
  USING (public.is_organization_member(organization_id));
CREATE POLICY automation_workflows_insert ON public.automation_workflows FOR INSERT TO authenticated
  WITH CHECK (
    public.has_organization_role(organization_id, ARRAY['owner', 'admin', 'member']::workspace_role[])
    AND (webinar_id IS NULL OR EXISTS (
      SELECT 1 FROM public.webinars w
       WHERE w.id = automation_workflows.webinar_id
         AND w.organization_id = automation_workflows.organization_id)));
CREATE POLICY automation_workflows_update ON public.automation_workflows FOR UPDATE TO authenticated
  USING (public.has_organization_role(organization_id, ARRAY['owner', 'admin', 'member']::workspace_role[]))
  WITH CHECK (public.has_organization_role(organization_id, ARRAY['owner', 'admin', 'member']::workspace_role[]));

-- 4. Factos por pessoa: mais "entrou" (começou a ver), "viu o pitch" e "saiu cedo" (assistiu
-- e saiu antes da oferta), das colunas de participant_facts (Blocos 1–3). Nada é recalculado.
CREATE OR REPLACE FUNCTION public.automation_session_facts(_session_id uuid)
RETURNS TABLE (contact_id uuid, facts jsonb)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT f.contact_id, jsonb_build_object(
           'entered', bool_or(f.first_progress_at IS NOT NULL OR f.actual_watch_seconds > 0),
           'attended', bool_or(f.attended),
           'actual_watch_seconds', max(f.actual_watch_seconds),
           'reached_pitch', bool_or(f.reached_pitch),
           'left_early', bool_or(f.attended) AND bool_or(f.offer_start_seconds IS NOT NULL)
                         AND NOT bool_or(f.reached_offer),
           'saw_offer', bool_or(f.saw_offer),
           'clicked', bool_or(f.clicked),
           'checkout_started', bool_or(f.checkout_started),
           'purchased', bool_or(f.purchased),
           'payment_failed', bool_or(f.payment_failed),
           'checkout_abandoned', bool_or(f.checkout_abandoned),
           'participations', count(*))
    FROM public.participant_facts f
   WHERE f.webinar_session_id = _session_id AND f.contact_id IS NOT NULL
   GROUP BY f.contact_id
$$;

CREATE OR REPLACE FUNCTION public.automation_contact_facts(_contact_id uuid, _webinar_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE WHEN count(*) = 0 THEN '{}'::jsonb ELSE jsonb_build_object(
           'entered', bool_or(f.first_progress_at IS NOT NULL OR f.actual_watch_seconds > 0),
           'attended', bool_or(f.attended),
           'actual_watch_seconds', max(f.actual_watch_seconds),
           'reached_pitch', bool_or(f.reached_pitch),
           'left_early', bool_or(f.attended) AND bool_or(f.offer_start_seconds IS NOT NULL)
                         AND NOT bool_or(f.reached_offer),
           'saw_offer', bool_or(f.saw_offer),
           'clicked', bool_or(f.clicked),
           'checkout_started', bool_or(f.checkout_started),
           'purchased', bool_or(f.purchased),
           'payment_failed', bool_or(f.payment_failed),
           'checkout_abandoned', bool_or(f.checkout_abandoned),
           'participations', count(*)) END
    FROM public.participant_facts f
   WHERE f.contact_id = _contact_id AND (_webinar_id IS NULL OR f.webinar_id = _webinar_id)
$$;

-- O executor (servidor) lê os factos de agora antes de cada passo.
GRANT EXECUTE ON FUNCTION public.automation_session_facts(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.automation_contact_facts(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.automation_conditions_valid(_conditions jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN jsonb_typeof(_conditions) IS DISTINCT FROM 'array' THEN false
    WHEN jsonb_array_length(_conditions) > 8 THEN false
    ELSE coalesce((
      SELECT bool_and(CASE
        WHEN jsonb_typeof(c) <> 'object' THEN false
        WHEN c->>'fact' IN ('entered', 'attended', 'reached_pitch', 'left_early', 'saw_offer', 'clicked',
                            'checkout_started', 'purchased', 'payment_failed', 'checkout_abandoned')
          THEN jsonb_typeof(c->'value') = 'boolean' AND c - 'fact' - 'value' = '{}'::jsonb
        WHEN c->>'fact' = 'actual_watch_seconds'
          THEN coalesce(c->>'op' IN ('gte', 'lt'), false)
           AND c - 'fact' - 'op' - 'value' = '{}'::jsonb
           AND CASE WHEN jsonb_typeof(c->'value') = 'number'
                    THEN (c->>'value')::numeric BETWEEN 0 AND 86400 ELSE false END
        ELSE false END)
      FROM jsonb_array_elements(_conditions) c), true)
  END
$$;

-- 5. Passos de uma automação: {"start": id, "nodes": [...]}. Cada nó aponta para o seguinte
-- (next) e um ramo para "sim" e "não" (yes/no). Tipos:
--   wait    mode delay | before_session | after_session (minutes) ou until (at)
--   branch  condition (as mesmas condições das automações)
--   action  sends: canal (email, whatsapp, sms, webhook) + destino (contact, group, webhook)
--           + conteúdo. Os nós podem nascer sem conteúdo: a configuração fica preparada.
-- Os apontadores têm de existir; ciclos e alcance validam-se na aplicação e o executor
-- tem um limite de passos por execução.
CREATE FUNCTION public.automation_steps_valid(_steps jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  WITH n AS (
    SELECT x AS node FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(_steps->'nodes') = 'array' THEN _steps->'nodes' ELSE '[]'::jsonb END) x
  ), ids AS (
    SELECT node->>'id' AS id FROM n
  )
  SELECT jsonb_typeof(_steps) = 'object'
     AND jsonb_typeof(_steps->'nodes') = 'array'
     AND jsonb_array_length(_steps->'nodes') <= 60
     AND (SELECT count(*) = count(DISTINCT id) FROM ids)
     AND coalesce(jsonb_typeof(_steps->'start') IN ('null', 'string'), true)
     AND (_steps->>'start' IS NULL OR _steps->>'start' IN (SELECT id FROM ids))
     AND coalesce((SELECT bool_and(
           jsonb_typeof(node) = 'object'
       AND coalesce(length(node->>'id') BETWEEN 1 AND 40, false)
       AND coalesce(length(node->>'label') <= 120, true)
       AND (node->>'next' IS NULL OR node->>'next' IN (SELECT id FROM ids))
       AND CASE node->>'kind'
         WHEN 'wait' THEN
           CASE node->>'mode'
             WHEN 'until' THEN coalesce(length(node->>'at') BETWEEN 10 AND 40, false)
             WHEN 'delay' THEN coalesce((node->>'minutes')::numeric BETWEEN 0 AND 43200, false)
             WHEN 'before_session' THEN coalesce((node->>'minutes')::numeric BETWEEN 0 AND 43200, false)
             WHEN 'after_session' THEN coalesce((node->>'minutes')::numeric BETWEEN 0 AND 43200, false)
             ELSE false END
         WHEN 'branch' THEN
           public.automation_conditions_valid(jsonb_build_array(node->'condition'))
           AND (node->>'yes' IS NULL OR node->>'yes' IN (SELECT id FROM ids))
           AND (node->>'no' IS NULL OR node->>'no' IN (SELECT id FROM ids))
         WHEN 'action' THEN
           jsonb_typeof(node->'sends') = 'array' AND jsonb_array_length(node->'sends') <= 6
           AND coalesce((SELECT bool_and(
                 s->>'channel' IN ('email', 'whatsapp', 'sms', 'webhook')
             AND s->>'target' IN ('contact', 'group', 'webhook')
             AND coalesce(length(s->>'group') <= 120, true)
             AND coalesce(length(s->>'subject') <= 200, true)
             AND coalesce(length(s->>'message') <= 4000, true))
             FROM jsonb_array_elements(node->'sends') s), true)
         ELSE false END)
       FROM n), true)
$$;

-- 6. Automações: passos, workflow e os gatilhos novos (inscrição, sessão começou, reembolso).
ALTER TABLE public.automations
  ADD COLUMN workflow_id uuid,
  ADD COLUMN steps jsonb CHECK (steps IS NULL OR public.automation_steps_valid(steps)),
  ADD CONSTRAINT automations_workflow_fk FOREIGN KEY (workflow_id, organization_id)
    REFERENCES public.automation_workflows(id, organization_id) ON DELETE SET NULL (workflow_id);
CREATE INDEX automations_workflow_idx ON public.automations (workflow_id);
GRANT INSERT (workflow_id, steps) ON public.automations TO authenticated;
GRANT UPDATE (workflow_id, steps) ON public.automations TO authenticated;

ALTER TABLE public.automations DROP CONSTRAINT automations_trigger_event_check;
ALTER TABLE public.automations ADD CONSTRAINT automations_trigger_event_check
  CHECK (trigger_event IN ('webinar_registered', 'webinar_session_started', 'webinar_session_ended',
                           'webinar_attended', 'offer_viewed', 'offer_clicked', 'checkout_started',
                           'purchase_approved', 'payment_failed', 'checkout_abandoned', 'purchase_refunded'));

-- Não se activa uma acção sem fornecedor: fora das contas de teste (onde tudo é simulado),
-- só o webhook de saída tem executor real. A configuração pode ficar preparada, desligada.
CREATE FUNCTION public.automations_channels_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE missing text;
BEGIN
  IF NEW.active AND NEW.steps IS NOT NULL
     AND NOT coalesce((SELECT o.is_test FROM organizations o WHERE o.id = NEW.organization_id), false) THEN
    SELECT string_agg(DISTINCT s->>'channel', ', ') INTO missing
      FROM jsonb_array_elements(NEW.steps->'nodes') n
     CROSS JOIN LATERAL jsonb_array_elements(coalesce(n->'sends', '[]'::jsonb)) s
     WHERE n->>'kind' = 'action' AND s->>'channel' <> 'webhook';
    IF missing IS NOT NULL THEN
      RAISE EXCEPTION 'Sem fornecedor configurado para: %. Guarde a automação desligada.', missing
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.automations_channels_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER automations_channels_guard BEFORE INSERT OR UPDATE OF active, steps ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.automations_channels_guard();

-- 7. Execuções: em que passo está (cursor), o que já fez (steps_log) e as condições dos
-- ramos por onde passou (guards), confirmadas outra vez antes de cada acção.
ALTER TABLE public.automation_runs
  ADD COLUMN cursor text CHECK (cursor IS NULL OR length(cursor) <= 40),
  ADD COLUMN steps_log jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(steps_log) = 'array'),
  ADD COLUMN guards jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (public.automation_conditions_valid(guards));

-- 8. Eventos canónicos novos, cada um gravado uma vez (dedupe_key).
-- Inscrição: uma por pessoa, webinar e sessão (duas inscrições da mesma pessoa = um evento).
CREATE FUNCTION public.participants_emit_registered() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.contact_id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO activity_events (organization_id, contact_id, webinar_id, name, actor_kind, occurred_at, dedupe_key, data)
  VALUES (NEW.organization_id, NEW.contact_id, NEW.webinar_id, 'webinar_registered', 'contact', NEW.joined_at,
          'webinar_registered:' || NEW.webinar_id || ':' || coalesce(NEW.webinar_session_id::text, '-') || ':' || NEW.contact_id,
          jsonb_build_object('participant_id', NEW.id, 'session_id', NEW.webinar_session_id,
                             'source', coalesce(NEW.registration_source, 'room'), 'form_id', NEW.form_id,
                             'utm_source', NEW.utm_source, 'utm_medium', NEW.utm_medium,
                             'utm_campaign', NEW.utm_campaign, 'utm_content', NEW.utm_content,
                             'utm_term', NEW.utm_term, 'referrer', NEW.referrer,
                             'consent', NEW.consent_at IS NOT NULL))
  ON CONFLICT (organization_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.participants_emit_registered() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER participants_emit_registered AFTER INSERT ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.participants_emit_registered();

-- Sessão começou: gravado pelo mesmo varrimento que já marca o arranque e o fim.
CREATE OR REPLACE FUNCTION public.sweep_webinar_sessions() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ended integer;
BEGIN
  WITH started AS (
    UPDATE webinar_sessions s SET state = 'live'
      FROM webinars w
     WHERE w.id = s.webinar_id
       AND s.state = 'scheduled' AND s.starts_at <= now()
       AND w.status <> 'draft'
       AND (w.recurrence_enabled OR w.schedule_mode = 'jit' OR w.scheduled_at = s.starts_at)
    RETURNING s.id, s.organization_id, s.webinar_id, s.starts_at, s.ends_at
  )
  INSERT INTO activity_events (organization_id, webinar_id, name, actor_kind, occurred_at, dedupe_key, data)
  SELECT st.organization_id, st.webinar_id, 'webinar_session_started', 'system', st.starts_at,
         'webinar_session_started:' || st.id,
         jsonb_build_object('session_id', st.id, 'starts_at', st.starts_at, 'ends_at', st.ends_at,
                            'detected_at', now(), 'source', 'sweep_webinar_sessions')
    FROM started st
  ON CONFLICT (organization_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  WITH done AS (
    UPDATE webinar_sessions SET state = 'finished', ended_at = now()
     WHERE state = 'live' AND ended_at IS NULL AND ends_at IS NOT NULL AND ends_at <= now()
    RETURNING id, organization_id, webinar_id, starts_at, ends_at, ended_at
  )
  INSERT INTO activity_events (organization_id, webinar_id, name, actor_kind, occurred_at, dedupe_key, data)
  SELECT d.organization_id, d.webinar_id, 'webinar_session_ended', 'system', d.ends_at,
         'webinar_session_ended:' || d.id,
         jsonb_build_object(
           'session_id', d.id, 'starts_at', d.starts_at, 'ends_at', d.ends_at,
           'detected_at', d.ended_at, 'source', 'sweep_webinar_sessions',
           'registered', c.registered, 'attended', c.attended)
    FROM done d
    CROSS JOIN LATERAL (
      SELECT count(DISTINCT f.person_id) AS registered,
             count(DISTINCT f.person_id) FILTER (WHERE f.attended) AS attended
        FROM participant_facts f
       WHERE f.webinar_session_id = d.id
    ) c
  ON CONFLICT (organization_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS ended = ROW_COUNT;
  RETURN ended;
END $$;

-- Reembolso: o desfecho do pagamento, como os outros estados.
CREATE OR REPLACE FUNCTION public.purchases_emit_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ename text := CASE NEW.status
  WHEN 'approved' THEN 'purchase_approved'
  WHEN 'failed' THEN 'payment_failed'
  WHEN 'abandoned' THEN 'checkout_abandoned'
  WHEN 'refunded' THEN 'purchase_refunded' END;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_events (organization_id, contact_id, webinar_id, name, actor_kind, occurred_at, dedupe_key, data)
    VALUES (NEW.organization_id, NEW.contact_id, NEW.webinar_id, 'checkout_started', 'system', NEW.created_at,
            'checkout_started:' || NEW.id,
            jsonb_build_object('purchase_id', NEW.id, 'status', NEW.status, 'product', NEW.product_name,
                               'amount', NEW.amount_value, 'currency', NEW.currency, 'provider', NEW.provider,
                               'source', 'real_purchase_events'))
    ON CONFLICT (organization_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  END IF;
  IF ename IS NULL OR (TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NULL;
  END IF;
  INSERT INTO activity_events (organization_id, contact_id, webinar_id, name, actor_kind, occurred_at, dedupe_key, data)
  VALUES (NEW.organization_id, NEW.contact_id, NEW.webinar_id, ename, 'system', coalesce(NEW.status_at, now()),
          ename || ':' || NEW.id,
          jsonb_build_object('purchase_id', NEW.id, 'status', NEW.status, 'product', NEW.product_name,
                             'amount', NEW.amount_value, 'currency', NEW.currency, 'provider', NEW.provider,
                             'source', 'real_purchase_events'))
  ON CONFLICT (organization_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  RETURN NULL;
END $$;

-- 9. Despacho: os gatilhos de sessão (começou, terminou) entram todos os inscritos da sessão;
-- os de pessoa, o contacto do evento, com a sessão quando o evento a traz (inscrição).
-- _automation_id: só essa automação (usado para aplicar uma automação nova a ocorrências
-- recentes, na conta de teste); por omissão, todas as activas.
DROP FUNCTION public.automation_dispatch(bigint);
CREATE FUNCTION public.automation_dispatch(_event_id bigint, _automation_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ev activity_events;
  created integer;
BEGIN
  SELECT * INTO ev FROM activity_events WHERE id = _event_id
     AND name IN ('webinar_registered', 'webinar_session_started', 'webinar_session_ended',
                  'webinar_attended', 'offer_viewed', 'offer_clicked', 'checkout_started',
                  'purchase_approved', 'payment_failed', 'checkout_abandoned', 'purchase_refunded');
  IF NOT FOUND THEN RETURN 0; END IF;

  IF ev.name IN ('webinar_session_ended', 'webinar_session_started') THEN
    INSERT INTO automation_runs (organization_id, automation_id, event_id, occurrence_key, contact_id,
                                 webinar_id, webinar_session_id, status, scheduled_for, facts)
    SELECT s.organization_id, a.id, ev.id, ev.name || ':' || s.id, f.contact_id,
           s.webinar_id, s.id,
           CASE WHEN ev.occurred_at + make_interval(mins => a.wait_minutes) <= now()
                THEN 'ready' ELSE 'waiting' END,
           ev.occurred_at + make_interval(mins => a.wait_minutes), f.facts
      FROM webinar_sessions s
      JOIN automations a ON a.organization_id = s.organization_id AND a.active
       AND a.trigger_event = ev.name
       AND (a.webinar_id IS NULL OR a.webinar_id = s.webinar_id)
       AND (_automation_id IS NULL OR a.id = _automation_id)
     CROSS JOIN LATERAL automation_session_facts(s.id) f
     WHERE s.id = (ev.data->>'session_id')::uuid
       AND s.organization_id = ev.organization_id
       AND automation_conditions_met(a.conditions, f.facts)
    ON CONFLICT ON CONSTRAINT automation_runs_once DO NOTHING;
  ELSE
    IF ev.contact_id IS NULL THEN RETURN 0; END IF;
    INSERT INTO automation_runs (organization_id, automation_id, event_id, occurrence_key, contact_id,
                                 webinar_id, webinar_session_id, status, scheduled_for, facts)
    SELECT ev.organization_id, a.id, ev.id,
           coalesce(ev.dedupe_key, ev.name || ':' || ev.id), ev.contact_id,
           ev.webinar_id,
           (SELECT s.id FROM webinar_sessions s
             WHERE s.id::text = ev.data->>'session_id' AND s.organization_id = ev.organization_id),
           CASE WHEN ev.occurred_at + make_interval(mins => a.wait_minutes) <= now()
                THEN 'ready' ELSE 'waiting' END,
           ev.occurred_at + make_interval(mins => a.wait_minutes), f.facts
      FROM automations a
     CROSS JOIN LATERAL (SELECT automation_contact_facts(ev.contact_id, ev.webinar_id) AS facts) f
     WHERE a.organization_id = ev.organization_id AND a.active
       AND a.trigger_event = ev.name
       AND (a.webinar_id IS NULL OR a.webinar_id = ev.webinar_id)
       AND (_automation_id IS NULL OR a.id = _automation_id)
       AND automation_conditions_met(a.conditions, f.facts)
    ON CONFLICT ON CONSTRAINT automation_runs_once DO NOTHING;
  END IF;
  GET DIAGNOSTICS created = ROW_COUNT;
  RETURN created;
END $$;
REVOKE EXECUTE ON FUNCTION public.automation_dispatch(bigint, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.automation_dispatch(bigint, uuid) TO service_role;

DROP TRIGGER activity_events_automations ON public.activity_events;
CREATE TRIGGER activity_events_automations AFTER INSERT ON public.activity_events
  FOR EACH ROW WHEN (NEW.name IN ('webinar_registered', 'webinar_session_started', 'webinar_session_ended',
                                  'webinar_attended', 'offer_viewed', 'offer_clicked', 'checkout_started',
                                  'purchase_approved', 'payment_failed', 'checkout_abandoned',
                                  'purchase_refunded'))
  EXECUTE FUNCTION public.activity_events_automations();

-- 10. Tick: os factos das execuções de sessão (começou ou terminou) são os da sessão.
CREATE OR REPLACE FUNCTION public.automation_runs_tick() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE made_ready integer;
BEGIN
  INSERT INTO activity_events (organization_id, contact_id, webinar_id, name, actor_kind, occurred_at, dedupe_key, data)
  SELECT r.organization_id, r.contact_id, r.webinar_id, 'checkout_abandoned', 'system',
         r.status_at + make_interval(hours => s.hours), 'checkout_abandoned:' || r.id,
         jsonb_build_object('purchase_id', r.id, 'status', r.status, 'product', r.product_name,
                            'amount', r.amount_value, 'currency', r.currency, 'provider', r.provider,
                            'source', 'automation_runs_tick', 'pending_hours', s.hours)
    FROM real_purchase_events r
   CROSS JOIN (SELECT intelligence_setting('checkout_abandoned_hours')::integer AS hours) s
   WHERE r.status = 'pending'
     AND r.status_at < now() - make_interval(hours => s.hours)
     AND r.status_at > now() - make_interval(hours => s.hours) - interval '7 days'
  ON CONFLICT (organization_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  UPDATE automation_runs SET
      status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'waiting' END,
      scheduled_for = CASE WHEN attempts >= 3 THEN scheduled_for ELSE now() END,
      finished_at = CASE WHEN attempts >= 3 THEN now() END,
      error = 'A execução foi interrompida antes de terminar.',
      locked_until = NULL, updated_at = now()
   WHERE status = 'running' AND locked_until < now();

  WITH due AS (
    SELECT r.id, r.status, a.active, f.facts,
           automation_conditions_met(a.conditions, f.facts) AS holds
      FROM automation_runs r
      JOIN automations a ON a.id = r.automation_id
      LEFT JOIN LATERAL (
        SELECT CASE WHEN r.occurrence_key LIKE 'webinar_session_%'
          THEN (SELECT sf.facts FROM automation_session_facts(r.webinar_session_id) sf
                 WHERE sf.contact_id = r.contact_id)
          ELSE automation_contact_facts(r.contact_id, r.webinar_id) END AS facts) f ON true
     WHERE r.status IN ('waiting', 'ready') AND r.scheduled_for <= now()
       FOR UPDATE OF r SKIP LOCKED
  )
  UPDATE automation_runs r SET
      status = CASE WHEN d.active AND d.holds THEN 'ready' ELSE 'cancelled' END,
      finished_at = CASE WHEN d.active AND d.holds THEN NULL ELSE now() END,
      result = CASE WHEN d.active AND d.holds THEN r.result
                    ELSE jsonb_build_object(
                      'cancelled', CASE WHEN d.active THEN 'conditions' ELSE 'inactive' END,
                      'facts', d.facts) END,
      updated_at = now()
    FROM due d
   WHERE r.id = d.id AND r.status = d.status
     AND (r.status = 'waiting' OR NOT (d.active AND d.holds));
  GET DIAGNOSTICS made_ready = ROW_COUNT;
  RETURN made_ready;
END $$;

-- 11. Avanço de uma execução com passos (servidor). Só uma execução reservada muda.
--   next       passa ao passo seguinte (cursor), a partir de scheduled_for; tentativas a zero
--   done       chegou ao fim
--   cancelled  deixou de cumprir as condições (entrada ou ramo) antes de uma acção
--   failed     passo impossível (ex.: canal sem fornecedor)
-- As falhas passageiras de uma acção usam finish_automation_run (mesmo passo, nova tentativa).
CREATE FUNCTION public.advance_automation_run(
  _run_id uuid, _status text, _cursor text, _scheduled_for timestamptz,
  _guards jsonb, _log jsonb, _result jsonb, _error text
) RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE automation_runs SET
      status = CASE WHEN _status = 'next'
                    THEN CASE WHEN coalesce(_scheduled_for, now()) <= now() THEN 'ready' ELSE 'waiting' END
                    ELSE _status END,
      cursor = _cursor,
      scheduled_for = coalesce(_scheduled_for, scheduled_for),
      attempts = CASE WHEN _status = 'next' THEN 0 ELSE attempts END,
      guards = coalesce(_guards, guards),
      steps_log = steps_log || coalesce(_log, '[]'::jsonb),
      finished_at = CASE WHEN _status IN ('done', 'cancelled', 'failed') THEN now() END,
      result = coalesce(_result, result),
      error = _error,
      locked_until = NULL, updated_at = now()
   WHERE id = _run_id AND status = 'running' AND _status IN ('next', 'done', 'cancelled', 'failed')
  RETURNING status;
$$;
REVOKE EXECUTE ON FUNCTION public.advance_automation_run(uuid, text, text, timestamptz, jsonb, jsonb, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advance_automation_run(uuid, text, text, timestamptz, jsonb, jsonb, jsonb, text)
  TO service_role;

-- 12. Aplicar uma automação às ocorrências recentes do seu gatilho (servidor; conta de teste).
-- Idempotente como o despacho: quem já tem execução para a ocorrência não entra outra vez.
CREATE FUNCTION public.automation_apply_recent(_automation_id uuid, _days integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a automations;
  total integer := 0;
  e record;
BEGIN
  SELECT * INTO a FROM automations WHERE id = _automation_id AND active;
  IF NOT FOUND THEN RETURN 0; END IF;
  FOR e IN
    SELECT id FROM activity_events
     WHERE organization_id = a.organization_id AND name = a.trigger_event
       AND (a.webinar_id IS NULL OR webinar_id = a.webinar_id)
       AND occurred_at > now() - make_interval(days => least(greatest(_days, 1), 90))
     ORDER BY occurred_at
  LOOP
    total := total + automation_dispatch(e.id, a.id);
  END LOOP;
  RETURN total;
END $$;
REVOKE EXECUTE ON FUNCTION public.automation_apply_recent(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.automation_apply_recent(uuid, integer) TO service_role;

NOTIFY pgrst, 'reload schema';
