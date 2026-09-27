/**
 * Receptor dos webhooks das plataformas de venda e envio do webhook de saída.
 * Tudo o que chega fica em integration_events, aceite ou não, com o motivo.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeEvent, type ProviderId } from "@/lib/integrations";
import { isHttpUrl } from "@/lib/utils";

function same(a: string, b: string) {
  const digest = (v: string) => createHash("sha256").update(v, "utf8").digest();
  return timingSafeEqual(digest(a), digest(b));
}

const hmac = (algorithm: "sha1" | "sha256", key: string, data: string, encoding: "hex" | "base64" = "hex") =>
  createHmac(algorithm, key).update(data, "utf8").digest(encoding);

/** Motivo da recusa, ou null quando o pedido vem mesmo da plataforma. */
function verify(provider: ProviderId, secret: string, request: Request, raw: string): string | null {
  const url = new URL(request.url);
  switch (provider) {
    case "hotmart":
      if (!secret) return "Falta colar o Hottok nas definições da integração.";
      return same(request.headers.get("x-hotmart-hottok") ?? "", secret) ? null : "Hottok inválido.";
    case "kiwify":
      if (!secret) return "Falta colar o token do webhook da Kiwify.";
      return same(url.searchParams.get("signature") ?? "", hmac("sha1", secret, raw))
        ? null
        : "Assinatura da Kiwify inválida.";
    case "eduzz": {
      if (!secret) return "Falta colar a chave de acesso da Eduzz.";
      const signature = request.headers.get("x-signature") ?? "";
      return same(signature, hmac("sha256", secret, raw)) ||
        same(signature, hmac("sha256", secret, raw, "base64"))
        ? null
        : "Assinatura da Eduzz inválida.";
    }
    case "stripe": {
      if (!secret) return "Falta colar o signing secret do Stripe.";
      const parts = (request.headers.get("stripe-signature") ?? "").split(",").map((p) => p.split("="));
      const timestamp = parts.find(([k]) => k === "t")?.[1] ?? "";
      if (!timestamp || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
        return "Assinatura do Stripe em falta ou fora de prazo.";
      }
      const expected = hmac("sha256", secret, `${timestamp}.${raw}`);
      return parts.some(([k, v]) => k === "v1" && v && same(v, expected))
        ? null
        : "Assinatura do Stripe inválida.";
    }
    case "kambafy":
    case "webhook": {
      // Sem segredo, a chave aleatória do endereço é a única credencial.
      if (!secret) return null;
      const sent =
        request.headers.get("x-webhook-secret") ??
        (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      return same(sent, secret) ? null : "Segredo do webhook inválido.";
    }
    default:
      return "Esta integração não recebe vendas.";
  }
}

const STATUS_RANK = { pending: 0, approved: 1, refunded: 2 } as const;

/** Falha nossa: a plataforma guarda o evento e volta a enviar. */
const retryLater = () =>
  new Response("Temporarily unavailable", { status: 503, headers: { "retry-after": "60" } });

/** O resultado de uma chamada à base de dados; um erro nunca passa por "não existe". */
function must<T>(result: { data: T; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
}

export async function receiveIntegrationWebhook(key: string, request: Request): Promise<Response> {
  const found = await supabaseAdmin
    .from("integrations")
    .select("id, organization_id, provider, enabled, secret")
    .eq("endpoint_key", key)
    .maybeSingle();
  if (found.error) {
    console.error(`[webhook] integração por ler: ${found.error.message}`);
    return retryLater();
  }
  const integration = found.data;
  if (!integration) return new Response("Not found", { status: 404 });

  const provider = integration.provider as ProviderId;
  const raw = await request.text();
  // O pedido em bruto só se guarda depois de verificado: fica com o registo do
  // evento, para a venda poder ser reprocessada.
  let payload: string | null = null;
  const log = async (
    status: "accepted" | "rejected" | "ignored",
    reason: string,
    extra: Record<string, unknown> = {},
  ) => {
    const { error } = await supabaseAdmin.from("integration_events").insert({
      organization_id: integration.organization_id,
      integration_id: integration.id,
      provider,
      status,
      reason,
      payload,
      ...extra,
    });
    if (error) console.error(`[webhook] registo por guardar (${status}): ${error.message}`);
  };

  if (raw.length > 256_000) {
    await log("rejected", "Pedido demasiado grande.");
    return new Response("Payload too large", { status: 413 });
  }
  const refused = verify(provider, integration.secret, request, raw);
  if (refused) {
    await log("rejected", refused);
    return new Response("Unauthorized", { status: 401 });
  }
  payload = raw;
  if (!integration.enabled) {
    await log("ignored", "A integração está desligada.");
    return Response.json({ ok: true });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    await log("rejected", "O pedido não vem em JSON.");
    return new Response("Invalid JSON", { status: 400 });
  }

  const event = normalizeEvent(provider, body);
  if (event.kind === "ignore") {
    await log("ignored", event.reason, { event_type: event.eventType });
    return Response.json({ ok: true });
  }
  const summary = {
    event_type: event.eventType,
    buyer_email: event.email,
    product_name: event.product || null,
    amount_value: event.amountValue,
    currency: event.currency,
  };
  // Respondemos 200 para a plataforma não repetir um pedido que nunca vai servir.
  if (!event.email) {
    await log("rejected", "A venda não traz o email do comprador.", summary);
    return Response.json({ ok: false });
  }

  try {
    const existing = event.externalId
      ? must(
          await supabaseAdmin
            .from("real_purchase_events")
            .select("id, status, amount_value, currency, product_name, webinar_id")
            .eq("organization_id", integration.organization_id)
            .eq("provider", provider)
            .eq("external_id", event.externalId)
            .maybeSingle(),
          "venda por ler",
        )
      : null;

    if (existing) {
      // O estado só avança (pendente → aprovada → reembolsada). Um reembolso muitas
      // vezes não traz valor nem produto: muda o estado e preenche o que faltar,
      // sem apagar o que a venda original trouxe nem mudar a atribuição.
      const before = existing.status as keyof typeof STATUS_RANK;
      if (STATUS_RANK[event.status] <= STATUS_RANK[before]) {
        await log("ignored", "Esta venda já estava registada.", { ...summary, purchase_id: existing.id });
        return Response.json({ ok: true });
      }
      must(
        await supabaseAdmin
          .from("real_purchase_events")
          .update({
            status: event.status,
            amount_value: existing.amount_value ?? event.amountValue,
            currency: existing.currency ?? event.currency,
            product_name: existing.product_name || event.product.slice(0, 120),
          })
          .eq("id", existing.id),
        "venda por actualizar",
      );
      await log("accepted", "", { ...summary, purchase_id: existing.id });
      await notifyOutgoing(integration.organization_id, `purchase.${event.status}`, {
        email: event.email,
        external_id: event.externalId,
        provider,
        webinar_id: existing.webinar_id,
      });
      return Response.json({ ok: true });
    }

    // Sem contacto ou sem participações lidas, a venda ficaria solta e mal
    // atribuída: antes disso, devolve-se o pedido à plataforma.
    const contactId = must(
      await supabaseAdmin.rpc("upsert_contact", {
        _organization_id: integration.organization_id,
        _name: event.name,
        _email: event.email,
        _phone: event.phone ?? "",
        _source: "integration",
      }),
      "contacto por guardar",
    );
    // Atribuição, da mais exacta para a mais fraca: o webinar a que a pessoa
    // assistiu cuja oferta aponta para este produto; senão o último que viu.
    const seen = contactId
      ? must(
          await supabaseAdmin
            .from("participants")
            .select("webinar_id, webinars(cta_url)")
            .eq("contact_id", contactId)
            .order("joined_at", { ascending: false })
            .limit(50),
          "participações por ler",
        )
      : null;
    const byOffer = event.productId
      ? seen?.find((p) => p.webinars?.cta_url?.includes(event.productId!))
      : undefined;
    const last = byOffer ?? seen?.[0] ?? null;
    const attribution = byOffer
      ? "Atribuída ao webinar cuja oferta aponta para este produto."
      : last
        ? "Atribuída ao último webinar a que a pessoa assistiu."
        : "Comprador sem participação em webinars.";

    // Dois envios em simultâneo chocam no índice único; a plataforma repete e o
    // segundo pedido cai no ramo "já existe" acima.
    const saved = must(
      await supabaseAdmin
        .from("real_purchase_events")
        .insert({
          organization_id: integration.organization_id,
          webinar_id: last?.webinar_id ?? null,
          contact_id: contactId ?? null,
          buyer_email: event.email,
          buyer_name: (event.name || event.email).slice(0, 80),
          product_name: event.product.slice(0, 120),
          amount: event.amountValue === null ? "" : String(event.amountValue),
          amount_value: event.amountValue,
          currency: event.currency,
          status: event.status,
          provider,
          source: provider,
          external_id: event.externalId,
        })
        .select("id")
        .single(),
      "venda por guardar",
    );

    await Promise.all([
      log("accepted", attribution, { ...summary, purchase_id: saved?.id ?? null }),
      supabaseAdmin
        .from("integrations")
        .update({ last_event_at: new Date().toISOString() })
        .eq("id", integration.id),
    ]);
    if (event.status !== "pending") {
      await notifyOutgoing(integration.organization_id, `purchase.${event.status}`, {
        email: event.email,
        name: event.name,
        product: event.product,
        amount: event.amountValue,
        currency: event.currency,
        provider,
        webinar_id: last?.webinar_id ?? null,
      });
    }
    return Response.json({ ok: true });
  } catch (error) {
    // Nada do que falhou aqui é culpa do pedido: fica o registo e a plataforma repete.
    console.error("[webhook] falha a tratar a venda", error);
    await log("rejected", "Falha temporária do nosso lado. A plataforma vai repetir o envio.", summary);
    return retryLater();
  }
}

/** Endereços internos nunca recebem pedidos do servidor. */
// ponytail: verifica o nome, não o IP resolvido; resolver o DNS se aparecerem nomes a apontar para a rede interna.
function isPublicHost(url: string) {
  const host = new URL(url).hostname.toLowerCase();
  return !(
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.includes(":")
  );
}

/** Webhook de saída da organização, assinado com HMAC-SHA256 no cabeçalho X-Signature. */
export async function notifyOutgoing(organizationId: string, event: string, data: Record<string, unknown>) {
  const { data: hook } = await supabaseAdmin
    .from("integrations")
    .select("enabled, secret, settings")
    .eq("organization_id", organizationId)
    .eq("provider", "outgoing_webhook")
    .maybeSingle();
  const url = (hook?.settings as { url?: string } | null)?.url;
  if (!hook?.enabled || !isHttpUrl(url) || !url.startsWith("https://") || !isPublicHost(url)) return;
  const body = JSON.stringify({ event, sent_at: new Date().toISOString(), data });
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-signature": hmac("sha256", hook.secret, body) },
      body,
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // Um destino lento ou em baixo nunca afecta a sala nem a venda.
  }
}
