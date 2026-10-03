-- Bloco 4 · Motor de automações (MVP): QUANDO → SE → ESPERAR → ENTÃO.
-- QUANDO: o fim canónico de uma sessão (webinar_session_ended, Bloco 3), e só esse.
-- SE: condições sobre os factos canónicos (participant_facts, Blocos 1 e 2), por pessoa.
-- ESPERAR: minutos depois do fim da sessão.
-- ENTÃO: o webhook de saída da organização (Integrações), assinado: a acção que já tem
-- executor real.
-- A base de dados decide quem entra e quando a execução fica pronta (pg_cron, de minuto
-- a minuto); o servidor da aplicação executa (o ticker que já empurra a fila de trabalhos).
-- Só acrescenta: nada do que existe é alterado nem apagado.

-- 1. Condições: lista de {fact, value} (sim/não) ou {fact: 'actual_watch_seconds', op, value}.
-- Os nomes são os das colunas de participant_facts: nada é recalculado aqui.
CREATE FUNCTION public.automation_conditions_valid(_conditions jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN jsonb_typeof(_conditions) IS DISTINCT FROM 'array' THEN false
    WHEN jsonb_array_length(_conditions) > 8 THEN false
    ELSE coalesce((
      SELECT bool_and(CASE
        WHEN jsonb_typeof(c) <> 'object' THEN false
        WHEN c->>'fact' IN ('attended', 'purchased', 'payment_failed', 'checkout_abandoned')
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

-- Todas as condições têm de se verificar; um facto em falta nunca conta como verdadeiro.
CREATE FUNCTION public.automation_conditions_met(_conditions jsonb, _facts jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(bool_and(coalesce(CASE c->>'fact'
      WHEN 'actual_watch_seconds' THEN CASE c->>'op'
        WHEN 'gte' THEN (_facts->>'actual_watch_seconds')::numeric >= (c->>'value')::numeric
        WHEN 'lt' THEN (_facts->>'actual_watch_seconds')::numeric < (c->>'value')::numeric END
      ELSE _facts->(c->>'fact') = c->'value'
    END, false)), true)
  FROM jsonb_array_elements(_conditions) c
$$;

-- 2. Automações da organização.
CREATE TABLE public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  active boolean NOT NULL DEFAULT false,
  trigger_event text NOT NULL DEFAULT 'webinar_session_ended'
    CHECK (trigger_event = 'webinar_session_ended'),
  -- Só as sessões deste webinar; sem webinar, as de qualquer webinar da organização.
  webinar_id uuid REFERENCES public.webinars(id) ON DELETE CASCADE,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (public.automation_conditions_valid(conditions)),
  wait_minutes integer NOT NULL DEFAULT 0 CHECK (wait_minutes BETWEEN 0 AND 10080),
  -- O destino e a assinatura vêm da integração "Webhook de saída" da organização.
  action text NOT NULL DEFAULT 'outgoing_webhook' CHECK (action = 'outgoing_webhook'),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT automations_id_org_key UNIQUE (id, organization_id)
);
CREATE INDEX automations_org_idx ON public.automations (organization_id);

CREATE FUNCTION public.automations_touch() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.automations_touch() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER automations_touch BEFORE UPDATE ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.automations_touch();

-- Quem gere a conta cria, altera e liga/desliga; o suporte só vê. Nada se apaga pelo
-- browser (desliga-se). O webinar tem de ser da mesma organização.
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.automations FROM anon, authenticated;
GRANT SELECT ON public.automations TO authenticated;
GRANT INSERT (organization_id, name, active, webinar_id, conditions, wait_minutes)
  ON public.automations TO authenticated;
GRANT UPDATE (name, active, webinar_id, conditions, wait_minutes) ON public.automations TO authenticated;
GRANT ALL ON public.automations TO service_role;
CREATE POLICY automations_read ON public.automations FOR SELECT TO authenticated
  USING (public.is_organization_member(organization_id));
CREATE POLICY automations_insert ON public.automations FOR INSERT TO authenticated
  WITH CHECK (
    public.has_organization_role(organization_id, ARRAY['owner', 'admin', 'member']::workspace_role[])
    AND (webinar_id IS NULL OR EXISTS (
      SELECT 1 FROM public.webinars w
       WHERE w.id = automations.webinar_id AND w.organization_id = automations.organization_id)));
CREATE POLICY automations_update ON public.automations FOR UPDATE TO authenticated
  USING (public.has_organization_role(organization_id, ARRAY['owner', 'admin', 'member']::workspace_role[]))
  WITH CHECK (
    public.has_organization_role(organization_id, ARRAY['owner', 'admin', 'member']::workspace_role[])
    AND (webinar_id IS NULL OR EXISTS (
      SELECT 1 FROM public.webinars w
       WHERE w.id = automations.webinar_id AND w.organization_id = automations.organization_id)));

-- 3. Execuções: uma por automação, ocorrência e pessoa. Só a base de dados as cria e só
-- o servidor as executa; no browser são só de leitura.
-- Estados: waiting (a aguardar a espera) → ready (pronta) → running (a executar) →
-- done (executada) | failed (falhou) | cancelled (cancelada: automação desligada ou a
-- pessoa deixou de cumprir as condições durante a espera).
CREATE TABLE public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  automation_id uuid NOT NULL,
  -- A ocorrência que a originou: o fim canónico da sessão.
  event_id bigint NOT NULL REFERENCES public.activity_events(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL,
  webinar_id uuid REFERENCES public.webinars(id) ON DELETE SET NULL,
  webinar_session_id uuid REFERENCES public.webinar_sessions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'ready', 'running', 'done', 'failed', 'cancelled')),
  -- Quando fica pronta: fim da sessão + espera; depois de uma falha passageira, a
  -- próxima tentativa.
  scheduled_for timestamptz NOT NULL,
  started_at timestamptz,
  finished_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  -- Os factos da pessoa quando entrou: a prova de porque entrou.
  facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Mesma automação + mesma ocorrência + mesma pessoa = uma execução.
  CONSTRAINT automation_runs_once UNIQUE (automation_id, event_id, contact_id),
  -- A automação e o contacto são sempre da organização da execução.
  CONSTRAINT automation_runs_automation_fk FOREIGN KEY (automation_id, organization_id)
    REFERENCES public.automations(id, organization_id) ON DELETE CASCADE,
  CONSTRAINT automation_runs_contact_fk FOREIGN KEY (contact_id, organization_id)
    REFERENCES public.contacts(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX automation_runs_queue_idx ON public.automation_runs (status, scheduled_for)
  WHERE status IN ('waiting', 'ready', 'running');
CREATE INDEX automation_runs_org_idx ON public.automation_runs (organization_id, created_at DESC);
CREATE INDEX automation_runs_contact_idx ON public.automation_runs (contact_id);
CREATE INDEX automation_runs_session_idx ON public.automation_runs (webinar_session_id);
CREATE INDEX automation_runs_webinar_idx ON public.automation_runs (webinar_id);
CREATE INDEX automation_runs_event_idx ON public.automation_runs (event_id);

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.automation_runs FROM anon, authenticated;
GRANT SELECT ON public.automation_runs TO authenticated;
GRANT ALL ON public.automation_runs TO service_role;
CREATE POLICY automation_runs_read ON public.automation_runs FOR SELECT TO authenticated
  USING (public.is_organization_member(organization_id));

-- 4. Factos de cada pessoa numa sessão, como as métricas os contam (presences): duas
-- participações do mesmo contacto são uma pessoa; basta uma ter o facto, e o tempo
-- visto é o maior. Só contactos reais: um convidado sem email nem telefone não é pessoa.
CREATE FUNCTION public.automation_session_facts(_session_id uuid)
RETURNS TABLE (contact_id uuid, facts jsonb)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT f.contact_id, jsonb_build_object(
           'attended', bool_or(f.attended),
           'actual_watch_seconds', max(f.actual_watch_seconds),
           'purchased', bool_or(f.purchased),
           'payment_failed', bool_or(f.payment_failed),
           'checkout_abandoned', bool_or(f.checkout_abandoned),
           'participations', count(*))
    FROM public.participant_facts f
   WHERE f.webinar_session_id = _session_id AND f.contact_id IS NOT NULL
   GROUP BY f.contact_id
$$;
REVOKE EXECUTE ON FUNCTION public.automation_session_facts(uuid) FROM PUBLIC, anon, authenticated;

-- 5. Ocorrência → automações activas compatíveis → uma execução por pessoa elegível.
-- Idempotente: repetir (ou correr ao mesmo tempo) não cria nada de novo.
CREATE FUNCTION public.automation_dispatch(_event_id bigint) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ev activity_events;
  created integer;
BEGIN
  SELECT * INTO ev FROM activity_events WHERE id = _event_id AND name = 'webinar_session_ended';
  IF NOT FOUND THEN RETURN 0; END IF;

  INSERT INTO automation_runs (organization_id, automation_id, event_id, contact_id, webinar_id,
                               webinar_session_id, status, scheduled_for, facts)
  SELECT s.organization_id, a.id, ev.id, f.contact_id, s.webinar_id, s.id,
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
  GET DIAGNOSTICS created = ROW_COUNT;
  RETURN created;
END $$;
REVOKE EXECUTE ON FUNCTION public.automation_dispatch(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.automation_dispatch(bigint) TO service_role;

-- O evento canónico é gravado uma vez por sessão (Bloco 3); as execuções nascem no mesmo
-- momento. Uma falha aqui nunca impede o fim da sessão: fica o aviso no registo da base
-- de dados, e o despacho pode repetir-se (é idempotente).
CREATE FUNCTION public.activity_events_automations() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    PERFORM automation_dispatch(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'automation_dispatch(%) falhou: %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.activity_events_automations() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER activity_events_automations AFTER INSERT ON public.activity_events
  FOR EACH ROW WHEN (NEW.name = 'webinar_session_ended')
  EXECUTE FUNCTION public.activity_events_automations();

-- 6. De minuto a minuto: a espera acabou → confirma-se de novo, com os factos de agora,
-- antes de ficar pronta. Automação desligada ou pessoa que já não cumpre (comprou durante
-- a espera) → cancelada, com a prova. Uma execução interrompida (servidor caiu a meio)
-- volta à fila até ao limite de 3 tentativas.
CREATE FUNCTION public.automation_runs_tick() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE made_ready integer;
BEGIN
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
        SELECT sf.facts FROM automation_session_facts(r.webinar_session_id) sf
         WHERE sf.contact_id = r.contact_id) f ON true
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
REVOKE EXECUTE ON FUNCTION public.automation_runs_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.automation_runs_tick() TO service_role;

SELECT cron.schedule('automation-runs-tick', '* * * * *', 'SELECT public.automation_runs_tick()');

-- 7. Reserva das prontas (servidor): cada execução só é entregue a um executor, mesmo com
-- vários a pedir ao mesmo tempo (SKIP LOCKED + escrita condicional).
CREATE FUNCTION public.claim_automation_runs(_limit integer DEFAULT 10)
RETURNS SETOF public.automation_runs
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE automation_runs r SET
      status = 'running', attempts = r.attempts + 1,
      started_at = coalesce(r.started_at, now()),
      locked_until = now() + interval '2 minutes', updated_at = now()
   WHERE r.id IN (
           SELECT q.id FROM automation_runs q
             JOIN automations a ON a.id = q.automation_id AND a.active
            WHERE q.status = 'ready'
            ORDER BY q.scheduled_for
            LIMIT greatest(least(_limit, 50), 1)
              FOR UPDATE OF q SKIP LOCKED)
     AND r.status = 'ready'
  RETURNING r.*;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_automation_runs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_automation_runs(integer) TO service_role;

-- 8. Resultado. Só uma execução reservada muda (status = 'running'): uma executada nunca
-- volta a correr. Falha passageira → nova tentativa (1 min, depois 5 min) na mesma
-- execução; à 3.ª, ou numa falha definitiva, fica falhada.
CREATE FUNCTION public.finish_automation_run(
  _run_id uuid, _ok boolean, _transient boolean, _result jsonb, _error text
) RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE automation_runs SET
      status = CASE WHEN _ok THEN 'done' WHEN _transient AND attempts < 3 THEN 'waiting' ELSE 'failed' END,
      scheduled_for = CASE
        WHEN NOT _ok AND _transient AND attempts < 3
          THEN now() + CASE WHEN attempts <= 1 THEN interval '1 minute' ELSE interval '5 minutes' END
        ELSE scheduled_for END,
      finished_at = CASE WHEN _ok OR NOT _transient OR attempts >= 3 THEN now() END,
      result = _result,
      error = CASE WHEN _ok THEN NULL ELSE _error END,
      locked_until = NULL, updated_at = now()
   WHERE id = _run_id AND status = 'running'
  RETURNING status;
$$;
REVOKE EXECUTE ON FUNCTION public.finish_automation_run(uuid, boolean, boolean, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_automation_run(uuid, boolean, boolean, jsonb, text) TO service_role;

NOTIFY pgrst, 'reload schema';
