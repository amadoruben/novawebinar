-- Carteira de IA em dólares: custo real medido + margem. O livro guarda
-- micro-dólares (1 USD = 1 000 000) para somar chamadas de fracções de cêntimo.
-- (A tabela estava vazia quando esta migration foi escrita.)
ALTER TABLE public.credit_ledger RENAME COLUMN delta TO amount_micros;
ALTER TABLE public.credit_ledger ALTER COLUMN amount_micros TYPE bigint;
ALTER TABLE public.credit_ledger DROP CONSTRAINT credit_ledger_delta_check;
ALTER TABLE public.credit_ledger DROP CONSTRAINT credit_ledger_kind_check;
ALTER TABLE public.credit_ledger
  ADD CONSTRAINT credit_ledger_kind_check
    CHECK (kind IN ('grant', 'purchase', 'usage', 'refund', 'adjustment', 'expire')),
  ADD CONSTRAINT credit_ledger_amount_check CHECK (amount_micros <> 0 OR kind = 'expire'),
  ADD COLUMN meta jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE UNIQUE INDEX credit_ledger_purchase_ref ON public.credit_ledger (organization_id, ref)
  WHERE kind = 'purchase' AND ref IS NOT NULL;
CREATE UNIQUE INDEX credit_ledger_expire_period ON public.credit_ledger (organization_id, period)
  WHERE kind = 'expire';

DROP FUNCTION public.credit_balance(uuid);
DROP FUNCTION public.record_credit_usage(uuid, text, integer, numeric, text, text);
DROP FUNCTION public.plan_monthly_credits(text);

-- O plano só muda pelo servidor (depois de um pagamento); o browser só escreve o nome
-- e o limite mensal de gasto.
ALTER TABLE public.organizations
  ADD COLUMN ai_monthly_cap_micros bigint CHECK (ai_monthly_cap_micros IS NULL OR ai_monthly_cap_micros > 0);
REVOKE INSERT, UPDATE ON public.organizations FROM authenticated;
GRANT INSERT (name, slug, created_by) ON public.organizations TO authenticated;
GRANT UPDATE (name, ai_monthly_cap_micros) ON public.organizations TO authenticated;

-- ponytail: valores dos planos fixos aqui; passar para uma tabela quando houver faturação de planos.
CREATE FUNCTION public.plan_monthly_allowance_micros(_plan text) RETURNS bigint
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (CASE _plan WHEN 'creator' THEN 10 WHEN 'business' THEN 25 WHEN 'agency' THEN 50 ELSE 0 END
          * 1000000)::bigint;
$$;

