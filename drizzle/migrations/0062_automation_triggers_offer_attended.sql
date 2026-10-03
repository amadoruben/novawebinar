-- Automações: mais gatilhos e condições sobre factos que já existem, e arquivo.
-- Gatilhos novos, cada um com o seu evento canónico gravado uma vez (activity_events +
-- dedupe_key), e o mesmo despacho de sempre:
--   webinar_attended  a pessoa passou o mínimo de "assistiu" (Bloco 1), uma vez por webinar;
--   offer_viewed      viu a oferta (cta_events), uma vez por pessoa e webinar;
--   offer_clicked     clicou na oferta (cta_events), uma vez por pessoa e webinar;
--   checkout_started  a plataforma de venda registou o pagamento (Bloco 2), uma vez por pagamento.
-- Condições novas: viu a oferta e clicou (colunas de participant_facts).
-- Arquivar: a automação sai da lista e fica desligada; as execuções ficam.
-- Só acrescenta: nada é apagado.

-- 1. Factos por pessoa com viu a oferta, clicou e iniciou o pagamento.
CREATE OR REPLACE FUNCTION public.automation_session_facts(_session_id uuid)
RETURNS TABLE (contact_id uuid, facts jsonb)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT f.contact_id, jsonb_build_object(
           'attended', bool_or(f.attended),
           'actual_watch_seconds', max(f.actual_watch_seconds),
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
           'attended', bool_or(f.attended),
           'actual_watch_seconds', max(f.actual_watch_seconds),
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

-- 2. Condições aceites.
CREATE OR REPLACE FUNCTION public.automation_conditions_valid(_conditions jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN jsonb_typeof(_conditions) IS DISTINCT FROM 'array' THEN false
    WHEN jsonb_array_length(_conditions) > 8 THEN false
    ELSE coalesce((
      SELECT bool_and(CASE
        WHEN jsonb_typeof(c) <> 'object' THEN false
        WHEN c->>'fact' IN ('attended', 'saw_offer', 'clicked', 'purchased', 'payment_failed', 'checkout_abandoned')
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

-- 3. Gatilhos disponíveis e arquivo.
ALTER TABLE public.automations DROP CONSTRAINT automations_trigger_event_check;
ALTER TABLE public.automations ADD CONSTRAINT automations_trigger_event_check
  CHECK (trigger_event IN ('webinar_session_ended', 'webinar_attended', 'offer_viewed', 'offer_clicked',
                           'checkout_started', 'purchase_approved', 'payment_failed', 'checkout_abandoned'));
ALTER TABLE public.automations ADD COLUMN archived_at timestamptz;
GRANT UPDATE (archived_at) ON public.automations TO authenticated;

-- 4a. Assistiu: a primeira vez que o tempo visto passa o mínimo, por pessoa e webinar.
CREATE FUNCTION public.participants_emit_attended() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE min_seconds numeric := intelligence_setting('attended_min_seconds');
BEGIN
  IF NEW.contact_id IS NULL OR coalesce(NEW.actual_watch_seconds, 0) < min_seconds
     OR (TG_OP = 'UPDATE' AND coalesce(OLD.actual_watch_seconds, 0) >= min_seconds) THEN
    RETURN NULL;
  END IF;
  INSERT INTO activity_events (organization_id, contact_id, webinar_id, name, actor_kind, dedupe_key, data)
  VALUES (NEW.organization_id, NEW.contact_id, NEW.webinar_id, 'webinar_attended', 'system',
          'webinar_attended:' || NEW.webinar_id || ':' || NEW.contact_id,
          jsonb_build_object('participant_id', NEW.id, 'session_id', NEW.webinar_session_id,
                             'actual_watch_seconds', NEW.actual_watch_seconds, 'source', 'participants'))
  ON CONFLICT (organization_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.participants_emit_attended() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER participants_emit_attended AFTER INSERT OR UPDATE OF actual_watch_seconds ON public.participants
  FOR EACH ROW WHEN (NEW.contact_id IS NOT NULL AND NEW.actual_watch_seconds IS NOT NULL)
  EXECUTE FUNCTION public.participants_emit_attended();

-- 4b. Viu e clicou na oferta: uma vez por pessoa e webinar (recarregar a sala não repete).
CREATE FUNCTION public.cta_events_emit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  person uuid;
  ename text := CASE NEW.event_type WHEN 'view' THEN 'offer_viewed' WHEN 'click' THEN 'offer_clicked' END;
BEGIN
  SELECT contact_id INTO person FROM participants WHERE id = NEW.participant_id;
  IF ename IS NULL OR person IS NULL THEN RETURN NULL; END IF;
  INSERT INTO activity_events (organization_id, contact_id, webinar_id, name, actor_kind, occurred_at, dedupe_key, data)
  VALUES (NEW.organization_id, person, NEW.webinar_id, ename, 'system', NEW.occurred_at,
          ename || ':' || NEW.webinar_id || ':' || person,
          jsonb_build_object('participant_id', NEW.participant_id, 'video_second', NEW.video_second,
                             'source', 'cta_events'))
  ON CONFLICT (organization_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.cta_events_emit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER cta_events_emit AFTER INSERT ON public.cta_events
  FOR EACH ROW WHEN (NEW.participant_id IS NOT NULL) EXECUTE FUNCTION public.cta_events_emit();

-- 4c. Iniciou o pagamento: cada pagamento registado (Bloco 2), mais o seu desfecho como antes.
CREATE OR REPLACE FUNCTION public.purchases_emit_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ename text := CASE NEW.status
  WHEN 'approved' THEN 'purchase_approved'
  WHEN 'failed' THEN 'payment_failed'
  WHEN 'abandoned' THEN 'checkout_abandoned' END;
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

-- 5. Despacho: todos os gatilhos de pessoa seguem o caminho dos pagamentos (contacto do evento).
CREATE OR REPLACE FUNCTION public.automation_dispatch(_event_id bigint) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ev activity_events;
  created integer;
BEGIN
  SELECT * INTO ev FROM activity_events WHERE id = _event_id
     AND name IN ('webinar_session_ended', 'webinar_attended', 'offer_viewed', 'offer_clicked',
                  'checkout_started', 'purchase_approved', 'payment_failed', 'checkout_abandoned');
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
           coalesce(ev.dedupe_key, ev.name || ':' || ev.id), ev.contact_id,
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
  FOR EACH ROW WHEN (NEW.name IN ('webinar_session_ended', 'webinar_attended', 'offer_viewed', 'offer_clicked',
                                  'checkout_started', 'purchase_approved', 'payment_failed', 'checkout_abandoned'))
  EXECUTE FUNCTION public.activity_events_automations();

NOTIFY pgrst, 'reload schema';
