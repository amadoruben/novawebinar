-- Bloco 1 · tempo assistido. Três medidas que não se misturam:
--   peak_seconds         = posição mais avançada (coluna histórica watched_seconds)
--   watch_span_seconds   = da entrada ao pico; inclui o tempo em que a pessoa não estava
--   actual_watch_seconds = segundos em que o conteúdo passou mesmo à frente da pessoa
-- As participações antigas ficam "não medidas" e usam o intervalo como estimativa.
-- Nada é apagado: só colunas, uma função, uma vista, e contact_summaries sobre os factos.

-- 1. Parâmetros das definições: afináveis sem migration (basta actualizar a linha).
CREATE TABLE public.intelligence_settings (
  key text PRIMARY KEY CHECK (key ~ '^[a-z]+(_[a-z]+)*$'),
  value numeric NOT NULL CHECK (value >= 0),
  description text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.intelligence_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.intelligence_settings FROM anon, authenticated;
GRANT SELECT ON public.intelligence_settings TO authenticated;
GRANT ALL ON public.intelligence_settings TO service_role;
CREATE POLICY intelligence_settings_read ON public.intelligence_settings
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.intelligence_settings (key, value, description) VALUES
  ('attended_min_seconds', 60, 'Assistiu: tempo visto mínimo, em segundos');

CREATE FUNCTION public.intelligence_setting(_key text) RETURNS numeric
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE v numeric;
BEGIN
  SELECT value INTO v FROM intelligence_settings WHERE key = _key;
  IF v IS NULL THEN RAISE EXCEPTION 'Parâmetro em falta: %', _key; END IF;
  RETURN v;
END $$;
REVOKE EXECUTE ON FUNCTION public.intelligence_setting(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.intelligence_setting(text) TO authenticated, service_role;

-- 2. Participação: ponto de entrada, tempo efectivamente visto e última vez a ver.
ALTER TABLE public.participants
  ADD COLUMN entry_seconds integer CHECK (entry_seconds >= 0),
  ADD COLUMN actual_watch_seconds integer CHECK (actual_watch_seconds >= 0),
  ADD COLUMN last_progress_at timestamptz;
-- As participações antigas ficam NULL (tempo nunca medido); as novas começam em 0.
ALTER TABLE public.participants ALTER COLUMN actual_watch_seconds SET DEFAULT 0;

-- 3. Progresso numa só escrita. O pico só avança. A entrada grava-se uma vez. O
-- tempo visto soma o que a sala mediu desde o último sinal: no máximo 120 s por
-- sinal e nunca mais do que o tempo desde a inscrição (mais 30 s de folga).
-- As participações antigas (tempo NULL) continuam não medidas.
CREATE FUNCTION public.record_participant_progress(
  _participant_id uuid, _position integer, _entry integer DEFAULT NULL, _played integer DEFAULT 0
) RETURNS void
LANGUAGE sql SET search_path = public AS $$
  UPDATE participants SET
    watched_seconds = greatest(watched_seconds, _position),
    entry_seconds = CASE
      WHEN entry_seconds IS NULL AND actual_watch_seconds IS NOT NULL AND _entry IS NOT NULL
        THEN least(_entry, greatest(watched_seconds, _position))
      ELSE entry_seconds END,
    actual_watch_seconds = CASE
      WHEN actual_watch_seconds IS NOT NULL AND _played > 0 THEN least(
        actual_watch_seconds + least(_played, 120),
        greatest(ceil(extract(epoch FROM now() - joined_at))::integer, 0) + 30)
      ELSE actual_watch_seconds END,
    last_progress_at = CASE WHEN _played > 0 THEN now() ELSE last_progress_at END
  WHERE id = _participant_id
    AND (_position > watched_seconds
      OR _played > 0
      OR (entry_seconds IS NULL AND actual_watch_seconds IS NOT NULL AND _entry IS NOT NULL));
$$;
REVOKE EXECUTE ON FUNCTION public.record_participant_progress(uuid, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_participant_progress(uuid, integer, integer, integer)
  TO service_role;

-- 4. Factos de cada participação: a fonte única das páginas para tempo visto,
-- presença e posição atingida.
CREATE VIEW public.participant_facts WITH (security_invoker = on) AS
SELECT
  p.id AS participant_id,
  p.organization_id,
  p.webinar_id,
  w.public_title AS webinar_title,
  p.contact_id,
  -- Pessoa: o contacto; sem contacto (convidado), a própria participação.
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
  p.last_progress_at
FROM public.participants p
JOIN public.webinars w ON w.id = p.webinar_id
LEFT JOIN public.video_sources v ON v.id = w.video_source_id
CROSS JOIN (SELECT public.intelligence_setting('attended_min_seconds') AS attended_min) s
-- Duração: a do vídeo; senão a do webinar; senão desconhecida.
CROSS JOIN LATERAL (
  SELECT CASE WHEN v.duration_seconds > 0 THEN v.duration_seconds
              WHEN w.duration_seconds > 0 THEN w.duration_seconds END AS duration_seconds
) d
-- Intervalo coberto e tempo visto; sem medição, o intervalo é a melhor estimativa.
CROSS JOIN LATERAL (
  SELECT
    greatest(p.watched_seconds - coalesce(p.entry_seconds, 0), 0) AS watch_span_seconds,
    coalesce(p.actual_watch_seconds,
             greatest(p.watched_seconds - coalesce(p.entry_seconds, 0), 0)) AS actual_watch_seconds
) t;

REVOKE ALL ON public.participant_facts FROM anon, authenticated;
GRANT SELECT ON public.participant_facts TO authenticated, service_role;

-- 5. contact_summaries passa a ler os factos. Mesmas colunas, mesma ordem.
-- "Assistiu" e o tempo passam a ser os canónicos, uma vez por webinar; a última
-- actividade é a última vez que a pessoa estava a ver.
CREATE OR REPLACE VIEW public.contact_summaries WITH (security_invoker = on) AS
SELECT
  c.id,
  c.organization_id,
  c.name,
  c.email,
  c.phone,
  c.source,
  c.created_at,
  coalesce(p.events_registered, 0)::int AS events_registered,
  coalesce(p.events_attended, 0)::int AS events_attended,
  coalesce(p.watched_seconds, 0)::int AS watched_seconds,
  coalesce(p.reached_offer, false) AS reached_offer,
  coalesce(p.clicked_offer, false) AS clicked_offer,
  coalesce(msg.messages, 0)::int AS messages,
  coalesce(buy.purchases, 0)::int AS purchases,
  p.first_seen_at,
  coalesce(p.last_seen_at, c.created_at) AS last_seen_at,
  coalesce(p.webinar_ids, '{}') AS webinar_ids,
  coalesce(l.list_ids, '{}') AS list_ids,
  CASE
    WHEN coalesce(buy.purchases, 0) > 0 THEN 'customer'
    WHEN coalesce(p.clicked_offer, false) THEN 'clicked'
    WHEN coalesce(p.reached_offer, false) THEN 'reached_offer'
    WHEN coalesce(p.events_attended, 0) > 0 THEN 'watched'
    WHEN coalesce(p.events_registered, 0) > 0 THEN 'no_show'
    ELSE 'new'
  END AS stage,
  coalesce(c.first_source, CASE WHEN c.source = 'registration' THEN 'direto' ELSE c.source END) AS first_source,
  c.first_campaign
FROM public.contacts c
LEFT JOIN LATERAL (
  SELECT
    count(*) AS events_registered,
    count(*) FILTER (WHERE pw.attended) AS events_attended,
    sum(pw.watch_seconds) AS watched_seconds,
    bool_or(pw.reached_offer) AS reached_offer,
    bool_or(pw.clicked) AS clicked_offer,
    min(pw.first_seen) AS first_seen_at,
    max(pw.last_seen) AS last_seen_at,
    array_agg(pw.webinar_id) AS webinar_ids
  FROM (
    -- Uma linha por webinar: quem entrou em dois aparelhos conta uma vez.
    SELECT f.webinar_id,
      bool_or(f.attended) AS attended,
      max(f.actual_watch_seconds) AS watch_seconds,
      bool_or(f.reached_offer) AS reached_offer,
      bool_or(f.cta_clicked) AS clicked,
      min(f.joined_at) AS first_seen,
      max(coalesce(f.last_progress_at, f.joined_at)) AS last_seen
    FROM public.participant_facts f
    WHERE f.contact_id = c.id
    GROUP BY f.webinar_id
  ) pw
) p ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS messages
  FROM public.private_messages m
  JOIN public.participants pa ON pa.id = m.participant_id
  WHERE pa.contact_id = c.id AND m.sender_kind = 'participant'
) msg ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS purchases
  FROM public.real_purchase_events rp
  WHERE rp.contact_id = c.id AND rp.status = 'approved'
) buy ON true
LEFT JOIN LATERAL (
  SELECT array_agg(m.list_id) AS list_ids
  FROM public.contact_list_members m
  WHERE m.contact_id = c.id
) l ON true;

NOTIFY pgrst, 'reload schema';
