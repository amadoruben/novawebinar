-- Segmentos: o reembolso passa a vir do Core (participant_facts.refunded, 0065: reembolsada e
-- sem outra compra aprovada no webinar) em vez de ser calculado aqui a partir das compras.
-- Uma só definição de "reembolsado" para segmentos, automações e páginas.
CREATE OR REPLACE FUNCTION public.segment_facts(_contact_id uuid, _webinar_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT public.automation_contact_facts(_contact_id, _webinar_id) || jsonb_build_object(
    'webinar_id', _webinar_id,
    'refunded', (SELECT coalesce(bool_or(f.refunded), false) FROM participant_facts f
                  WHERE f.contact_id = _contact_id AND f.webinar_id = _webinar_id),
    'utm_source', o.sources, 'utm_medium', o.mediums, 'utm_campaign', o.campaigns)
  FROM (
    SELECT coalesce(jsonb_agg(DISTINCT lower(p.utm_source)) FILTER (WHERE p.utm_source IS NOT NULL), '[]') AS sources,
           coalesce(jsonb_agg(DISTINCT lower(p.utm_medium)) FILTER (WHERE p.utm_medium IS NOT NULL), '[]') AS mediums,
           coalesce(jsonb_agg(DISTINCT lower(p.utm_campaign)) FILTER (WHERE p.utm_campaign IS NOT NULL), '[]') AS campaigns
      FROM participants p
     WHERE p.contact_id = _contact_id AND p.webinar_id = _webinar_id
  ) o
$$;
