-- Contactos: a pessoa, com o histórico todo na organização. Um participante é
-- essa pessoa num evento concreto; cada registo passa a apontar para o contacto.

CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text,
  phone text,
  source text NOT NULL DEFAULT 'registration'
    CHECK (source IN ('registration', 'import', 'manual', 'integration')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contacts_email_lower CHECK (email IS NULL OR email = lower(email)),
  CONSTRAINT contacts_has_channel CHECK (email IS NOT NULL OR phone IS NOT NULL),
  CONSTRAINT contacts_org_email_key UNIQUE (organization_id, email),
  CONSTRAINT contacts_id_org_key UNIQUE (id, organization_id)
);
CREATE INDEX contacts_org_phone_idx ON public.contacts (organization_id, phone);

CREATE TABLE public.contact_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (btrim(name) <> ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contact_lists_org_name_key UNIQUE (organization_id, name),
  CONSTRAINT contact_lists_id_org_key UNIQUE (id, organization_id)
);

-- As chaves compostas impedem ligar uma lista ou um contacto de outra organização.
CREATE TABLE public.contact_list_members (
  list_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, contact_id),
  FOREIGN KEY (list_id, organization_id)
    REFERENCES public.contact_lists (id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id, organization_id)
    REFERENCES public.contacts (id, organization_id) ON DELETE CASCADE
);
CREATE INDEX contact_list_members_contact_idx
  ON public.contact_list_members (contact_id, organization_id);

ALTER TABLE public.participants ADD COLUMN contact_id uuid;
ALTER TABLE public.participants
  ADD CONSTRAINT participants_contact_fk FOREIGN KEY (contact_id, organization_id)
  REFERENCES public.contacts (id, organization_id) ON DELETE SET NULL (contact_id);
CREATE INDEX participants_contact_idx ON public.participants (contact_id);
CREATE INDEX participants_org_joined_idx ON public.participants (organization_id, joined_at DESC);
CREATE INDEX private_messages_participant_idx ON public.private_messages (participant_id);
CREATE INDEX cta_events_participant_idx ON public.cta_events (participant_id);

-- Compras ligadas à pessoa: o email do comprador encontra (ou cria) o contacto.
ALTER TABLE public.real_purchase_events
  ADD COLUMN buyer_email text,
  ADD COLUMN contact_id uuid,
  ADD COLUMN amount_value numeric(12, 2),
  ADD COLUMN currency text,
  ADD COLUMN status text NOT NULL DEFAULT 'approved'
    CHECK (status IN ('approved', 'refunded', 'pending')),
  ADD COLUMN provider text NOT NULL DEFAULT 'manual',
  ADD COLUMN external_id text;
ALTER TABLE public.real_purchase_events
  ADD CONSTRAINT real_purchase_events_contact_fk FOREIGN KEY (contact_id, organization_id)
  REFERENCES public.contacts (id, organization_id) ON DELETE SET NULL (contact_id);
