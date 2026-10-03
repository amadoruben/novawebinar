-- Bloco 2 · oferta e conversão. Uma só fonte para o percurso comercial:
--   viu a oferta → clicou → iniciou o pagamento → comprou (ou falhou, ou abandonou).
-- A compra é o registo do pagamento na plataforma do início ao fim, com estados e
-- datas; os factos de cada participação e o resumo de cada contacto lêem daqui.
-- Nada é apagado.

-- 1. Parâmetros novos (afináveis sem migration).
INSERT INTO public.intelligence_settings (key, value, description) VALUES
  ('checkout_abandoned_hours', 24, 'Pagamento abandonado: horas de um pagamento pendente sem conclusão'),
  ('attribution_window_days', 30, 'Atribuição de compras: dias entre a última vez que assistiu e a compra');

-- 2. Estados do pagamento: pending (iniciado) → failed / abandoned → approved → refunded.
ALTER TABLE public.real_purchase_events
  DROP CONSTRAINT real_purchase_events_status_check,
  ADD CONSTRAINT real_purchase_events_status_check
    CHECK (status IN ('pending', 'failed', 'abandoned', 'approved', 'refunded')),
  -- Id do produto na plataforma: a prova que liga a compra à oferta de um webinar.
  ADD COLUMN product_id text,
  ADD COLUMN approved_at timestamptz,
  -- Quando o estado actual começou.
  ADD COLUMN status_at timestamptz DEFAULT now();
UPDATE public.real_purchase_events SET status_at = created_at;
UPDATE public.real_purchase_events SET approved_at = created_at
  WHERE status IN ('approved', 'refunded');
ALTER TABLE public.real_purchase_events ALTER COLUMN status_at SET NOT NULL;

-- As datas das transições valem para todos os que escrevem (webhooks novos e o antigo).
CREATE FUNCTION public.purchases_status_times() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_at := now();
  END IF;
  IF NEW.status = 'approved' AND NEW.approved_at IS NULL THEN
    NEW.approved_at := NEW.status_at;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.purchases_status_times() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER purchases_status_times
  BEFORE INSERT OR UPDATE OF status ON public.real_purchase_events
  FOR EACH ROW EXECUTE FUNCTION public.purchases_status_times();

-- Apagar um webinar deixa de apagar as vendas dele: ficam sem webinar.
ALTER TABLE public.real_purchase_events
  DROP CONSTRAINT real_purchase_events_webinar_id_fkey,
  ADD CONSTRAINT real_purchase_events_webinar_id_fkey
    FOREIGN KEY (webinar_id) REFERENCES public.webinars(id) ON DELETE SET NULL;

-- As compras só chegam pelos webhooks verificados: no browser passam a ser só de leitura.
DROP POLICY real_purchase_events_members ON public.real_purchase_events;
CREATE POLICY real_purchase_events_read ON public.real_purchase_events
  FOR SELECT TO authenticated USING (is_organization_member(organization_id));

