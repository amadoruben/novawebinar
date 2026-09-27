-- Uma linha por chamada ao fornecedor de IA: quem, que tarefa, que modelo,
-- quanto custou e quanto demorou. Nunca o texto do pedido nem da resposta.
CREATE TABLE public.ai_calls (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Nulo quando a chamada acontece fora de uma acção cobrada.
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  task text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('ok', 'error')),
  error_code text,
  -- Tentativa dentro do mesmo fornecedor (1 = primeira) e se foi a reserva que respondeu.
  attempt smallint NOT NULL DEFAULT 1,
  fallback boolean NOT NULL DEFAULT false,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  -- Custo do fornecedor em micro-dólares, sem margem.
  cost_micros bigint NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_calls_org_created_idx ON public.ai_calls (organization_id, created_at DESC);
CREATE INDEX ai_calls_created_idx ON public.ai_calls (created_at);

ALTER TABLE public.ai_calls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_calls FROM anon, authenticated;
GRANT SELECT ON public.ai_calls TO authenticated;
GRANT ALL ON public.ai_calls TO service_role;
CREATE POLICY "ai_calls_members_read" ON public.ai_calls FOR SELECT TO authenticated
  USING (public.is_organization_member(organization_id));
-- Custos não são para a função "suporte", como o livro de saldo.
CREATE POLICY support_role_hidden ON public.ai_calls AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT public.is_support_only(organization_id));

-- Guardado 90 dias.
SELECT cron.schedule(
  'ai-calls-retention',
  '23 3 * * *',
  $$DELETE FROM public.ai_calls WHERE created_at < now() - interval '90 days'$$
);