-- Estado da carteira. Faz, sem tarefas agendadas: o saldo de boas-vindas (uma vez),
-- a expiração do saldo de planos de meses anteriores e a atribuição do mês.
CREATE FUNCTION public.credit_state(_organization_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  plan_name text;
  cap bigint;
  this_period text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
  month_start timestamptz := date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  allowance bigint;
  prev record;
  unused bigint;
  total bigint;
  spent bigint;
  granted bigint;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT public.is_organization_member(_organization_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta organização.';
  END IF;
  SELECT plan, ai_monthly_cap_micros INTO plan_name, cap FROM organizations WHERE id = _organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Organização não encontrada.'; END IF;

  INSERT INTO credit_ledger (organization_id, amount_micros, kind, action, description, period)
  VALUES (_organization_id, 2000000, 'grant', 'welcome', 'Saldo de boas-vindas', 'welcome')
  ON CONFLICT (organization_id, period) WHERE kind = 'grant' DO NOTHING;

  -- Gasta-se primeiro o saldo do plano; o que sobrou num mês passado expira.
  FOR prev IN
    SELECT g.period, g.amount_micros
    FROM credit_ledger g
    WHERE g.organization_id = _organization_id AND g.kind = 'grant' AND g.action = 'plan'
      AND g.period < this_period
      AND NOT EXISTS (
        SELECT 1 FROM credit_ledger e
        WHERE e.organization_id = _organization_id AND e.kind = 'expire' AND e.period = g.period
      )
  LOOP
    SELECT greatest(0, prev.amount_micros + coalesce(sum(u.amount_micros), 0)) INTO unused
    FROM credit_ledger u
    WHERE u.organization_id = _organization_id AND u.kind = 'usage'
      AND to_char(u.created_at AT TIME ZONE 'UTC', 'YYYY-MM') = prev.period;
    SELECT coalesce(sum(amount_micros), 0) INTO total FROM credit_ledger WHERE organization_id = _organization_id;
    unused := least(unused, greatest(total, 0));
    INSERT INTO credit_ledger (organization_id, amount_micros, kind, action, description, period)
    VALUES (_organization_id, -unused, 'expire', 'plan', 'Saldo do plano não usado (' || prev.period || ')', prev.period)
    ON CONFLICT (organization_id, period) WHERE kind = 'expire' DO NOTHING;
  END LOOP;

  allowance := plan_monthly_allowance_micros(plan_name);
  IF allowance > 0 THEN
    INSERT INTO credit_ledger (organization_id, amount_micros, kind, action, description, period)
    VALUES (_organization_id, allowance, 'grant', 'plan', 'Saldo do plano (' || this_period || ')', this_period)
    ON CONFLICT (organization_id, period) WHERE kind = 'grant' DO NOTHING;
  END IF;

  SELECT coalesce(sum(amount_micros), 0) INTO total FROM credit_ledger WHERE organization_id = _organization_id;
  SELECT coalesce(-sum(amount_micros), 0) INTO spent FROM credit_ledger
  WHERE organization_id = _organization_id AND kind = 'usage' AND created_at >= month_start;
  SELECT coalesce(sum(amount_micros), 0) INTO granted FROM credit_ledger
  WHERE organization_id = _organization_id AND kind = 'grant' AND action = 'plan' AND period = this_period;

  RETURN jsonb_build_object(
    'balance_micros', total,
    'month_spent_micros', spent,
    'plan', plan_name,
    'plan_allowance_micros', allowance,
    'plan_remaining_micros', greatest(0, least(total, granted - spent)),
    'cap_micros', cap
  );
END $$;

-- Regista o custo de uma acção que correu bem. Só o servidor chama.
CREATE FUNCTION public.record_credit_usage(
  _organization_id uuid, _action text, _amount_micros bigint, _units numeric,
  _description text, _ref text, _meta jsonb
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _amount_micros > 0 THEN
    INSERT INTO credit_ledger (organization_id, amount_micros, kind, action, units, description, ref, meta)
    VALUES (_organization_id, -_amount_micros, 'usage', _action, _units, _description, _ref, coalesce(_meta, '{}'))
    ON CONFLICT (organization_id, ref) WHERE kind = 'usage' AND ref IS NOT NULL DO NOTHING;
  END IF;
  RETURN (SELECT coalesce(sum(amount_micros), 0) FROM credit_ledger WHERE organization_id = _organization_id);
END $$;

-- Recargas pagas: uma por referência de pagamento (repetições do webhook não duplicam).
CREATE FUNCTION public.apply_credit_topup(
  _organization_id uuid, _amount_micros bigint, _ref text, _description text, _meta jsonb
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inserted integer;
BEGIN
  INSERT INTO credit_ledger (organization_id, amount_micros, kind, action, description, ref, meta)
  VALUES (_organization_id, _amount_micros, 'purchase', 'topup', _description, _ref, coalesce(_meta, '{}'))
  ON CONFLICT (organization_id, ref) WHERE kind = 'purchase' AND ref IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted > 0;
END $$;

-- A organização de quem paga: a primeira onde o email é dono ou administrador.
CREATE FUNCTION public.organization_for_billing_email(_email text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT om.organization_id
  FROM auth.users u
  JOIN public.organization_members om ON om.user_id = u.id
  WHERE lower(u.email) = lower(btrim(_email)) AND om.role IN ('owner', 'admin')
  ORDER BY (om.role = 'owner') DESC, om.created_at
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.plan_monthly_allowance_micros(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.credit_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.credit_state(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.record_credit_usage(uuid, text, bigint, numeric, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_credit_usage(uuid, text, bigint, numeric, text, text, jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.apply_credit_topup(uuid, bigint, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_credit_topup(uuid, bigint, text, text, jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.organization_for_billing_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.organization_for_billing_email(text) TO service_role;

-- Produtos "Recarga" à venda na conta Kambafy da plataforma.
CREATE TABLE public.billing_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'kambafy' CHECK (provider IN ('kambafy')),
  external_product_id text NOT NULL,
  label text NOT NULL,
  usd_amount numeric(10, 2) NOT NULL CHECK (usd_amount > 0),
  checkout_url text NOT NULL CHECK (checkout_url ~* '^https://'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_products_external_key UNIQUE (provider, external_product_id)
);
ALTER TABLE public.billing_products ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_products FROM anon, authenticated;
GRANT SELECT ON public.billing_products TO authenticated;
GRANT ALL ON public.billing_products TO service_role;
CREATE POLICY "billing_products_read_active" ON public.billing_products FOR SELECT TO authenticated
  USING (active);

-- Tudo o que chega ao webhook de recargas, com o motivo (só o servidor lê e escreve).
CREATE TABLE public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  status text NOT NULL CHECK (status IN ('accepted', 'rejected', 'ignored', 'unmatched')),
  reason text NOT NULL DEFAULT '',
  event_type text NOT NULL DEFAULT '',
  buyer_email text,
  external_order_id text,
  external_product_id text,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX billing_events_received_idx ON public.billing_events (received_at DESC);
CREATE INDEX billing_events_org_idx ON public.billing_events (organization_id);
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_events FROM anon, authenticated;
GRANT ALL ON public.billing_events TO service_role;
