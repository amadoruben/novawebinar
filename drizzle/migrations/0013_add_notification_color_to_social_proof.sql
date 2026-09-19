ALTER TABLE public.social_proof_settings ADD COLUMN notification_color TEXT NOT NULL DEFAULT 'emerald';

COMMENT ON COLUMN public.social_proof_settings.notification_color IS 'Cor das notificações de compra (emerald, amber, blue, rose, violet, slate)';
