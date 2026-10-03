-- Core · estados de comportamento no webinar para as automações, a partir dos factos que já
-- existem (participant_facts, webinar_sessions). Nada é gravado de novo e nada é apagado:
-- só CREATE OR REPLACE das funções do motor e uma função nova.
--
--   reached_offer  chegou ao ponto da oferta (pico ≥ início da oferta). Não é "viu a oferta",
--                  que é o evento da sala (saw_offer).
--   no_show        a sessão terminou e não assistiu. Sem sessão (replay, sem horário) não há
--                  fim conhecido: fica falso.
--   left_early     assistiu e não chegou à oferta, e passa a exigir o fim da sessão: durante a
--                  sessão ninguém "saiu cedo", só ainda não chegou.
--   replay         veio pelo replay.
--   refunded       reembolsada e sem outra compra aprovada (o mesmo de participant_facts, 0065).
--   entry_seconds  em que segundo do conteúdo entrou. "Entrou tarde" é uma condição com o
--                  minuto escolhido por quem configura: não há limiar inventado.
--
-- Compra aprovada ou reembolsada: as execuções à espera dessa pessoa que já não cumprem as
-- condições (de entrada e dos ramos por onde passaram) são canceladas logo, em vez de só na
-- hora do passo seguinte. O executor continua a confirmar tudo antes de cada acção.

-- 1. Factos por sessão e por pessoa.
CREATE OR REPLACE FUNCTION public.automation_session_facts(_session_id uuid)
RETURNS TABLE (contact_id uuid, facts jsonb)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT f.contact_id, jsonb_build_object(
           'entered', bool_or(f.first_progress_at IS NOT NULL OR f.actual_watch_seconds > 0),
           'attended', bool_or(f.attended),
           'actual_watch_seconds', max(f.actual_watch_seconds),
           'entry_seconds', min(f.entry_seconds),
           'reached_pitch', bool_or(f.reached_pitch),
           'reached_offer', bool_or(f.reached_offer),
           'left_early', e.ended AND bool_or(f.attended) AND bool_or(f.offer_start_seconds IS NOT NULL)
                         AND NOT bool_or(f.reached_offer),
           'no_show', e.ended AND NOT bool_or(f.attended),
           'replay', bool_or(f.viewing_mode = 'replay'),
           'saw_offer', bool_or(f.saw_offer),
           'clicked', bool_or(f.clicked),
           'checkout_started', bool_or(f.checkout_started),
           'purchased', bool_or(f.purchased),
           'payment_failed', bool_or(f.payment_failed),
           'checkout_abandoned', bool_or(f.checkout_abandoned),
           'refunded', bool_or(f.refunded) AND NOT bool_or(f.purchased),
           'participations', count(*))
    FROM public.participant_facts f
   CROSS JOIN (SELECT EXISTS (SELECT 1 FROM public.webinar_sessions s
                               WHERE s.id = _session_id AND s.ended_at IS NOT NULL) AS ended) e
   WHERE f.webinar_session_id = _session_id AND f.contact_id IS NOT NULL
   GROUP BY f.contact_id, e.ended
$$;

