# Análise da cópia do projeto (clone do "Rota Webinary" / NovaWebinar)

## Conclusão geral

O código veio completo e coerente. Não encontrei ficheiros em falta, importações partidas nem funcionalidades removidas: páginas, salas ao vivo e replay, chat programado, motor de IA (comentários, agente, transcrição), analytics, webhooks e tarefas automáticas estão todos presentes, tal como no original.

A base de dados da cópia já tem a estrutura toda criada (28 tabelas, 3 áreas de ficheiros, as 42 migrações aplicadas) e é uma base **nova e separada** — está vazia: 0 organizações, 0 webinars, 0 participantes, 1 conta de utilizador. Ou seja, o código é o mesmo, os dados do projeto original não vieram (o que é o comportamento normal de uma cópia).

As chaves necessárias (IA, transcrição AssemblyAI, tarefas automáticas) estão configuradas nesta cópia.

## O que não está em conformidade

1. **Endereços do projeto original ficaram fixos no código.** Em `src/lib/data.ts` estão escritos à mão os domínios `globalstream.live`, `novawebinar.com` e `admin.novawebinar.com`. São usados para gerar os links públicos das salas e para redirecionar visitantes. Numa cópia com outro domínio, os links públicos que a aplicação gera continuam a apontar para o site do projeto original e o redirecionamento nunca se aplica.
2. **A marca continua "NovaWebinar"** em títulos de páginas, textos legais, área de entrada e barra lateral (~30 sítios). Se o nome desta cópia é outro, falta a mudança de marca.
3. **Documentação e roteiro herdados.** `docs/teste-viver-de-leilao.md` é um relatório de teste de um cliente do projeto original, com identificadores que não existem nesta base. O `roadmap.md` traz tarefas por fazer do original (ativação do domínio `globalstream.live`, Fase 3 de previsão, 2 correções de tempo das reações).
4. **Conta inicial.** Existe 1 utilizador mas 0 organizações — o primeiro acesso tem de criar a organização/perfil para o painel ficar utilizável.

## O que proponho fazer (se aprovar)

1. Tornar os endereços dinâmicos: usar o domínio atual do site em vez dos endereços fixos, mantendo a possibilidade de definir um domínio próprio mais tarde.
2. Substituir o nome "NovaWebinar" pelo nome que indicar, em todas as páginas, textos legais e metadados.
3. Limpar a documentação herdada: remover o relatório de teste do cliente antigo e reescrever o `roadmap.md` só com o que se aplica a esta cópia.
4. Verificar o primeiro acesso ponta a ponta (entrar, criar organização, criar webinar, abrir sala pública) e reportar o que falhar.

## Detalhes técnicos

- `src/lib/data.ts:286-309`: `PUBLIC_APP_URL`, `ADMIN_HOST` e a lista de hosts em `useAdminHostRedirect` passam a derivar de `window.location.origin` (e de `organizations.public_base_url` / `subdomain`, colunas que já existem nas migrações 0006 e 0017).
- Marca: ocorrências de "NovaWebinar" em `src/routes/*.tsx` (head/meta), `src/components/ui/auth-ui.tsx`, `src/components/ui/dashboard-sidebar.tsx`, `src/components/landing/*`, `src/styles.css` (comentário), `src/routes/w.$slug.tsx:85` (chave de armazenamento local — mudar só com cuidado, invalida sessões de visitantes).
- Backend: ref próprio da cópia, `.env` e `supabase/config.toml` coerentes entre si; segredos presentes: `ASSEMBLYAI_API_KEY`, `LOVABLE_API_KEY`, `LOVABLE_CRON_SECRET`. `SUPABASE_SERVICE_ROLE_KEY` é injetado pela plataforma em execução, não pelo `.env`.
- Sem alterações necessárias em `src/start.ts`, rotas de API (`api/generate-image`, `api/public/purchase-webhook`, `api/public/run-jobs`) nem nas migrações.
