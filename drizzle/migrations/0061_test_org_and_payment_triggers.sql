-- Base de teste e automações nos pagamentos.
-- 1. Conta de teste: marcada pelo sistema (o browser não a pode mudar). Nada dela sai para
--    destinos reais: o webhook de saída é simulado no servidor. Pode ser apagada inteira.
-- 2. Os pagamentos (Bloco 2) passam a gravar o seu evento canónico quando o estado muda:
--    purchase_approved, payment_failed e checkout_abandoned, uma vez por pagamento (a mesma
--    chave anti-duplicados do Bloco 3). São os novos gatilhos das automações.
-- 3. A linha do tempo (event_log) passa a mostrar as execuções das automações.
-- O caminho do fim de sessão (Bloco 4) fica igual. Só acrescenta: nada é apagado.

-- 1. Conta de teste. authenticated só tem permissões por coluna em organizations: esta
-- coluna nova não lhe é dada, por isso só o sistema a escreve.
ALTER TABLE public.organizations ADD COLUMN is_test boolean NOT NULL DEFAULT false;

-- 2a. Gatilhos disponíveis.
ALTER TABLE public.automations DROP CONSTRAINT automations_trigger_event_check;
ALTER TABLE public.automations ADD CONSTRAINT automations_trigger_event_check
  CHECK (trigger_event IN ('webinar_session_ended', 'purchase_approved', 'payment_failed', 'checkout_abandoned'));
GRANT INSERT (trigger_event), UPDATE (trigger_event) ON public.automations TO authenticated;

-- 2b. Evento canónico de cada mudança de estado de um pagamento. A hora é a do servidor
-- (status_at, preenchida pelo gatilho purchases_status_times).
CREATE FUNCTION public.purchases_emit_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ename text := CASE NEW.status
  WHEN 'approved' THEN 'purchase_approved'
  WHEN 'failed' THEN 'payment_failed'
  WHEN 'abandoned' THEN 'checkout_abandoned' END;
BEGIN
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
REVOKE EXECUTE ON FUNCTION public.purchases_emit_events() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER purchases_emit_events AFTER INSERT OR UPDATE OF status ON public.real_purchase_events
  FOR EACH ROW EXECUTE FUNCTION public.purchases_emit_events();

