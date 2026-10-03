-- Commerce: o estado guardado de cada pagamento passa a ser o verdadeiro.
-- 1. Abandono gravado: um pagamento pendente há mais horas do que o parâmetro passa a
--    'abandoned' na própria compra (antes só o evento era gravado e a linha ficava 'pending').
--    O gatilho purchases_emit_events grava o evento checkout_abandoned com a mesma chave
--    anti-duplicados de antes, por isso quem já o tinha não o recebe outra vez.
-- 2. Factos: participant_facts ganha refunded (a compra atribuída a este webinar foi
--    reembolsada e não há outra aprovada). Um reembolso nunca conta como compra activa.
-- Nada é apagado; o resto do tick fica igual ao da 0063.

CREATE OR REPLACE FUNCTION public.automation_runs_tick() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE made_ready integer;
BEGIN
  -- ponytail: só pendentes dos últimos 7 dias, para carrinhos antigos não dispararem
  -- automações de uma vez; os mais antigos ficam 'pending' e as vistas contam-nos como abandonados.
  UPDATE real_purchase_events r SET status = 'abandoned'
    FROM (SELECT intelligence_setting('checkout_abandoned_hours')::integer AS hours) s
   WHERE r.status = 'pending'
     AND r.status_at < now() - make_interval(hours => s.hours)
     AND r.status_at > now() - make_interval(hours => s.hours) - interval '7 days';

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

-- 2. Factos: igual à 0057, com refunded no fim.
CREATE OR REPLACE VIEW public.participant_facts WITH (security_invoker = on) AS
SELECT
  p.id AS participant_id,
  p.organization_id,
  p.webinar_id,
  w.public_title AS webinar_title,
  p.contact_id,
  coalesce(p.contact_id, p.id) AS person_id,
  p.name,
  p.email,
  p.phone,
  p.joined_at,
  p.viewing_mode,
  p.device,
  p.city,
  p.country,
  p.cta_clicked,
  d.duration_seconds,
  w.cta_start_seconds AS offer_start_seconds,
  p.entry_seconds,
  p.watched_seconds AS peak_seconds,
  t.watch_span_seconds,
  t.actual_watch_seconds,
  p.actual_watch_seconds IS NOT NULL AS watch_measured,
  CASE WHEN d.duration_seconds IS NOT NULL
       THEN round(least(1, t.actual_watch_seconds::numeric / d.duration_seconds), 4) END AS watch_ratio,
  t.actual_watch_seconds >= s.attended_min AS attended,
  (w.pitch_seconds IS NOT NULL AND p.watched_seconds >= w.pitch_seconds) AS reached_pitch,
  (w.cta_start_seconds IS NOT NULL AND p.watched_seconds >= w.cta_start_seconds) AS reached_offer,
  p.last_progress_at,
  (x.clicked OR x.viewed) AS saw_offer,
  x.clicked,
  k.checkout_started,
  k.purchased,
  (k.failed AND NOT k.purchased) AS payment_failed,
  (k.abandoned AND NOT k.purchased) AS checkout_abandoned,
  p.webinar_session_id,
  p.first_progress_at,
  (k.refunded AND NOT k.purchased) AS refunded
FROM public.participants p
JOIN public.webinars w ON w.id = p.webinar_id
LEFT JOIN public.video_sources v ON v.id = w.video_source_id
CROSS JOIN (
  SELECT
    public.intelligence_setting('attended_min_seconds') AS attended_min,
    public.intelligence_setting('checkout_abandoned_hours')::integer AS abandoned_hours
) s
CROSS JOIN LATERAL (
  SELECT CASE WHEN v.duration_seconds > 0 THEN v.duration_seconds
              WHEN w.duration_seconds > 0 THEN w.duration_seconds END AS duration_seconds
) d
CROSS JOIN LATERAL (
  SELECT
    greatest(p.watched_seconds - coalesce(p.entry_seconds, 0), 0) AS watch_span_seconds,
    coalesce(p.actual_watch_seconds,
             greatest(p.watched_seconds - coalesce(p.entry_seconds, 0), 0)) AS actual_watch_seconds
) t
CROSS JOIN LATERAL (
  SELECT
    p.cta_clicked OR EXISTS (
      SELECT 1 FROM public.cta_events c
      WHERE c.participant_id = p.id AND c.event_type = 'click') AS clicked,
    EXISTS (
      SELECT 1 FROM public.cta_events c
      WHERE c.participant_id = p.id AND c.event_type = 'view') AS viewed
) x
CROSS JOIN LATERAL (
  SELECT
    count(*) > 0 AS checkout_started,
    coalesce(bool_or(r.status = 'approved'), false) AS purchased,
    coalesce(bool_or(r.status = 'failed'), false) AS failed,
    coalesce(bool_or(r.status = 'abandoned'
      OR (r.status = 'pending' AND r.status_at < now() - make_interval(hours => s.abandoned_hours))),
      false) AS abandoned,
    coalesce(bool_or(r.status = 'refunded'), false) AS refunded
  FROM public.real_purchase_events r
  WHERE p.contact_id IS NOT NULL
    AND r.contact_id = p.contact_id
    AND r.webinar_id = p.webinar_id
) k;

NOTIFY pgrst, 'reload schema';
