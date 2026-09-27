-- Prazos do atendimento verificados de minuto a minuto pela própria base de
-- dados: não depende de haver alguém com o ecrã aberto.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

SELECT cron.schedule('support-sla-sweep', '* * * * *', 'SELECT public.support_sla_sweep()');
