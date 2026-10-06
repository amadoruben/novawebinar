-- O editor do webinar desenhado na versão 13 e afinado a 6/10/2026. Só colunas novas: nada do
-- que existe muda de valor, nenhuma regra (CHECK) existente é trocada e nada se apaga.
-- Aplicada com a autorização escrita do utilizador («Sim, aplica a 0072», 6/10/2026).
--
-- Página: os campos que a pessoa preenche (nome, e-mail, WhatsApp e campos novos, cada um com
-- o seu ícone e se é obrigatório) e as cores do cartão e do botão. As respostas aos campos
-- novos ficam em participants.answers.
-- Oferta: ofertas seguintes à principal, o prazo, o que acontece quando o cronómetro chega a
-- zero e se o link leva a origem (UTM).
-- Vendas: as compras reais na sala e onde aparecem.
-- Agenda: vários dias e horas na repetição e o just in time sem noites.
-- Sala: o tema «do dispositivo», o selo de verificado e as regras do chat simulado.
-- Audiência: o formato escolhido; «off» é «não mostrar».

ALTER TABLE public.webinars
  ADD COLUMN entry_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN entry_card_color text NOT NULL DEFAULT '#141414'
    CHECK (entry_card_color ~ '^#[0-9A-Fa-f]{6}$'),
  ADD COLUMN entry_button_color text NOT NULL DEFAULT '#E8440C'
    CHECK (entry_button_color ~ '^#[0-9A-Fa-f]{6}$'),
  ADD COLUMN extra_offers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN offer_deadline date,
  ADD COLUMN offer_countdown_end text NOT NULL DEFAULT 'keep'
    CHECK (offer_countdown_end IN ('keep', 'close')),
  ADD COLUMN offer_utm boolean NOT NULL DEFAULT true,
  ADD COLUMN sales_show_real boolean NOT NULL DEFAULT false,
  ADD COLUMN sales_where text NOT NULL DEFAULT 'both'
    CHECK (sales_where IN ('chat', 'video', 'both')),
  ADD COLUMN recurrence_days smallint[] NOT NULL DEFAULT '{}',
  ADD COLUMN recurrence_times text[] NOT NULL DEFAULT '{}',
  ADD COLUMN jit_skip_night boolean NOT NULL DEFAULT false,
  ADD COLUMN host_verified boolean NOT NULL DEFAULT true,
  ADD COLUMN room_theme_system boolean NOT NULL DEFAULT false,
  ADD COLUMN chat_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- O formato que o organizador escolheu; a curva e o modo gravados continuam a ser o que a sala lê.
ALTER TABLE public.audience_configuration
  ADD COLUMN format text CHECK (format IN ('fala', 'dynamic', 'cresce', 'mista', 'real', 'off'));

-- As respostas aos campos que o organizador acrescentou na página: { "<id do campo>": "resposta" }.
ALTER TABLE public.participants ADD COLUMN answers jsonb NOT NULL DEFAULT '{}'::jsonb;
