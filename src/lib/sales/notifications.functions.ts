/**
 * "Gerar com IA" das notificações de venda simuladas.
 *
 * A IA só escolhe os nomes das pessoas; os momentos são calculados aqui,
 * sempre a partir de 2 minutos depois do início da oferta, respeitando o
 * intervalo configurado. Tudo fica como sugestão até o vendedor aprovar.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SaleNotificationSuggestion = {
  buyerName: string;
  message: string;
  offsetSeconds: number;
};

export type GeneratedSaleNotifications = {
  ok: boolean;
  error?: string;
  usedTranscript: boolean;
  items: SaleNotificationSuggestion[];
};

/** 2 minutos depois do início da oferta. */
const OFFER_DELAY_SECONDS = 120;

const FALLBACK_NAMES = [
  "João",
  "Mariana",
  "Carlos",
  "Ana",
  "Ricardo",
  "Sofia",
  "Bruno",
  "Inês",
  "Tiago",
  "Beatriz",
  "Pedro",
  "Carolina",
  "Miguel",
  "Rita",
  "André",
  "Helena",
];

export const generateSaleNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        webinarId: z.string().uuid(),
        count: z.number().int().min(1).max(40),
        offerStartSeconds: z.number().int().min(0),
        minIntervalSeconds: z.number().int().min(3).max(3600),
        maxIntervalSeconds: z.number().int().min(3).max(7200),
        productName: z.string().trim().max(120),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<GeneratedSaleNotifications> => {
    const supabase = context.supabase as never as any;
    const model = await import("@/lib/ai-agent/model.server");

    const { data: webinar } = await supabase
      .from("webinars")
      .select("title, description")
      .eq("id", data.webinarId)
      .maybeSingle();

    let transcript = "";
    try {
      const engine = await import("@/lib/temporal/engine.server");
      const version = await engine.latestReadyVersion(data.webinarId).catch(() => null);
      transcript = version?.rawText ? version.rawText.slice(0, 6000) : "";
    } catch {
      transcript = "";
    }

    const product = data.productName.trim() || webinar?.title || "o programa";

    const sources = [
      webinar?.title ? `Webinar: ${webinar.title}` : "",
      webinar?.description ? `Descrição: ${webinar.description}` : "",
      transcript ? `Excerto da transcrição:\n${transcript}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    let names: string[] = [];
    const result = await model.askModelJson({
      system:
        'Devolve apenas JSON válido no formato {"names":["",""]}. Nomes próprios portugueses reais e variados (só o primeiro nome, sem apelido), adequados à audiência do webinar. Nada mais.',
      user: `${sources}\n\nGera ${data.count} nomes diferentes de pessoas que poderiam comprar "${product}".`,
    });
    if (result.ok) {
      const parsed = model.parseJsonObject<{ names?: unknown }>(result.text);
      const list = Array.isArray(parsed?.names) ? parsed?.names : [];
      names = (list as unknown[])
        .map((n) => String(n ?? "").trim())
        .filter((n) => n.length > 1 && n.length <= 30);
    }

    if (names.length === 0) {
      return {
        ok: false,
        error: "Não foi possível gerar nomes agora. Tente novamente daqui a pouco.",
        usedTranscript: transcript.length > 0,
        items: [],
      };
    }

    const unique: string[] = [];
    for (const name of [...names, ...FALLBACK_NAMES]) {
      if (unique.length >= data.count) break;
      if (!unique.some((n) => n.toLowerCase() === name.toLowerCase())) unique.push(name);
    }

    const min = Math.max(3, data.minIntervalSeconds);
    const max = Math.max(min, data.maxIntervalSeconds);
    let at = data.offerStartSeconds + OFFER_DELAY_SECONDS;

    const items = unique.map((buyerName, index) => {
      if (index > 0) at += min + Math.round(Math.random() * (max - min));
      return {
        buyerName,
        message: `comprou ${product}`,
        offsetSeconds: at,
      };
    });

    return { ok: true, usedTranscript: transcript.length > 0, items };
  });
