-- Agente da conta (pedido de 8/10/2026, F2): escolher o âmbito do agente, «Só este webinar» ou
-- «Todos os webinars». POR APLICAR: só com a autorização escrita do utilizador.
--
-- O agente da conta é uma linha de ai_agents sem webinar (webinar_id nulo), uma por organização,
-- com o seu conhecimento, perguntas e objeções (as tabelas filhas já apontam para agent_id).
-- Cada webinar guarda o âmbito escolhido na sua linha: 'webinar' (o seu agente) ou 'account'
-- (segue o agente da conta). As linhas que já existem ficam 'webinar': nada muda de valor,
-- nada se apaga, a regra de acesso (membros da organização) não muda.
--
-- Desfazer: DROP INDEX ai_agents_one_account_agent; ALTER TABLE ai_agents DROP CONSTRAINT
-- ai_agents_scope_check, DROP COLUMN scope; DELETE FROM ai_agents WHERE webinar_id IS NULL;
-- ALTER TABLE ai_agents ALTER COLUMN webinar_id SET NOT NULL.

ALTER TABLE public.ai_agents ALTER COLUMN webinar_id DROP NOT NULL;

ALTER TABLE public.ai_agents ADD COLUMN scope text NOT NULL DEFAULT 'webinar';

ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_scope_check
  CHECK (scope IN ('webinar', 'account') AND (webinar_id IS NOT NULL OR scope = 'account'));

-- Um só agente da conta por organização.
CREATE UNIQUE INDEX ai_agents_one_account_agent ON public.ai_agents (organization_id)
  WHERE webinar_id IS NULL;
