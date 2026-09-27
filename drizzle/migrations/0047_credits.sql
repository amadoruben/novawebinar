-- Créditos de IA: livro de movimentos só de acrescentar. O saldo é a soma.
-- Só o servidor regista gastos; os membros lêem o histórico da organização.
CREATE TABLE public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  delta integer NOT NULL CHECK (delta <> 0),
  kind text NOT NULL CHECK (kind IN ('grant', 'purchase', 'usage', 'refund', 'adjustment')),
  action text NOT NULL DEFAULT '',
  units numeric(10, 2),
  description text NOT NULL DEFAULT '',
  ref text,
  period text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credit_ledger_org_idx ON public.credit_ledger (organization_id, created_at DESC);
-- Uma atribuição do plano por mês; um gasto por referência (repetições não cobram duas vezes).
CREATE UNIQUE INDEX credit_ledger_grant_period ON public.credit_ledger (organization_id, period)
  WHERE kind = 'grant';
CREATE UNIQUE INDEX credit_ledger_usage_ref ON public.credit_ledger (organization_id, ref)
  WHERE kind = 'usage' AND ref IS NOT NULL;

ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.credit_ledger FROM anon, authenticated;
GRANT SELECT ON public.credit_ledger TO authenticated;
GRANT ALL ON public.credit_ledger TO service_role;
CREATE POLICY "credit_ledger_members_read" ON public.credit_ledger FOR SELECT TO authenticated
  USING (public.is_organization_member(organization_id));

-- ponytail: créditos do plano fixos aqui; passar para uma tabela de planos quando houver faturação.
CREATE FUNCTION public.plan_monthly_credits(_plan text) RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _plan WHEN 'agency' THEN 9000 WHEN 'business' THEN 5000 ELSE 2000 END;
$$;

-- Saldo actual. A atribuição mensal do plano é feita no primeiro pedido do mês,
-- sem depender de tarefas agendadas.
CREATE FUNCTION public.credit_balance(_organization_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  plan_name text;
  this_period text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
  total integer;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT public.is_organization_member(_organization_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta organização.';
  END IF;
  SELECT plan INTO plan_name FROM public.organizations WHERE id = _organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Organização não encontrada.'; END IF;
  INSERT INTO public.credit_ledger (organization_id, delta, kind, action, description, period)
  VALUES (_organization_id, public.plan_monthly_credits(plan_name), 'grant', 'plan',
          'Créditos do plano (' || this_period || ')', this_period)
  ON CONFLICT (organization_id, period) WHERE kind = 'grant' DO NOTHING;
  SELECT coalesce(sum(delta), 0) INTO total FROM public.credit_ledger WHERE organization_id = _organization_id;
  RETURN total;
END $$;

-- Regista um gasto depois de a acção ter corrido bem. Só o servidor chama.
CREATE FUNCTION public.record_credit_usage(
  _organization_id uuid, _action text, _amount integer, _units numeric, _description text, _ref text
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _amount > 0 THEN
    INSERT INTO public.credit_ledger (organization_id, delta, kind, action, units, description, ref)
    VALUES (_organization_id, -_amount, 'usage', _action, _units, _description, _ref)
    ON CONFLICT (organization_id, ref) WHERE kind = 'usage' AND ref IS NOT NULL DO NOTHING;
  END IF;
  RETURN (SELECT coalesce(sum(delta), 0) FROM public.credit_ledger WHERE organization_id = _organization_id);
END $$;

REVOKE EXECUTE ON FUNCTION public.credit_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.credit_balance(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.record_credit_usage(uuid, text, integer, numeric, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_credit_usage(uuid, text, integer, numeric, text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.plan_monthly_credits(text) FROM PUBLIC, anon;
