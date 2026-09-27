/**
 * Integrações: catálogo (o que cada uma faz e como se liga) e tradução do
 * formato de cada plataforma de vendas para uma venda única, ligada ao contacto.
 */

export type ProviderId =
  | "kambafy"
  | "hotmart"
  | "kiwify"
  | "eduzz"
  | "stripe"
  | "webhook"
  | "meta_pixel"
  | "tiktok_pixel"
  | "google_tag"
  | "outgoing_webhook";

export type IntegrationGroup = "sales" | "ads" | "send";

export type ProviderInfo = {
  id: ProviderId;
  name: string;
  group: IntegrationGroup;
  blurb: string;
  /** Segredo da plataforma: o browser escreve-o, nunca o lê de volta. */
  secret?: { label: string; help: string; required: boolean; generate?: boolean };
  /** Valor visível (id do pixel, endereço de saída). */
  setting?: { key: "pixel_id" | "tag_id" | "url"; label: string; placeholder: string; pattern: RegExp };
  /** Onde a pessoa se liga na plataforma (ex.: "Pagamentos"). */
  category: string;
  /** Painel da plataforma, quando o endereço é estável. */
  dashboardUrl?: string;
  /** Guia de ligação; um passo pode mostrar o endereço, o segredo ou o id no sítio certo. */
  steps: (string | { text: string; show: "url" | "secret" | "setting" })[];
};

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "kambafy",
    name: "Kambafy",
    group: "sales",
    category: "Pagamentos",
    blurb: "Pagamentos em kwanzas e outras moedas; cada venda liga-se ao webinar cuja oferta aponta para o produto.",
    secret: {
      label: "Segredo do webhook",
      help: "Gerado aqui. Por segurança só é mostrado quando o gera.",
      required: false,
      generate: true,
    },
    dashboardUrl: "https://kambafy.com",
    steps: [
      "Na Kambafy, abra o produto que vende no webinar e entre em Integrações › Webhook.",
      { text: "Cole este endereço no campo URL.", show: "url" },
      { text: "Cole este segredo no campo Secret.", show: "secret" },
      "Marque payment.success e order.completed. Se chegarem os dois, a venda conta uma vez.",
      "Carregue em Testar: o teste aparece em Actividade. Repita para cada produto dos seus webinars.",
      "No webinar, use o link de checkout do produto (pay.kambafy.com/checkout/…) no botão da oferta: é assim que a venda fica ligada ao webinar certo.",
    ],
  },
  {
    id: "hotmart",
    name: "Hotmart",
    group: "sales",
    category: "Pagamentos",
    blurb: "Compras aprovadas, reembolsos e chargebacks entram sozinhos.",
    secret: {
      label: "Hottok",
      help: "Está na página de Webhook da Hotmart (API e notificações).",
      required: true,
    },
    steps: [
      "Na Hotmart, vá a Ferramentas › Webhook (API e notificações) › Cadastrar webhook.",
      { text: "Escolha o produto, use a versão 2.0.0 e cole este endereço.", show: "url" },
      "Marque compra aprovada, compra reembolsada e chargeback.",
      { text: "Copie o Hottok da Hotmart e cole-o aqui.", show: "secret" },
    ],
  },
  {
    id: "kiwify",
    name: "Kiwify",
    group: "sales",
    category: "Pagamentos",
    blurb: "Vendas pagas, reembolsos e chargebacks da Kiwify.",
    secret: {
      label: "Token do webhook",
      help: "Aparece na Kiwify ao criar o webhook.",
      required: true,
    },
    steps: [
      "Na Kiwify, vá a Apps › Webhooks e crie um webhook.",
      { text: "Cole este endereço e escolha os produtos.", show: "url" },
      "Marque compra aprovada, compra reembolsada e chargeback.",
      { text: "Copie o token do webhook e cole-o aqui.", show: "secret" },
    ],
  },
  {
    id: "eduzz",
    name: "Eduzz",
    group: "sales",
    category: "Pagamentos",
    blurb: "Faturas pagas, reembolsos e chargebacks da MyEduzz.",
    secret: {
      label: "Chave de acesso",
      help: "Gerada na Eduzz em Console › Webhook › Segurança.",
      required: true,
    },
    steps: [
      "Na Eduzz, abra Console › Webhook › Segurança e gere uma chave.",
      { text: "Crie uma configuração com este endereço e essa chave.", show: "url" },
      "Marque fatura paga, reembolsada e chargeback, e active a configuração.",
      { text: "Cole aqui a mesma chave. O teste da Eduzz aparece em Actividade.", show: "secret" },
    ],
  },
  {
    id: "stripe",
    name: "Stripe",
    group: "sales",
    category: "Pagamentos",
    blurb: "Pagamentos do Checkout e dos Payment Links, e reembolsos.",
    secret: {
      label: "Signing secret",
      help: "Começa por whsec_. Está no endpoint, em Revelar.",
      required: true,
    },
    dashboardUrl: "https://dashboard.stripe.com/webhooks",
    steps: [
      { text: "No Stripe, vá a Webhooks e adicione um endpoint com este endereço.", show: "url" },
      "Escolha checkout.session.completed, checkout.session.async_payment_succeeded e charge.refunded.",
      { text: "Revele o signing secret (whsec_…) e cole-o aqui.", show: "secret" },
    ],
  },
  {
    id: "webhook",
    name: "Outra plataforma",
    group: "sales",
    category: "Qualquer sistema",
    blurb: "Qualquer sistema que envie um POST em JSON com o email de quem comprou.",
    secret: {
      label: "Segredo",
      help: "Os pedidos têm de trazer o cabeçalho X-Webhook-Secret com este valor.",
      required: false,
      generate: true,
    },
    steps: [
      { text: "Envie um POST em JSON para este endereço.", show: "url" },
      'Campos: email, name, phone, product, amount, currency, status ("approved", "refunded" ou "pending") e id.',
      { text: "Envie este segredo no cabeçalho X-Webhook-Secret.", show: "secret" },
    ],
  },
  {
    id: "meta_pixel",
    name: "Meta Pixel",
    group: "ads",
    category: "Facebook e Instagram",
    blurb: "Visita da sala, inscrição (Lead) e clique na oferta (InitiateCheckout).",
    setting: {
      key: "pixel_id",
      label: "ID do pixel",
      placeholder: "123456789012345",
      pattern: /^\d{10,20}$/,
    },
    dashboardUrl: "https://business.facebook.com/events_manager2",
    steps: [
      "No Gestor de Eventos da Meta, abra o seu pixel (conjunto de dados).",
      { text: "Copie o ID (só números) e cole-o aqui.", show: "setting" },
    ],
  },
  {
    id: "tiktok_pixel",
    name: "TikTok Pixel",
    group: "ads",
    category: "TikTok Ads",
    blurb: "Visita, inscrição (CompleteRegistration) e clique na oferta (InitiateCheckout).",
    setting: {
      key: "pixel_id",
      label: "ID do pixel",
      placeholder: "C0ABCDEFGHIJ1234567",
      pattern: /^[A-Z0-9]{15,25}$/,
    },
    steps: [
      "No TikTok Ads Manager, abra Ferramentas › Eventos › Eventos web.",
      { text: "Copie o ID do pixel e cole-o aqui.", show: "setting" },
    ],
  },
  {
    id: "google_tag",
    name: "Google Ads e Analytics",
    group: "ads",
    category: "Google",
    blurb: "Inscrições (generate_lead) e cliques na oferta (begin_checkout) na etiqueta do Google.",
    setting: {
      key: "tag_id",
      label: "ID da etiqueta",
      placeholder: "AW-123456789 ou G-ABC123",
      pattern: /^(AW|G)-[A-Z0-9]{6,15}$/,
    },
    dashboardUrl: "https://ads.google.com",
    steps: [
      "No Google Ads (Ferramentas › Etiqueta do Google) ou no GA4 (Fluxos de dados), encontre o ID.",
      { text: "Cole-o aqui: começa por AW- ou por G-.", show: "setting" },
    ],
  },
  {
    id: "outgoing_webhook",
    name: "Webhook de saída",
    group: "send",
    category: "Zapier, Make, n8n, CRM",
    blurb: "Inscrições, cliques na oferta e vendas enviados em tempo real, com assinatura.",
    setting: {
      key: "url",
      label: "Endereço de destino",
      placeholder: "https://hooks.zapier.com/…",
      pattern: /^https:\/\/\S+$/,
    },
    secret: {
      label: "Chave de assinatura",
      help: "Cada envio leva o cabeçalho X-Signature: HMAC-SHA256 do corpo com esta chave.",
      required: true,
      generate: true,
    },
    steps: [
      { text: "Cole o endereço do Zapier, do Make, do n8n ou do seu CRM.", show: "setting" },
      "Eventos enviados: contact.registered, offer.clicked, purchase.approved e purchase.refunded.",
      { text: "Para confirmar que o pedido vem de nós, valide o X-Signature com esta chave.", show: "secret" },
    ],
  },
];

