-- Segmentos: quem abre a página Contactos (authenticated) lê os factos do Core pela mesma
-- função das automações. A função corre com os direitos de quem chama (security invoker),
-- por isso só vê as participações que o RLS de participant_facts deixa ver. Nada mais muda.
GRANT EXECUTE ON FUNCTION public.automation_contact_facts(uuid, uuid) TO authenticated;
