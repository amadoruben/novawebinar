-- Preço desconhecido não é custo zero: sem preço configurado para o modelo,
-- o custo fica vazio e o estado do preço diz porquê.
ALTER TABLE public.ai_calls ALTER COLUMN cost_micros DROP NOT NULL;
ALTER TABLE public.ai_calls ALTER COLUMN cost_micros DROP DEFAULT;
ALTER TABLE public.ai_calls
  ADD COLUMN pricing_status text NOT NULL DEFAULT 'unknown'
    CHECK (pricing_status IN ('known', 'unknown'));

-- Chamadas feitas por testes contra o fornecedor real: ficam registadas, mas
-- fora de qualquer uso, análise ou cobrança.
ALTER TABLE public.ai_calls ADD COLUMN is_test boolean NOT NULL DEFAULT false;

-- As chamadas de verificação da Fase 1 (27/09, sem organização e sem preço).
UPDATE public.ai_calls
SET is_test = true, cost_micros = NULL, pricing_status = 'unknown'
WHERE organization_id IS NULL
  AND created_at BETWEEN '2026-09-27 15:30:00+00' AND '2026-09-27 16:00:00+00';

-- Os membros nunca vêem chamadas de teste.
DROP POLICY "ai_calls_members_read" ON public.ai_calls;
CREATE POLICY "ai_calls_members_read" ON public.ai_calls FOR SELECT TO authenticated
  USING (public.is_organization_member(organization_id) AND NOT is_test);
