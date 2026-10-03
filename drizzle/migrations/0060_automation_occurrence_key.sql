-- Bloco 4 · correcção: a ocorrência é a sessão que terminou, não a linha do evento.
-- A chave do Bloco 3 já só deixa gravar um fim por sessão; mesmo assim, uma segunda linha
-- igual vinda de um caminho sem chave nunca pode criar uma segunda execução.
-- A tabela está vazia (criada na 0059, sem execuções): nada se perde.
ALTER TABLE public.automation_runs ADD COLUMN occurrence_key text NOT NULL;
ALTER TABLE public.automation_runs DROP CONSTRAINT automation_runs_once;
-- Mesma automação + mesma ocorrência (a sessão) + mesma pessoa = uma execução.
ALTER TABLE public.automation_runs
  ADD CONSTRAINT automation_runs_once UNIQUE (automation_id, occurrence_key, contact_id);

CREATE OR REPLACE FUNCTION public.automation_dispatch(_event_id bigint) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ev activity_events;
  created integer;
BEGIN
  SELECT * INTO ev FROM activity_events WHERE id = _event_id AND name = 'webinar_session_ended';
  IF NOT FOUND THEN RETURN 0; END IF;

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
  GET DIAGNOSTICS created = ROW_COUNT;
  RETURN created;
END $$;

NOTIFY pgrst, 'reload schema';
