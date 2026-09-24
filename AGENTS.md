# Regras para agentes e contribuidores

- Nunca reescrever histórico já publicado em `main` (sem force push, rebase, amend ou squash de commits enviados). Enquanto o repositório GitHub continuar ligado ao editor externo de origem, cada push a `main` é espelhado lá; manter a branch sempre em estado funcional.
- Segredos só no `.env` local (ignorado pelo Git). Nunca colocar `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` ou `ASSEMBLYAI_API_KEY` no código, no Git ou em relatórios.
- Base de dados: alterações de esquema só por migration explícita e com confirmação; o projecto Supabase é o indicado em `supabase/config.toml`.
- Antes de propor um checkpoint: `npx tsc --noEmit`, `npm run build`, `npx vitest run`.
- Toda a IA passa por `src/lib/ai` (`chatJson`, `generateImage`); nunca chamar fornecedores directamente noutros módulos.
