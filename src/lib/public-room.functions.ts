import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Funções públicas da sala. São chamadas por visitantes sem sessão, por isso
 * validam sempre a entrada e devolvem apenas os campos que o público precisa.
 */

const slugSchema = z.object({
  slug: z.string().trim().min(1).max(120),
});

const joinSchema = z.object({
  webinarId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(40).optional(),
  mode: z.enum(["live", "replay"]).default("live"),
  // Entrada pela sala de teste: aberta mesmo com a sessão inativa e sem
  // disparar avisos para sistemas externos.
  teste: z.boolean().optional(),
  device: z.enum(["mobile", "desktop"]).optional(),
  city: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  countryCode: z.string().trim().max(8).optional(),
  // Origem do lead (UTM, anúncios ou página de onde veio), calculada no browser.
  utmSource: z.string().trim().toLowerCase().max(120).optional(),
  utmMedium: z.string().trim().toLowerCase().max(120).optional(),
  utmCampaign: z.string().trim().max(120).optional(),
  utmContent: z.string().trim().max(120).optional(),
  referrer: z.string().trim().max(200).optional(),
});

const messageSchema = z.object({
  participantId: z.string().uuid(),
  body: z.string().trim().min(1).max(1000),
  /** Instante real do participante no vídeo (live ou replay), em segundos. */
  sessionSeconds: z.number().int().nonnegative().optional(),
});

const ctaSchema = z.object({
  participantId: z.string().uuid(),
  eventType: z.enum(["view", "click"]),
  /** Segundo do vídeo em que a pessoa viu ou clicou na oferta. */
  videoSecond: z
    .number()
    .int()
    .min(0)
    .max(60 * 60 * 24)
    .optional(),
});

const watchedSchema = z.object({
  participantId: z.string().uuid(),
  watchedSeconds: z
    .number()
    .int()
    .min(0)
    .max(60 * 60 * 24),
});

const UNAVAILABLE = "Serviço temporariamente indisponível. Tente novamente.";

export const getPublicRoom = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => slugSchema.parse(data))
  .handler(async ({ data }) => {
    const { loadPublicRoom } = await import("@/lib/public-room.server");
    return loadPublicRoom(data.slug);
  });

/** Deduz dispositivo e localização a partir do pedido quando o navegador não os envia. */
async function requestAudienceMeta(): Promise<{
  device: "mobile" | "desktop" | null;
  city: string | null;
  country: string | null;
  countryCode: string | null;
}> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const headers = getRequest().headers;
    const ua = headers.get("user-agent") ?? "";
    const mobileHint = headers.get("sec-ch-ua-mobile");
    const isMobile =
      mobileHint === "?1" || /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(ua);
    const code = (headers.get("cf-ipcountry") ?? headers.get("x-vercel-ip-country") ?? "")
      .trim()
      .toUpperCase();
    const rawCity =
      headers.get("cf-ipcity") ?? headers.get("x-vercel-ip-city") ?? headers.get("x-geo-city");
    const city = rawCity ? decodeURIComponent(rawCity).trim() : "";
    return {
      device: ua ? (isMobile ? "mobile" : "desktop") : null,
      city: city || null,
      country: code && code !== "XX" ? countryNameFromIso(code) : null,
      countryCode: code && code !== "XX" ? code : null,
    };
  } catch {
    return { device: null, city: null, country: null, countryCode: null };
  }
}

/** Nome do país a partir do código ISO, com recurso ao próprio código. */
function countryNameFromIso(code: string): string {
  try {
    const dn = new Intl.DisplayNames(["pt-PT"], { type: "region" });
    return dn.of(code) ?? code;
  } catch {
    return code;
  }
}

export const joinPublicRoom = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => joinSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const fallback = await requestAudienceMeta();

    const { data: webinar } = await supabaseAdmin
      .from("webinars")
      .select("id, organization_id, status, public_title, webhook_url, webhook_enabled")
      .eq("id", data.webinarId)
      .maybeSingle();
    if (!webinar) throw new Error("Webinar indisponível.");
    if (webinar.status === "draft" && !data.teste) throw new Error("Webinar indisponível.");

    const { data: participant, error } = await supabaseAdmin
      .from("participants")
      .insert({
        webinar_id: webinar.id,
        organization_id: webinar.organization_id,
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        viewing_mode: data.mode,
        device: data.device ?? fallback.device,
        city: data.city ?? fallback.city,
        country: data.country ?? fallback.country,
        country_code: data.countryCode ?? fallback.countryCode,
        utm_source: data.utmSource ?? null,
        utm_medium: data.utmMedium ?? null,
        utm_campaign: data.utmCampaign ?? null,
        utm_content: data.utmContent ?? null,
        referrer: data.referrer ?? null,
      })
      .select("id, name")
      .single();

    if (error) throw new Error("Não foi possível entrar na sala.");

    const { notifyWebhook } = await import("@/lib/public-room.server");
    await notifyWebhook(webinar.webhook_url, data.teste ? false : webinar.webhook_enabled, {
      event: "registration",
      webinar_id: webinar.id,
      webinar: webinar.public_title,
      participant_id: participant.id,
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      mode: data.mode,
    });
    if (!data.teste && !data.email.endsWith("@sala.local")) {
      const { notifyOutgoing } = await import("@/lib/integrations.server");
      await notifyOutgoing(webinar.organization_id, "contact.registered", {
        webinar_id: webinar.id,
        webinar: webinar.public_title,
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        mode: data.mode,
        utm_source: data.utmSource ?? null,
        utm_campaign: data.utmCampaign ?? null,
      });
    }

    return { participantId: participant.id, name: participant.name };
  });

