-- Bloco 3 · ciclo de vida das sessões e fim do webinar.
-- Uma sessão global só existe quando o webinar tem horário (data única, repetição ou
-- just in time) e alguém se inscreveu para ela na sala ao vivo. Replay e salas sem
-- horário (sob demanda) não têm sessão global: cada pessoa vê o seu vídeo, e "a sessão
-- terminou" não é "a pessoa acabou de ver".
-- Estados: scheduled (agendada) → live (em andamento, desde a hora marcada: as sessões
-- são automáticas e arrancam sozinhas) → finished (a hora de fim prevista chegou).
-- O fim é decidido pela base de dados, de minuto a minuto, sem depender de ninguém.
-- Só acrescenta: nada é apagado.

-- 1. Sessões: uma por webinar e hora de início, e o momento em que foi dada como terminada.
ALTER TABLE public.webinar_sessions ADD COLUMN ended_at timestamptz;
CREATE UNIQUE INDEX webinar_sessions_webinar_start_key ON public.webinar_sessions (webinar_id, starts_at);

-- Só o sistema escreve sessões (inscrição e varrimento): no browser são só de leitura.
DROP POLICY webinar_sessions_members ON public.webinar_sessions;
CREATE POLICY webinar_sessions_read ON public.webinar_sessions
  FOR SELECT TO authenticated USING (is_organization_member(organization_id));

-- 2. Participação: a sessão para que a pessoa se inscreveu e quando começou a ver.
ALTER TABLE public.participants
  ADD COLUMN webinar_session_id uuid REFERENCES public.webinar_sessions(id) ON DELETE SET NULL,
  ADD COLUMN first_progress_at timestamptz;
CREATE INDEX participants_session_idx ON public.participants (webinar_session_id)
  WHERE webinar_session_id IS NOT NULL;

