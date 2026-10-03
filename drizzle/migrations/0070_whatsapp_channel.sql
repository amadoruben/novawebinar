-- Canal WhatsApp das automações: uma ligação por organização, oficial ou não oficial.
-- settings.mode = 'official' (API do WhatsApp Business da Meta: settings.phone_number_id,
-- settings.waba_id e o token de acesso em secret) ou 'unofficial' (número ligado por código QR).
ALTER TABLE public.integrations DROP CONSTRAINT integrations_provider_check;
ALTER TABLE public.integrations ADD CONSTRAINT integrations_provider_check CHECK (provider IN (
  'hotmart', 'kiwify', 'eduzz', 'kambafy', 'stripe', 'webhook',
  'meta_pixel', 'tiktok_pixel', 'google_tag', 'outgoing_webhook', 'whatsapp'
));