-- 2c. Factos de uma pessoa fora de uma sessão (pagamentos): as participações do contacto
-- nesse webinar (ou em todos, sem webinar), contadas como nas métricas.
CREATE FUNCTION public.automation_contact_facts(_contact_id uuid, _webinar_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE WHEN count(*) = 0 THEN '{}'::jsonb ELSE jsonb_build_object(
           'attended', bool_or(f.attended),
           'actual_watch_seconds', max(f.actual_watch_seconds),
           'purchased', bool_or(f.purchased),
           'payment_failed', bool_or(f.payment_failed),
           'checkout_abandoned', bool_or(f.checkout_abandoned),
           'participations', count(*)) END
    FROM public.participant_facts f
   WHERE f.contact_id = _contact_id AND (_webinar_id IS NULL OR f.webinar_id = _webinar_id)
$$;
REVOKE EXECUTE ON FUNCTION public.automation_contact_facts(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 2d. Despacho: o fim da sessão continua igual; os pagamentos criam uma execução para o
-- contacto do pagamento. Ocorrência = o pagamento nesse estado.
CREATE OR REPLACE FUNCTION public.automation_dispatch(_event_id bigint) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ev activity_events;
  created integer;
BEGIN
  SELECT * INTO ev FROM activity_events WHERE id = _event_id
     AND name IN ('webinar_session_ended', 'purchase_approved', 'payment_failed', 'checkout_abandoned');
  IF NOT FOUND THEN RETURN 0; END IF;

  IF ev.name = 'webinar_session_ended' THEN
    INSERT INTO automation_runs (organization_id, automation_id, event_id, occurrence_key, contact_id,
                                 webinar_id, webinar_session_id, status, scheduled_for, facts)
    SELECT s.organization_id, a.id, ev.id, 'webinar_session_ended:' || s.id, f.contact_id,
           s.webinar_id, s.id,
           CASE WHEN ev.occurred_at + make_interval(mins => a.wait_minutes) <= now()
                THEN 'ready' ELSE 'waiting' END,
           ev.occurred_at + make_interval(mins => a.wait_minutes), f.facts
      FROM webinar_sessions s
      JOIN automations a ON a.organization_id = s.organization_id AND a.active
       AND a.trigger_event = 'webinar_session_ended'
       AND (a.webinar_id IS NULL OR a.webinar_id = s.webinar_id)
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
           coalesce(ev.dedupe_key, ev.name || ':' || (ev.data->>'purchase_id')), ev.contact_id,
           ev.webinar_id, NULL,
           CASE WHEN ev.occurred_at + make_interval(mins => a.wait_minutes) <= now()
                THEN 'ready' ELSE 'waiting' END,
           ev.occurred_at + make_interval(mins => a.wait_minutes), f.facts
      FROM automations a
     CROSS JOIN LATERAL (SELECT automation_contact_facts(ev.contact_id, ev.webinar_id) AS facts) f
     WHERE a.organization_id = ev.organization_id AND a.active
       AND a.trigger_event = ev.name
       AND (a.webinar_id IS NULL OR a.webinar_id = ev.webinar_id)
       AND automation_conditions_met(a.conditions, f.facts)
    ON CONFLICT ON CONSTRAINT automation_runs_once DO NOTHING;
  END IF;
  GET DIAGNOSTICS created = ROW_COUNT;
  RETURN created;
END $$;

DROP TRIGGER activity_events_automations ON public.activity_events;
CREATE TRIGGER activity_events_automations AFTER INSERT ON public.activity_events
  FOR EACH ROW WHEN (NEW.name IN ('webinar_session_ended', 'purchase_approved', 'payment_failed', 'checkout_abandoned'))
  EXECUTE FUNCTION public.activity_events_automations();

-- 2e. De minuto a minuto: um pagamento pendente há mais horas do que o parâmetro passa a
-- abandonado (a mesma regra dos factos do Bloco 2) e grava o seu evento uma vez. As
-- execuções de pagamentos são confirmadas com os factos do contacto; as de sessões como antes.
-- ponytail: só pendentes dos últimos 7 dias, para uma base com carrinhos antigos não
-- disparar automações sobre eles de uma vez.
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
        SELECT CASE WHEN r.occurrence_key LIKE 'webinar_session_ended:%'
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

-- 3. Linha do tempo com as automações.
CREATE OR REPLACE VIEW public.event_log WITH (security_invoker = on) AS
SELECT p.organization_id, p.webinar_id, p.webinar_session_id AS session_id, p.contact_id,
       p.id AS participant_id, 'registered'::text AS name, p.joined_at AS occurred_at,
       NULL::integer AS video_second, 'participants'::text AS source, p.id::text AS source_id,
       jsonb_build_object('mode', p.viewing_mode) AS data
  FROM public.participants p
UNION ALL
SELECT p.organization_id, p.webinar_id, p.webinar_session_id, p.contact_id, p.id,
       'started_watching', p.first_progress_at, p.entry_seconds, 'participants', p.id::text, '{}'::jsonb
  FROM public.participants p
 WHERE p.first_progress_at IS NOT NULL
UNION ALL
SELECT p.organization_id, p.webinar_id, p.webinar_session_id, p.contact_id, p.id,
       'watch_progress', p.last_progress_at, p.watched_seconds, 'participants', p.id::text,
       jsonb_build_object('actual_watch_seconds', p.actual_watch_seconds)
  FROM public.participants p
 WHERE p.last_progress_at IS NOT NULL
UNION ALL
SELECT c.organization_id, c.webinar_id, p.webinar_session_id, p.contact_id, c.participant_id,
       CASE c.event_type WHEN 'view' THEN 'offer_viewed' ELSE 'offer_clicked' END,
       c.occurred_at, c.video_second, 'cta_events', c.id::text, '{}'::jsonb
  FROM public.cta_events c
  JOIN public.participants p ON p.id = c.participant_id
UNION ALL
SELECT m.organization_id, p.webinar_id, p.webinar_session_id, p.contact_id, m.participant_id,
       'message_sent', m.created_at, m.video_second, 'private_messages', m.id::text, '{}'::jsonb
  FROM public.private_messages m
  JOIN public.participants p ON p.id = m.participant_id
 WHERE m.sender_kind = 'participant'
UNION ALL
-- Pagamentos: o início, a aprovação e o desfecho quando não é a compra. Um pendente
-- há mais horas do que o parâmetro conta como abandonado a partir desse momento.
SELECT r.organization_id, r.webinar_id, NULL::uuid, r.contact_id, NULL::uuid,
       e.name, e.at, NULL::integer, 'real_purchase_events', r.id::text,
       jsonb_build_object('status', r.status, 'product', r.product_name,
                          'amount', r.amount_value, 'currency', r.currency, 'provider', r.provider)
  FROM public.real_purchase_events r
 CROSS JOIN (SELECT public.intelligence_setting('checkout_abandoned_hours')::integer AS hours) s
 CROSS JOIN LATERAL (VALUES
   ('checkout_started', r.created_at),
   ('purchase_approved', r.approved_at),
   ('payment_failed', CASE WHEN r.status = 'failed' THEN r.status_at END),
   ('checkout_abandoned', CASE
      WHEN r.status = 'abandoned' THEN r.status_at
      WHEN r.status = 'pending' AND r.status_at < now() - make_interval(hours => s.hours)
        THEN r.status_at + make_interval(hours => s.hours) END),
   ('purchase_refunded', CASE WHEN r.status = 'refunded' THEN r.status_at END)
 ) AS e(name, at)
 WHERE e.at IS NOT NULL
UNION ALL
-- Fim de cada sessão global, à hora prevista; a detecção vai nos dados.
SELECT s.organization_id, s.webinar_id, s.id, NULL::uuid, NULL::uuid,
       'webinar_session_ended', s.ends_at, NULL::integer, 'webinar_sessions', s.id::text,
       jsonb_build_object('detected_at', s.ended_at, 'starts_at', s.starts_at)
  FROM public.webinar_sessions s
 WHERE s.ended_at IS NOT NULL
UNION ALL
-- Automações (Bloco 4): quando a pessoa entrou e como acabou. Aguardar e tentar de novo
-- ficam nos dados; a execução completa está em Automações.
SELECT r.organization_id, r.webinar_id, r.webinar_session_id, r.contact_id, NULL::uuid,
       e.name, e.at, NULL::integer, 'automation_runs', r.id::text,
       jsonb_build_object('automation', a.name, 'status', r.status, 'scheduled_for', r.scheduled_for,
                          'attempts', r.attempts, 'error', r.error)
  FROM public.automation_runs r
  JOIN public.automations a ON a.id = r.automation_id
 CROSS JOIN LATERAL (VALUES
   ('automation_entered', r.created_at),
   ('automation_executed', CASE WHEN r.status = 'done' THEN r.finished_at END),
   ('automation_failed', CASE WHEN r.status = 'failed' THEN r.finished_at END),
   ('automation_cancelled', CASE WHEN r.status = 'cancelled' THEN r.finished_at END)
 ) AS e(name, at)
 WHERE e.at IS NOT NULL;

NOTIFY pgrst, 'reload schema';