CREATE INDEX real_purchase_events_contact_idx ON public.real_purchase_events (contact_id);
CREATE UNIQUE INDEX real_purchase_events_external_key
  ON public.real_purchase_events (organization_id, provider, external_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts, public.contact_lists,
  public.contact_list_members TO authenticated;
GRANT ALL ON public.contacts, public.contact_lists, public.contact_list_members TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_list_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts_members" ON public.contacts FOR ALL TO authenticated
  USING (public.is_organization_member(organization_id))
  WITH CHECK (public.is_organization_member(organization_id));
CREATE POLICY "contact_lists_members" ON public.contact_lists FOR ALL TO authenticated
  USING (public.is_organization_member(organization_id))
  WITH CHECK (public.is_organization_member(organization_id));
CREATE POLICY "contact_list_members_members" ON public.contact_list_members FOR ALL TO authenticated
  USING (public.is_organization_member(organization_id))
  WITH CHECK (public.is_organization_member(organization_id));

-- Encontra ou cria o contacto. Email primeiro; sem email, pelo telefone.
-- Corre com os direitos de quem chama, por isso o RLS continua a valer.
-- ponytail: telefone só sem espaços/símbolos; "923…" e "+244923…" contam como dois.
CREATE FUNCTION public.upsert_contact(
  _organization_id uuid, _name text, _email text, _phone text, _source text
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  e text := nullif(lower(btrim(coalesce(_email, ''))), '');
  p text := nullif(regexp_replace(coalesce(_phone, ''), '[^0-9+]', '', 'g'), '');
  n text := btrim(coalesce(_name, ''));
  cid uuid;
BEGIN
  IF e LIKE '%@sala.local' THEN e := NULL; END IF;  -- convidados do acesso facilitado
  IF e IS NULL AND p IS NULL THEN RETURN NULL; END IF;

  IF e IS NOT NULL THEN
    INSERT INTO contacts (organization_id, name, email, phone, source)
    VALUES (_organization_id, n, e, p, _source)
    ON CONFLICT (organization_id, email) DO UPDATE
      SET name = CASE WHEN contacts.name = '' THEN excluded.name ELSE contacts.name END,
          phone = coalesce(contacts.phone, excluded.phone),
          updated_at = now()
    RETURNING id INTO cid;
    RETURN cid;
  END IF;

  SELECT id INTO cid FROM contacts
  WHERE organization_id = _organization_id AND phone = p
  ORDER BY created_at LIMIT 1;
  IF cid IS NULL THEN
    INSERT INTO contacts (organization_id, name, phone, source)
    VALUES (_organization_id, n, p, _source)
    RETURNING id INTO cid;
  END IF;
  RETURN cid;
END $$;

CREATE FUNCTION public.participants_link_contact() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.contact_id IS NULL THEN
    NEW.contact_id := upsert_contact(NEW.organization_id, NEW.name, NEW.email, NEW.phone, 'registration');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER participants_link_contact BEFORE INSERT ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.participants_link_contact();

CREATE FUNCTION public.purchases_link_contact() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.contact_id IS NULL AND NEW.buyer_email IS NOT NULL THEN
    NEW.contact_id := upsert_contact(NEW.organization_id, NEW.buyer_name, NEW.buyer_email, NULL, 'integration');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER purchases_link_contact BEFORE INSERT ON public.real_purchase_events
  FOR EACH ROW EXECUTE FUNCTION public.purchases_link_contact();

-- Importação de uma folha: [{name, email, phone}], opcionalmente para uma lista.
CREATE FUNCTION public.import_contacts(_organization_id uuid, _list_id uuid, _rows jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  r jsonb;
  cid uuid;
  n integer := 0;
BEGIN
  IF jsonb_array_length(_rows) > 5000 THEN
    RAISE EXCEPTION 'Máximo de 5000 contactos por importação.';
  END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(_rows) LOOP
    cid := upsert_contact(_organization_id, r->>'name', r->>'email', r->>'phone', 'import');
    CONTINUE WHEN cid IS NULL;
    IF _list_id IS NOT NULL THEN
      INSERT INTO contact_list_members (list_id, contact_id, organization_id)
      VALUES (_list_id, cid, _organization_id)
      ON CONFLICT DO NOTHING;
    END IF;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

REVOKE EXECUTE ON FUNCTION public.upsert_contact(uuid, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.import_contacts(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_contact(uuid, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.import_contacts(uuid, uuid, jsonb) TO authenticated, service_role;

-- Resumo por contacto, para a lista filtrar e ordenar no servidor.
-- security_invoker: a vista respeita o RLS de quem pergunta.
-- ponytail: agrega em cada pedido; passar a tabela materializada se as organizações chegarem às centenas de milhares de contactos.
CREATE VIEW public.contact_summaries WITH (security_invoker = on) AS
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
  coalesce(l.list_ids, '{}') AS list_ids
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

GRANT SELECT ON public.contact_summaries TO authenticated, service_role;

-- Registos já existentes passam a ter contacto.
UPDATE public.participants
SET contact_id = public.upsert_contact(organization_id, name, email, phone, 'registration')
WHERE contact_id IS NULL;
