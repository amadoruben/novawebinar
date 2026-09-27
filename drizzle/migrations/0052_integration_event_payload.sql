-- O pedido em bruto de cada webhook de venda já verificado. Se a leitura do
-- evento falhar ou a plataforma mudar o formato, a venda pode ser reprocessada
-- a partir daqui em vez de se perder.
ALTER TABLE public.integration_events ADD COLUMN IF NOT EXISTS payload text;

-- O pedido traz dados pessoais do comprador: só o servidor o lê. O painel
-- continua a ver as colunas de sempre.
REVOKE SELECT ON public.integration_events FROM authenticated;
GRANT SELECT (
  id, organization_id, integration_id, provider, status, reason, event_type,
  buyer_email, product_name, amount_value, currency, purchase_id, received_at
) ON public.integration_events TO authenticated;

-- Guardado 30 dias; depois fica só o resumo do evento.
SELECT cron.schedule(
  'integration-events-payload-retention',
  '17 3 * * *',
  $$UPDATE public.integration_events SET payload = NULL
    WHERE payload IS NOT NULL AND received_at < now() - interval '30 days'$$
);