export function providerInfo(id: string) {
  return PROVIDERS.find((p) => p.id === id);
}

/** Segredo aleatório para as integrações onde somos nós a gerá-lo. */
export function generateSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/* ---------- Tradução das notificações de venda ---------- */

export type NormalizedEvent =
  | {
      kind: "purchase";
      eventType: string;
      status: "approved" | "refunded" | "pending";
      email: string | null;
      name: string;
      phone: string | null;
      product: string;
      amountValue: number | null;
      currency: string | null;
      externalId: string | null;
      /** Id do produto na plataforma: liga a venda ao webinar cuja oferta aponta para ele. */
      productId?: string | null;
    }
  | { kind: "ignore"; eventType: string; reason: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Body = any;

function pick(body: Body, ...paths: string[]): unknown {
  for (const path of paths) {
    let value: unknown = body;
    for (const key of path.split(".")) {
      value = value !== null && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
    }
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

const text = (value: unknown) => (value === undefined || value === null ? "" : String(value).trim());

/** "5000.00", "5.000,00", 97 → número; o resto → null. */
export function parseAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let s = text(value).replace(/[^\d.,-]/g, "");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const ZERO_DECIMAL = new Set(
  "bif clp djf gnf jpy kmf krw mga pyg rwf ugx vnd vuv xaf xof xpf".split(" "),
);

function currencyCode(value: unknown) {
  const code = text(value).toUpperCase();
  if (!code) return null;
  return code === "KZ" || code === "KZS" ? "AOA" : code;
}

function purchase(
  eventType: string,
  status: "approved" | "refunded" | "pending",
  fields: Omit<Extract<NormalizedEvent, { kind: "purchase" }>, "kind" | "eventType" | "status">,
): NormalizedEvent {
  const email = fields.email?.toLowerCase().trim() || null;
  return { kind: "purchase", eventType, status, ...fields, email };
}

const ignore = (eventType: string, reason: string): NormalizedEvent => ({ kind: "ignore", eventType, reason });

function statusFrom(
  map: Record<string, "approved" | "refunded" | "pending">,
  key: string,
): "approved" | "refunded" | "pending" | null {
  return map[key] ?? null;
}

export function normalizeEvent(provider: ProviderId, body: Body): NormalizedEvent {
  switch (provider) {
    case "kambafy": {
      const eventType = text(pick(body, "event"));
      if (eventType === "test.webhook") return ignore(eventType, "Teste recebido da Kambafy.");
      const status = statusFrom(
        {
          "payment.success": "approved",
          "order.completed": "approved",
          "product.purchased": "approved",
          "refund.approved": "refunded",
          "order.pending": "pending",
          "order.created": "pending",
        },
        eventType,
      );
      if (!status) return ignore(eventType, "Evento que não altera vendas.");
      return purchase(eventType, status, {
        email: text(pick(body, "email", "data.customer_email", "data.email")) || null,
        name: text(pick(body, "name", "data.customer_name")),
        phone: text(pick(body, "phone", "data.customer_phone")) || null,
        product: text(pick(body, "data.product_name", "product_name")),
        amountValue: parseAmount(pick(body, "data.total_price", "data.amount", "data.price")),
        currency: currencyCode(pick(body, "data.currency")) ?? "AOA",
        externalId: text(pick(body, "data.order_id", "order_id")) || null,
        productId: text(pick(body, "data.product_id")) || null,
      });
    }
    case "hotmart": {
      const eventType = text(pick(body, "event"));
      const status = statusFrom(
        {
          PURCHASE_APPROVED: "approved",
          PURCHASE_COMPLETE: "approved",
          PURCHASE_REFUNDED: "refunded",
          PURCHASE_CHARGEBACK: "refunded",
          PURCHASE_BILLET_PRINTED: "pending",
        },
        eventType,
      );
      if (!status) return ignore(eventType, "Evento que não altera vendas.");
      const areaCode = text(pick(body, "data.buyer.checkout_phone_code"));
      const phone = text(pick(body, "data.buyer.checkout_phone"));
      return purchase(eventType, status, {
        email: text(pick(body, "data.buyer.email")) || null,
        name: text(pick(body, "data.buyer.name")),
        phone: phone ? `${areaCode}${phone}` : null,
        product: text(pick(body, "data.product.name")),
        productId: text(pick(body, "data.product.id", "data.product.ucode")) || null,
        amountValue: parseAmount(pick(body, "data.purchase.price.value")),
        currency: currencyCode(pick(body, "data.purchase.price.currency_value")),
        externalId: text(pick(body, "data.purchase.transaction")) || null,
      });
    }
    case "kiwify": {
      const eventType = text(pick(body, "webhook_event_type", "order_status"));
      const status = statusFrom(
        { paid: "approved", refunded: "refunded", chargedback: "refunded", waiting_payment: "pending" },
        text(pick(body, "order_status")),
      );
      if (!status) return ignore(eventType, "Evento que não altera vendas.");
      const cents = parseAmount(pick(body, "Commissions.charge_amount"));
      return purchase(eventType, status, {
        email: text(pick(body, "Customer.email")) || null,
        name: text(pick(body, "Customer.full_name", "Customer.first_name")),
        phone: text(pick(body, "Customer.mobile")) || null,
        product: text(pick(body, "Product.product_name")),
        productId: text(pick(body, "Product.product_id")) || null,
        amountValue: cents === null ? null : cents / 100,
        currency: currencyCode(pick(body, "Commissions.currency")),
        externalId: text(pick(body, "order_id")) || null,
      });
    }
    case "eduzz": {
      const eventType = text(pick(body, "event"));
      if (eventType === "ping") return ignore(eventType, "Teste recebido da Eduzz.");
      const status = statusFrom(
        {
          "myeduzz.invoice_paid": "approved",
          "myeduzz.invoice_refunded": "refunded",
          "myeduzz.invoice_chargeback": "refunded",
          "myeduzz.invoice_opened": "pending",
          "myeduzz.invoice_waiting_payment": "pending",
        },
        eventType,
      );
      if (!status) return ignore(eventType, "Evento que não altera vendas.");
      return purchase(eventType, status, {
        email: text(pick(body, "data.buyer.email")) || null,
        name: text(pick(body, "data.buyer.name")),
        phone: text(pick(body, "data.buyer.cellphone", "data.buyer.phone")) || null,
        product: text(pick(body, "data.items.0.name", "data.offer.name")),
        amountValue: parseAmount(pick(body, "data.paid.value")),
        currency: currencyCode(pick(body, "data.paid.currency")),
        externalId: text(pick(body, "data.id")) || null,
      });
    }
    case "stripe": {
      const eventType = text(pick(body, "type"));
      const object = pick(body, "data.object") as Body;
      const minor = (amount: unknown, currency: string | null) => {
        const n = parseAmount(amount);
        if (n === null) return null;
        return currency && ZERO_DECIMAL.has(currency.toLowerCase()) ? n : n / 100;
      };
      if (
        eventType === "checkout.session.completed" ||
        eventType === "checkout.session.async_payment_succeeded"
      ) {
        const paid = ["paid", "no_payment_required"].includes(text(pick(object, "payment_status")));
        const currency = currencyCode(pick(object, "currency"));
        return purchase(eventType, paid ? "approved" : "pending", {
          email: text(pick(object, "customer_details.email", "customer_email")) || null,
          name: text(pick(object, "customer_details.name")),
          phone: text(pick(object, "customer_details.phone")) || null,
          product: text(pick(object, "metadata.product", "metadata.product_name")) || "Stripe",
          amountValue: minor(pick(object, "amount_total"), currency),
          currency,
          // O payment_intent é o mesmo na venda e no reembolso.
          externalId: text(pick(object, "payment_intent", "id")) || null,
        });
      }
      if (eventType === "charge.refunded") {
        const currency = currencyCode(pick(object, "currency"));
        return purchase(eventType, "refunded", {
          email: text(pick(object, "billing_details.email", "receipt_email")) || null,
          name: text(pick(object, "billing_details.name")),
          phone: text(pick(object, "billing_details.phone")) || null,
          product: text(pick(object, "metadata.product", "description")) || "Stripe",
          amountValue: minor(pick(object, "amount"), currency),
          currency,
          externalId: text(pick(object, "payment_intent", "id")) || null,
        });
      }
      return ignore(eventType, "Evento que não altera vendas.");
    }
    case "webhook": {
      const raw = text(pick(body, "status", "event")).toLowerCase();
      const status: "approved" | "refunded" | "pending" | null = !raw
        ? "approved"
        : /refund|reembols|chargeback|estorn/.test(raw)
          ? "refunded"
          : /pend|wait|aguard/.test(raw)
            ? "pending"
            : /approv|aprov|paid|pago|success|complet/.test(raw)
              ? "approved"
              : null;
      if (!status) return ignore(raw, "Estado desconhecido: use approved, refunded ou pending.");
      return purchase(raw || "purchase", status, {
        email: text(pick(body, "email", "buyer_email", "customer.email")) || null,
        name: text(pick(body, "name", "buyer_name", "customer.name")),
        phone: text(pick(body, "phone", "customer.phone")) || null,
        product: text(pick(body, "product", "product_name")),
        amountValue: parseAmount(pick(body, "amount", "value", "price")),
        currency: currencyCode(pick(body, "currency")),
        externalId: text(pick(body, "id", "transaction_id", "order_id")) || null,
      });
    }
    default:
      return ignore("", "Esta integração não recebe vendas.");
  }
}