-- 3. Atribuição de uma compra a um webinar (decisão 4), só com prova:
--   1. o webinar em que a pessoa se inscreveu antes da compra e cuja oferta aponta
--      para o produto;
--   2. senão, o último webinar a que assistiu nos dias do parâmetro antes da compra;
--   3. senão, nenhum.
CREATE FUNCTION public.purchase_attribution(
  _contact_id uuid, _product_id text, _at timestamptz DEFAULT now()
) RETURNS TABLE (webinar_id uuid, evidence text)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT c.webinar_id, c.evidence FROM (
    (SELECT f.webinar_id, 'offer'::text AS evidence, 1 AS priority
       FROM participant_facts f
       JOIN webinars w ON w.id = f.webinar_id
      WHERE f.contact_id = _contact_id
        AND f.joined_at <= _at
        -- Ids muito curtos coincidiam com qualquer endereço.
        AND length(btrim(coalesce(_product_id, ''))) >= 4
        AND strpos(coalesce(w.cta_url, ''), btrim(_product_id)) > 0
      ORDER BY f.joined_at DESC
      LIMIT 1)
    UNION ALL
    (SELECT f.webinar_id, 'attended'::text, 2
       FROM participant_facts f
      WHERE f.contact_id = _contact_id
        AND f.attended
        AND f.joined_at <= _at
        AND coalesce(f.last_progress_at, f.joined_at)
            > _at - make_interval(days => intelligence_setting('attribution_window_days')::integer)
      ORDER BY coalesce(f.last_progress_at, f.joined_at) DESC
      LIMIT 1)
  ) c
  ORDER BY c.priority
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.purchase_attribution(uuid, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_attribution(uuid, text, timestamptz) TO service_role;

-- 4. Factos de cada participação: as colunas do bloco 1, mais a oferta e o
-- percurso comercial da pessoa neste webinar (só compras atribuídas a ele).
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
  (k.abandoned AND NOT k.purchased) AS checkout_abandoned
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

-- 5. contact_summaries lê o percurso canónico. As colunas antigas ficam, pela mesma
-- ordem; "viu a oferta" passa a ser o evento (não a posição) e o clique passa a
-- contar também os eventos. No fim: iniciou o pagamento, pagamento falhado e
-- abandonado (o estado do pagamento mais recente da pessoa).
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
  coalesce(p.saw_offer, false) AS reached_offer,
  coalesce(p.clicked_offer, false) AS clicked_offer,
  coalesce(msg.messages, 0)::int AS messages,
  coalesce(buy.purchases, 0)::int AS purchases,
  p.first_seen_at,
  coalesce(p.last_seen_at, c.created_at) AS last_seen_at,
  coalesce(p.webinar_ids, '{}') AS webinar_ids,
  coalesce(l.list_ids, '{}') AS list_ids,
  CASE
    WHEN coalesce(buy.purchases, 0) > 0 THEN 'customer'
    WHEN coalesce(buy.checkout_started, false) THEN 'checkout'
    WHEN coalesce(p.clicked_offer, false) THEN 'clicked'
    WHEN coalesce(p.saw_offer, false) THEN 'reached_offer'
    WHEN coalesce(p.events_attended, 0) > 0 THEN 'watched'
    WHEN coalesce(p.events_registered, 0) > 0 THEN 'no_show'
    ELSE 'new'
  END AS stage,
  coalesce(c.first_source, CASE WHEN c.source = 'registration' THEN 'direto' ELSE c.source END) AS first_source,
  c.first_campaign,
  coalesce(buy.checkout_started, false) AS checkout_started,
  coalesce(buy.last_status = 'failed', false) AS payment_failed,
  coalesce(buy.last_status = 'abandoned'
    OR (buy.last_status = 'pending'
        AND buy.last_status_at < now() - make_interval(hours => s.abandoned_hours)),
    false) AS checkout_abandoned
FROM public.contacts c
CROSS JOIN (
  SELECT public.intelligence_setting('checkout_abandoned_hours')::integer AS abandoned_hours
) s
LEFT JOIN LATERAL (
  SELECT
    count(*) AS events_registered,
    count(*) FILTER (WHERE pw.attended) AS events_attended,
    sum(pw.watch_seconds) AS watched_seconds,
    bool_or(pw.saw_offer) AS saw_offer,
    bool_or(pw.clicked) AS clicked_offer,
    min(pw.first_seen) AS first_seen_at,
    max(pw.last_seen) AS last_seen_at,
    array_agg(pw.webinar_id) AS webinar_ids
  FROM (
    -- Uma linha por webinar: quem entrou em dois aparelhos conta uma vez.
    SELECT f.webinar_id,
      bool_or(f.attended) AS attended,
      max(f.actual_watch_seconds) AS watch_seconds,
      bool_or(f.saw_offer) AS saw_offer,
      bool_or(f.clicked) AS clicked,
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
-- Todos os pagamentos do contacto, com ou sem webinar atribuído.
LEFT JOIN LATERAL (
  SELECT
    count(*) FILTER (WHERE rp.status = 'approved') AS purchases,
    count(*) > 0 AS checkout_started,
    (array_agg(rp.status ORDER BY rp.status_at DESC))[1] AS last_status,
    max(rp.status_at) AS last_status_at
  FROM public.real_purchase_events rp
  WHERE rp.contact_id = c.id
) buy ON true
LEFT JOIN LATERAL (
  SELECT array_agg(m.list_id) AS list_ids
  FROM public.contact_list_members m
  WHERE m.contact_id = c.id
) l ON true;

-- 6. As contagens e as origens dos Contactos ganham a etapa do pagamento.
CREATE OR REPLACE FUNCTION public.contact_stage_counts(
  _organization_id uuid, _list_id uuid DEFAULT NULL, _webinar_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'all', count(*),
    'new', count(*) FILTER (WHERE stage = 'new'),
    'no_show', count(*) FILTER (WHERE stage = 'no_show'),
    'watched', count(*) FILTER (WHERE stage = 'watched'),
    'reached_offer', count(*) FILTER (WHERE stage = 'reached_offer'),
    'clicked', count(*) FILTER (WHERE stage = 'clicked'),
    'checkout', count(*) FILTER (WHERE stage = 'checkout'),
    'customer', count(*) FILTER (WHERE stage = 'customer'),
    'returning', count(*) FILTER (WHERE events_attended >= 2)
  )
  FROM contact_summaries
  WHERE organization_id = _organization_id
    AND (_list_id IS NULL OR _list_id = ANY (list_ids))
    AND (_webinar_id IS NULL OR _webinar_id = ANY (webinar_ids));
$$;

CREATE OR REPLACE FUNCTION public.contact_source_breakdown(
  _organization_id uuid, _list_id uuid DEFAULT NULL, _webinar_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.contacts DESC), '[]'::jsonb)
  FROM (
    SELECT
      first_source AS source,
      count(*) AS contacts,
      count(*) FILTER (WHERE events_attended > 0) AS attended,
      count(*) FILTER (WHERE reached_offer OR clicked_offer OR checkout_started) AS reached_offer,
      count(*) FILTER (WHERE clicked_offer) AS clicked,
      count(*) FILTER (WHERE checkout_started) AS checkout,
      count(*) FILTER (WHERE purchases > 0) AS customers
    FROM contact_summaries
    WHERE organization_id = _organization_id
      AND (_list_id IS NULL OR _list_id = ANY (list_ids))
      AND (_webinar_id IS NULL OR _webinar_id = ANY (webinar_ids))
    GROUP BY first_source
  ) t;
$$;

NOTIFY pgrst, 'reload schema';