export const sendPublicRoomMessage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => messageSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: participant, error: participantError } = await supabaseAdmin
      .from("participants")
      .select("id, name, webinar_id, organization_id")
      .eq("id", data.participantId)
      .maybeSingle();
    if (participantError) throw new Error(UNAVAILABLE);
    if (!participant) throw new Error("Participante desconhecido.");

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("private_conversations")
      .select("id")
      .eq("participant_id", participant.id)
      .maybeSingle();
    // Sem saber se a conversa existe, não se abre outra.
    if (existingError) throw new Error(UNAVAILABLE);

    let conversationId = existing?.id ?? null;
    if (!conversationId) {
      const { data: created, error } = await supabaseAdmin
        .from("private_conversations")
        .insert({
          organization_id: participant.organization_id,
          webinar_id: participant.webinar_id,
          participant_id: participant.id,
        })
        .select("id")
        .single();
      if (error) throw new Error("Não foi possível abrir a conversa.");
      conversationId = created.id;
      await supabaseAdmin.rpc("support_log_conversation_event", {
        _conversation_id: created.id,
        _name: "conversation_created",
        _actor_kind: "contact",
        _data: { channel: "webinar_chat" },
      });
    }

    const { error: messageError } = await supabaseAdmin.from("private_messages").insert({
      conversation_id: conversationId,
      organization_id: participant.organization_id,
      participant_id: participant.id,
      sender_kind: "participant",
      body: data.body,
      video_second: data.sessionSeconds ?? null,
    });
    if (messageError) throw new Error("Não foi possível enviar a mensagem.");

    await supabaseAdmin
      .from("private_conversations")
      .update({ last_message_at: new Date().toISOString(), status: "waiting" })
      .eq("id", conversationId);

    // Agente IA: usa o relógio real do participante (live ou replay). Uma
    // falha aqui nunca pode perder a mensagem — vira caso para a equipa.
    try {
      const { handleParticipantMessage } = await import("@/lib/ai-agent/respond.server");
      await handleParticipantMessage({
        webinarId: participant.webinar_id,
        organizationId: participant.organization_id,
        conversationId: conversationId!,
        participantId: participant.id,
        participantName: participant.name ?? null,
        text: data.body,
        sessionMs: Math.max(0, (data.sessionSeconds ?? 0) * 1000),
      });
    } catch {
      try {
        const { escalateToCase } = await import("@/lib/support/cases.server");
        await escalateToCase({
          organizationId: participant.organization_id,
          conversationId: conversationId!,
          participantId: participant.id,
          webinarId: participant.webinar_id,
          text: data.body,
          actor: "system",
          reason: "Problema técnico do assistente",
        });
      } catch {
        // Último recurso: a conversa fica marcada para a equipa, mesmo sem caso.
        await supabaseAdmin
          .from("private_conversations")
          .update({ needs_human: true, escalation_reason: "Problema técnico do assistente" })
          .eq("id", conversationId);
      }
    }

    return { ok: true };
  });

export const trackPublicRoomCta = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ctaSchema.parse(data))
  .handler(async ({ data }) => {
    const { recordCta } = await import("@/lib/public-room.server");
    return recordCta(data);
  });

export const trackPublicRoomProgress = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => watchedSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Só avança: um envio atrasado ou fora de ordem nunca apaga progresso.
    const { error } = await supabaseAdmin
      .from("participants")
      .update({ watched_seconds: data.watchedSeconds })
      .eq("id", data.participantId)
      .lt("watched_seconds", data.watchedSeconds);
    // A sala volta a enviar este progresso no próximo avanço.
    if (error) throw new Error(UNAVAILABLE);
    return { ok: true };
  });

/** Mensagens privadas de um participante, incluindo as respostas da equipa de suporte. */
export const getPublicRoomMessages = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ participantId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { loadRoomMessages } = await import("@/lib/public-room.server");
    return loadRoomMessages(data.participantId);
  });
