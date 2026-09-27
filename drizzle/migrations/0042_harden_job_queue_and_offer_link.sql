-- Aplicar só depois de publicado o código que cria trabalhos no servidor
-- (background-jobs.functions.ts usa a chave de serviço no insert).

-- 1. Fila: só o servidor cria e altera trabalhos. O motor corre com a chave de
--    serviço e confiava em webinar_id/payload/state escritos directamente pelo
--    cliente. Ler e apagar os próprios trabalhos continua permitido.
REVOKE INSERT, UPDATE ON public.background_jobs FROM authenticated;

-- 2. Token da chamada agendada a /api/public/run-jobs. Se a tabela já foi
--    criada à mão, só se reforçam as permissões. O valor do token insere-se
--    fora do Git: INSERT INTO public.job_runner_config (token) VALUES ('...');
CREATE TABLE IF NOT EXISTS public.job_runner_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  token text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.job_runner_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.job_runner_config FROM anon, authenticated;
GRANT ALL ON public.job_runner_config TO service_role;

-- 3. Link da oferta só http(s), com a mesma regra do editor (offerUrl):
--    sem esquema passa a https://, qualquer outro esquema é removido.
UPDATE public.webinars SET cta_url = NULLIF(btrim(cta_url), '') WHERE cta_url IS NOT NULL;
UPDATE public.webinars SET cta_url = 'https://' || cta_url WHERE cta_url !~* '^[a-z][a-z0-9+.-]*:';
UPDATE public.webinars SET cta_url = NULL WHERE cta_url !~* '^https?://';
ALTER TABLE public.webinars
  ADD CONSTRAINT webinars_cta_url_http CHECK (cta_url IS NULL OR cta_url ~* '^https?://');