-- 3. Eventos com chave anti-duplicados: o mesmo acontecimento fica uma só vez.
ALTER TABLE public.activity_events ADD COLUMN dedupe_key text;
CREATE UNIQUE INDEX activity_events_dedupe_key ON public.activity_events (organization_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- 4. A sessão de uma inscrição. A janela é calculada pelo servidor com as mesmas
-- regras da sala (sessionWindow), nunca pelo browser. Chamar duas vezes devolve a
-- mesma sessão; enquanto não termina, o fim acompanha o horário actual.
CREATE FUNCTION public.open_webinar_session(
  _webinar_id uuid, _starts_at timestamptz, _ends_at timestamptz DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE sid uuid;
BEGIN
  INSERT INTO webinar_sessions (webinar_id, organization_id, starts_at, ends_at)
  SELECT w.id, w.organization_id, _starts_at, _ends_at FROM webinars w WHERE w.id = _webinar_id
  ON CONFLICT (webinar_id, starts_at) DO UPDATE SET ends_at = EXCLUDED.ends_at
    WHERE webinar_sessions.ended_at IS NULL
      AND webinar_sessions.ends_at IS DISTINCT FROM EXCLUDED.ends_at
  RETURNING id INTO sid;
  IF sid IS NULL THEN
    SELECT id INTO sid FROM webinar_sessions WHERE webinar_id = _webinar_id AND starts_at = _starts_at;
  END IF;
  RETURN sid;
END $$;
REVOKE EXECUTE ON FUNCTION public.open_webinar_session(uuid, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_webinar_session(uuid, timestamptz, timestamptz) TO service_role;

-- 5. O progresso guarda também quando a pessoa começou a ver (uma vez).
CREATE OR REPLACE FUNCTION public.record_participant_progress(
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
    first_progress_at = CASE WHEN _played > 0 THEN coalesce(first_progress_at, now()) ELSE first_progress_at END,
    last_progress_at = CASE WHEN _played > 0 THEN now() ELSE last_progress_at END
  WHERE id = _participant_id
    AND (_position > watched_seconds
      OR _played > 0
      OR (entry_seconds IS NULL AND actual_watch_seconds IS NOT NULL AND _entry IS NOT NULL));
$$;

-- 6. Varrimento de minuto a minuto: arranque e fim das sessões.
CREATE FUNCTION public.sweep_webinar_sessions() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ended integer;
BEGIN
  -- Arrancou: a hora marcada chegou. Uma data única remarcada antes de começar deixa
  -- de ser a data do webinar e nunca arranca (nem termina); um webinar inactivo também
  -- não, porque a sala está fechada.
  UPDATE webinar_sessions s SET state = 'live'
    FROM webinars w
   WHERE w.id = s.webinar_id
     AND s.state = 'scheduled' AND s.starts_at <= now()
     AND w.status <> 'draft'
     AND (w.recurrence_enabled OR w.schedule_mode = 'jit' OR w.scheduled_at = s.starts_at);

  -- Terminou: uma só vez por sessão. A escrita é condicional (ended_at IS NULL): se dois
  -- varrimentos correrem ao mesmo tempo, o segundo espera pela linha e já não a apanha.
  -- A chave única do evento recusa qualquer segundo registo. Sem hora de fim conhecida
  -- (sem duração nem hora de fim), a sessão não termina sozinha: não se inventa o fim.
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
REVOKE EXECUTE ON FUNCTION public.sweep_webinar_sessions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_webinar_sessions() TO service_role;

SELECT cron.schedule('webinar-sessions-sweep', '* * * * *', 'SELECT public.sweep_webinar_sessions()');

-- 7. Factos: as colunas dos blocos 1 e 2, mais a sessão e o início da visualização.
CREATE OR REPLACE VIEW public.participant_facts WITH (security_invoker = on) AS
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
  -- Posição: chegou ao segundo em que a oferta abre (não é o mesmo que tê-la visto).
  (w.cta_start_seconds IS NOT NULL AND p.watched_seconds >= w.cta_start_seconds) AS reached_offer,
  p.last_progress_at,
  -- Viu a oferta: a sala registou-a à frente da pessoa, ou a pessoa clicou.
  (x.clicked OR x.viewed) AS saw_offer,
  x.clicked,
  -- Iniciou o pagamento: a plataforma registou um pagamento (qualquer estado).
  k.checkout_started,
  k.purchased,
  (k.failed AND NOT k.purchased) AS payment_failed,
  (k.abandoned AND NOT k.purchased) AS checkout_abandoned,
  -- Bloco 3: a sessão global da participação (nula em replay e sem horário) e quando
  -- a pessoa começou a ver.
  p.webinar_session_id,
  p.first_progress_at
FROM public.participants p
JOIN public.webinars w ON w.id = p.webinar_id
LEFT JOIN public.video_sources v ON v.id = w.video_source_id
CROSS JOIN (
  SELECT
    public.intelligence_setting('attended_min_seconds') AS attended_min,
    public.intelligence_setting('checkout_abandoned_hours')::integer AS abandoned_hours
) s
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
-- Pagamentos do contacto atribuídos a este webinar. Um pendente há mais horas do
-- que o parâmetro conta como abandonado.
CROSS JOIN LATERAL (
  SELECT
    count(*) > 0 AS checkout_started,
    coalesce(bool_or(r.status = 'approved'), false) AS purchased,
    coalesce(bool_or(r.status = 'failed'), false) AS failed,
    coalesce(bool_or(r.status = 'abandoned'
      OR (r.status = 'pending' AND r.status_at < now() - make_interval(hours => s.abandoned_hours))),
      false) AS abandoned
  FROM public.real_purchase_events r
  WHERE p.contact_id IS NOT NULL
    AND r.contact_id = p.contact_id
    AND r.webinar_id = p.webinar_id
) k;

-- 8. Leitura única dos acontecimentos, pela ordem em que aconteceram. Cada fonte
-- continua a ser a dona dos seus dados; nada é copiado. Os tempos são do servidor.
-- Chegar a um minuto do vídeo é posição (factos), não tem hora: não entra aqui.
CREATE VIEW public.event_log WITH (security_invoker = on) AS
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
 WHERE s.ended_at IS NOT NULL;

REVOKE ALL ON public.event_log FROM anon, authenticated;
GRANT SELECT ON public.event_log TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
