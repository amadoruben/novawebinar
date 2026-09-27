-- Recolha que faltava para a inteligência de dados: em que minuto do vídeo a
-- pessoa clicou ou escreveu, e de onde veio (UTM / página de origem).
ALTER TABLE public.cta_events ADD COLUMN video_second integer CHECK (video_second >= 0);
ALTER TABLE public.private_messages ADD COLUMN video_second integer CHECK (video_second >= 0);
ALTER TABLE public.participants
  ADD COLUMN utm_source text,
  ADD COLUMN utm_medium text,
  ADD COLUMN utm_campaign text,
  ADD COLUMN utm_content text,
  ADD COLUMN referrer text;
-- Primeiro toque: a origem da primeira inscrição com origem conhecida.
ALTER TABLE public.contacts
  ADD COLUMN first_source text,
  ADD COLUMN first_campaign text;

CREATE OR REPLACE FUNCTION public.participants_link_contact() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.contact_id IS NULL THEN
    NEW.contact_id := upsert_contact(NEW.organization_id, NEW.name, NEW.email, NEW.phone, 'registration');
  END IF;
  IF NEW.contact_id IS NOT NULL AND NEW.utm_source IS NOT NULL THEN
    UPDATE contacts SET first_source = NEW.utm_source, first_campaign = NEW.utm_campaign
    WHERE id = NEW.contact_id AND first_source IS NULL;
  END IF;
  RETURN NEW;
END $$;

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
    count(DISTINCT pa.webinar_id) AS events_registered,
    count(DISTINCT pa.webinar_id) FILTER (WHERE pa.watched_seconds > 0) AS events_attended,
    sum(pa.watched_seconds) AS watched_seconds,
    bool_or(w.cta_start_seconds IS NOT NULL AND pa.watched_seconds >= w.cta_start_seconds) AS reached_offer,
    bool_or(pa.cta_clicked) AS clicked_offer,
    min(pa.joined_at) AS first_seen_at,
    max(pa.joined_at) AS last_seen_at,
    array_agg(DISTINCT pa.webinar_id) AS webinar_ids
  FROM public.participants pa
  JOIN public.webinars w ON w.id = pa.webinar_id
  WHERE pa.contact_id = c.id
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

-- De onde vêm os leads que convertem: a jornada contada por origem.
CREATE FUNCTION public.contact_source_breakdown(
  _organization_id uuid, _list_id uuid DEFAULT NULL, _webinar_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.contacts DESC), '[]'::jsonb)
  FROM (
    SELECT
      first_source AS source,
      count(*) AS contacts,
      count(*) FILTER (WHERE events_attended > 0) AS attended,
      count(*) FILTER (WHERE reached_offer OR clicked_offer OR purchases > 0) AS reached_offer,
      count(*) FILTER (WHERE clicked_offer) AS clicked,
      count(*) FILTER (WHERE purchases > 0) AS customers
    FROM contact_summaries
    WHERE organization_id = _organization_id
      AND (_list_id IS NULL OR _list_id = ANY (list_ids))
      AND (_webinar_id IS NULL OR _webinar_id = ANY (webinar_ids))
    GROUP BY first_source
  ) t;
$$;
REVOKE EXECUTE ON FUNCTION public.contact_source_breakdown(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contact_source_breakdown(uuid, uuid, uuid) TO authenticated, service_role;
