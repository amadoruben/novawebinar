-- Listas manuais e smart lists (segmentos). Um segmento é uma lista com regras: não guarda
-- membros nem copia contactos; quem entra é calculado em cada leitura a partir dos factos
-- do Core (automation_contact_facts sobre participant_facts) e da origem da inscrição
-- (participants: utm_* e webinar). O formato das condições é o das automações
-- ({fact, value} / {fact: actual_watch_seconds, op, value}), com três factos a mais:
-- webinar, refunded e as origens (utm_source, utm_medium, utm_campaign).
--
-- Unidade de avaliação: a participação (pessoa × webinar). Um contacto entra quando uma das
-- suas participações cumpre as regras ("veio do Facebook E comprou" é no mesmo webinar).
-- Só acrescenta: as listas existentes ficam manuais e continuam a funcionar como antes.

-- 1. Tipo e regras
CREATE FUNCTION public.segment_rules_valid(_rules jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN jsonb_typeof(_rules) IS DISTINCT FROM 'object' THEN false
    WHEN coalesce(_rules->>'match' NOT IN ('all', 'any'), true) THEN false
    WHEN _rules - 'match' - 'conditions' <> '{}'::jsonb THEN false
    WHEN jsonb_typeof(_rules->'conditions') IS DISTINCT FROM 'array' THEN false
    WHEN jsonb_array_length(_rules->'conditions') NOT BETWEEN 1 AND 12 THEN false
    ELSE coalesce((
      SELECT bool_and(CASE
        WHEN jsonb_typeof(c) <> 'object' THEN false
        WHEN c->>'fact' = 'webinar'
          THEN jsonb_typeof(c->'value') = 'string'
           AND c->>'value' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           AND c - 'fact' - 'value' = '{}'::jsonb
        WHEN c->>'fact' = 'refunded'
          THEN jsonb_typeof(c->'value') = 'boolean' AND c - 'fact' - 'value' = '{}'::jsonb
        WHEN c->>'fact' IN ('utm_source', 'utm_medium', 'utm_campaign')
          THEN c - 'fact' - 'op' - 'value' = '{}'::jsonb AND CASE c->>'op'
            WHEN 'in' THEN jsonb_typeof(c->'value') = 'array'
              AND jsonb_array_length(c->'value') BETWEEN 1 AND 20
              AND (SELECT bool_and(jsonb_typeof(v) = 'string' AND length(btrim(v #>> '{}')) BETWEEN 1 AND 120)
                     FROM jsonb_array_elements(c->'value') v)
            WHEN 'contains' THEN jsonb_typeof(c->'value') = 'string' AND length(btrim(c->>'value')) BETWEEN 1 AND 120
            WHEN 'empty' THEN NOT c ? 'value'
            ELSE false END
        ELSE public.automation_conditions_valid(jsonb_build_array(c)) END)
      FROM jsonb_array_elements(_rules->'conditions') c), false)
  END
$$;

ALTER TABLE public.contact_lists
  ADD COLUMN kind text NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual', 'smart')),
  ADD COLUMN rules jsonb CHECK (rules IS NULL OR public.segment_rules_valid(rules)),
  ADD CONSTRAINT contact_lists_rules_kind CHECK ((kind = 'smart') = (rules IS NOT NULL));

-- O tipo não muda depois de criada (uma lista manual com membros não passa a segmento).
REVOKE UPDATE ON public.contact_lists FROM authenticated;
GRANT UPDATE (name, rules) ON public.contact_lists TO authenticated;

-- Um segmento não tem membros guardados.
CREATE FUNCTION public.contact_list_members_manual_only() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM contact_lists WHERE id = NEW.list_id AND kind = 'smart') THEN
    RAISE EXCEPTION 'Um segmento não tem membros manuais: os contactos entram pelas regras.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.contact_list_members_manual_only() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER contact_list_members_manual_only BEFORE INSERT OR UPDATE ON public.contact_list_members
  FOR EACH ROW EXECUTE FUNCTION public.contact_list_members_manual_only();

-- 2. Factos de uma participação: os do Core, mais o webinar, o reembolso e as origens.
-- Corre com os direitos de quem pergunta (RLS de participant_facts e participants).
CREATE FUNCTION public.segment_facts(_contact_id uuid, _webinar_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT public.automation_contact_facts(_contact_id, _webinar_id) || jsonb_build_object(
    'webinar_id', _webinar_id,
    'refunded', EXISTS (
      SELECT 1 FROM real_purchase_events r
       WHERE r.contact_id = _contact_id AND r.webinar_id = _webinar_id AND r.status = 'refunded'),
    'utm_source', o.sources, 'utm_medium', o.mediums, 'utm_campaign', o.campaigns)
  FROM (
    SELECT coalesce(jsonb_agg(DISTINCT lower(p.utm_source)) FILTER (WHERE p.utm_source IS NOT NULL), '[]') AS sources,
           coalesce(jsonb_agg(DISTINCT lower(p.utm_medium)) FILTER (WHERE p.utm_medium IS NOT NULL), '[]') AS mediums,
           coalesce(jsonb_agg(DISTINCT lower(p.utm_campaign)) FILTER (WHERE p.utm_campaign IS NOT NULL), '[]') AS campaigns
      FROM participants p
     WHERE p.contact_id = _contact_id AND p.webinar_id = _webinar_id
  ) o
$$;

CREATE FUNCTION public.segment_condition_met(_c jsonb, _facts jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(CASE
    WHEN _c->>'fact' = 'webinar' THEN _facts->>'webinar_id' = _c->>'value'
    WHEN _c->>'fact' = 'refunded' THEN _facts->'refunded' = _c->'value'
    WHEN _c->>'fact' IN ('utm_source', 'utm_medium', 'utm_campaign') THEN CASE _c->>'op'
      WHEN 'in' THEN EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(coalesce(_facts->(_c->>'fact'), '[]')) f
          JOIN jsonb_array_elements_text(_c->'value') v ON f = lower(btrim(v)))
      WHEN 'contains' THEN EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(coalesce(_facts->(_c->>'fact'), '[]')) f
         WHERE strpos(f, lower(btrim(_c->>'value'))) > 0)
      WHEN 'empty' THEN jsonb_array_length(coalesce(_facts->(_c->>'fact'), '[]')) = 0
    END
    ELSE public.automation_conditions_met(jsonb_build_array(_c), _facts)
  END, false)
$$;

CREATE FUNCTION public.segment_rules_met(_rules jsonb, _facts jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN _rules->>'match' = 'any'
              THEN coalesce(bool_or(public.segment_condition_met(c, _facts)), false)
              ELSE coalesce(bool_and(public.segment_condition_met(c, _facts)), false) END
    FROM jsonb_array_elements(_rules->'conditions') c
$$;

-- 3. Quem está numa lista (manual: os membros; segmento: as regras, calculadas agora).
-- ponytail: avalia cada participação da organização em cada leitura (uma chamada aos factos
-- por pessoa × webinar); com dezenas de milhares de participações, guardar o resultado por
-- segmento e recalcular no tick.
CREATE FUNCTION public.contact_list_member_ids(_list_id uuid) RETURNS SETOF uuid
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT m.contact_id
    FROM contact_list_members m
    JOIN contact_lists l ON l.id = m.list_id AND l.kind = 'manual'
   WHERE m.list_id = _list_id
  UNION
  SELECT pw.contact_id
    FROM contact_lists l
   CROSS JOIN LATERAL (
     SELECT DISTINCT p.contact_id, p.webinar_id
       FROM participants p
      WHERE p.organization_id = l.organization_id AND p.contact_id IS NOT NULL
        -- Com "todas" e um webinar nas regras, só as participações desse webinar.
        AND (l.rules->>'match' = 'any' OR NOT EXISTS (
              SELECT 1 FROM jsonb_array_elements(l.rules->'conditions') c
               WHERE c->>'fact' = 'webinar' AND c->>'value' <> p.webinar_id::text))
   ) pw
   WHERE l.id = _list_id AND l.kind = 'smart'
     AND public.segment_rules_met(l.rules, public.segment_facts(pw.contact_id, pw.webinar_id))
$$;

CREATE FUNCTION public.contacts_in_list(_list_id uuid) RETURNS SETOF public.contact_summaries
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT s.* FROM contact_summaries s WHERE s.id IN (SELECT public.contact_list_member_ids(_list_id))
$$;

-- Os segmentos em que estão estes contactos (a página visível da lista, a ficha).
CREATE FUNCTION public.contact_segments(_contact_ids uuid[])
RETURNS TABLE (contact_id uuid, list_id uuid)
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH pw AS MATERIALIZED (
    SELECT DISTINCT p.contact_id, p.webinar_id, p.organization_id
      FROM participants p
     WHERE p.contact_id = ANY (_contact_ids[1:200])
  ), f AS MATERIALIZED (
    SELECT pw.contact_id, pw.organization_id, public.segment_facts(pw.contact_id, pw.webinar_id) AS facts
      FROM pw
  )
  SELECT DISTINCT f.contact_id, l.id
    FROM f
    JOIN contact_lists l ON l.organization_id = f.organization_id AND l.kind = 'smart'
   WHERE public.segment_rules_met(l.rules, f.facts)
$$;

REVOKE EXECUTE ON FUNCTION public.contact_list_member_ids(uuid), public.contacts_in_list(uuid),
  public.contact_segments(uuid[]), public.segment_facts(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contact_list_member_ids(uuid), public.contacts_in_list(uuid),
  public.contact_segments(uuid[]), public.segment_facts(uuid, uuid) TO authenticated, service_role;

-- 4. As contagens e as origens da página Contactos passam a servir os dois tipos de lista.
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
    AND (_list_id IS NULL OR id IN (SELECT public.contact_list_member_ids(_list_id)))
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
      AND (_list_id IS NULL OR id IN (SELECT public.contact_list_member_ids(_list_id)))
      AND (_webinar_id IS NULL OR _webinar_id = ANY (webinar_ids))
    GROUP BY first_source
  ) t;
$$;

NOTIFY pgrst, 'reload schema';