CREATE OR REPLACE FUNCTION public.automation_contact_facts(_contact_id uuid, _webinar_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE WHEN count(*) = 0 THEN '{}'::jsonb ELSE jsonb_build_object(
           'entered', bool_or(f.first_progress_at IS NOT NULL OR f.actual_watch_seconds > 0),
           'attended', bool_or(f.attended),
           'actual_watch_seconds', max(f.actual_watch_seconds),
           'entry_seconds', min(f.entry_seconds),
           'reached_pitch', bool_or(f.reached_pitch),
           'reached_offer', bool_or(f.reached_offer),
           'left_early', bool_or(s.ended_at IS NOT NULL) AND bool_or(f.attended)
                         AND bool_or(f.offer_start_seconds IS NOT NULL) AND NOT bool_or(f.reached_offer),
           'no_show', bool_or(s.ended_at IS NOT NULL) AND NOT bool_or(f.attended),
           'replay', bool_or(f.viewing_mode = 'replay'),
           'saw_offer', bool_or(f.saw_offer),
           'clicked', bool_or(f.clicked),
           'checkout_started', bool_or(f.checkout_started),
           'purchased', bool_or(f.purchased),
           'payment_failed', bool_or(f.payment_failed),
           'checkout_abandoned', bool_or(f.checkout_abandoned),
           'refunded', bool_or(f.refunded) AND NOT bool_or(f.purchased),
           'participations', count(*)) END
    FROM public.participant_facts f
    LEFT JOIN public.webinar_sessions s ON s.id = f.webinar_session_id
   WHERE f.contact_id = _contact_id AND (_webinar_id IS NULL OR f.webinar_id = _webinar_id)
$$;

-- 2. Condições: os factos novos; as comparações (gte/lt) valem para os dois números.
CREATE OR REPLACE FUNCTION public.automation_conditions_valid(_conditions jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN jsonb_typeof(_conditions) IS DISTINCT FROM 'array' THEN false
    WHEN jsonb_array_length(_conditions) > 8 THEN false
    ELSE coalesce((
      SELECT bool_and(CASE
        WHEN jsonb_typeof(c) <> 'object' THEN false
        WHEN c->>'fact' IN ('entered', 'attended', 'reached_pitch', 'reached_offer', 'left_early', 'no_show',
                            'replay', 'saw_offer', 'clicked', 'checkout_started', 'purchased', 'payment_failed',
                            'checkout_abandoned', 'refunded')
          THEN jsonb_typeof(c->'value') = 'boolean' AND c - 'fact' - 'value' = '{}'::jsonb
        WHEN c->>'fact' IN ('actual_watch_seconds', 'entry_seconds')
          THEN coalesce(c->>'op' IN ('gte', 'lt'), false)
           AND c - 'fact' - 'op' - 'value' = '{}'::jsonb
           AND CASE WHEN jsonb_typeof(c->'value') = 'number'
                    THEN (c->>'value')::numeric BETWEEN 0 AND 86400 ELSE false END
        ELSE false END)
      FROM jsonb_array_elements(_conditions) c), true)
  END
$$;

CREATE OR REPLACE FUNCTION public.automation_conditions_met(_conditions jsonb, _facts jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(bool_and(coalesce(CASE
      WHEN c ? 'op' THEN CASE c->>'op'
        WHEN 'gte' THEN (_facts->>(c->>'fact'))::numeric >= (c->>'value')::numeric
        WHEN 'lt' THEN (_facts->>(c->>'fact'))::numeric < (c->>'value')::numeric END
      ELSE _facts->(c->>'fact') = c->'value'
    END, false)), true)
  FROM jsonb_array_elements(_conditions) c
$$;

-- 3. Compra aprovada ou reembolsada: cancela já as execuções à espera que deixaram de cumprir.
CREATE OR REPLACE FUNCTION public.automation_recheck_contact(_organization_id uuid, _contact_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cancelled integer;
BEGIN
  WITH stale AS (
    SELECT r.id, f.facts
      FROM automation_runs r
      JOIN automations a ON a.id = r.automation_id
      LEFT JOIN LATERAL (
        SELECT CASE WHEN r.occurrence_key LIKE 'webinar_session_%'
          THEN (SELECT sf.facts FROM automation_session_facts(r.webinar_session_id) sf
                 WHERE sf.contact_id = r.contact_id)
          ELSE automation_contact_facts(r.contact_id, r.webinar_id) END AS facts) f ON true
     WHERE r.organization_id = _organization_id AND r.contact_id = _contact_id
       AND r.status IN ('waiting', 'ready')
       -- As condições do caminho como no executor (guardsHold): um facto em falta não cancela.
       AND NOT (automation_conditions_met(a.conditions, f.facts) AND automation_conditions_met(
             (SELECT coalesce(jsonb_agg(g), '[]'::jsonb) FROM jsonb_array_elements(r.guards) g
               WHERE f.facts->>(g->>'fact') IS NOT NULL), f.facts))
       FOR UPDATE OF r SKIP LOCKED
  )
  UPDATE automation_runs r SET
      status = 'cancelled', finished_at = now(), locked_until = NULL, updated_at = now(),
      result = jsonb_build_object('cancelled', 'conditions', 'facts', s.facts)
    FROM stale s
   WHERE r.id = s.id AND r.status IN ('waiting', 'ready');
  GET DIAGNOSTICS cancelled = ROW_COUNT;
  RETURN cancelled;
END $$;
REVOKE EXECUTE ON FUNCTION public.automation_recheck_contact(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.automation_recheck_contact(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.activity_events_automations() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF NEW.name IN ('purchase_approved', 'purchase_refunded') AND NEW.contact_id IS NOT NULL THEN
      PERFORM automation_recheck_contact(NEW.organization_id, NEW.contact_id);
    END IF;
    PERFORM automation_dispatch(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'automation_dispatch(%) falhou: %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
