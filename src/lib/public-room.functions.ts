import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { sessionWindow } from "@/lib/schedule";

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
});

const watchedSchema = z.object({
  participantId: z.string().uuid(),
  watchedSeconds: z
    .number()
    .int()
    .min(0)
    .max(60 * 60 * 24),
});

export const getPublicRoom = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => slugSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: webinar } = await supabaseAdmin
      .from("webinars")
      .select(
        "id, organization_id, public_title, description, status, room_theme, host_name, host_role, host_avatar_url, chat_pin_title, chat_pin_message, offer_pin_title, offer_pin_message, scheduled_at, session_end_time, schedule_mode, recurrence_enabled, recurrence_pattern, recurrence_weekday, recurrence_start_time, recurrence_end_time, jit_interval_minutes, timezone, duration_seconds, replay_enabled, waiting_room_enabled, prelive_enabled, prelive_seconds, prelive_sound, prelive_message, prelive_template, prelive_appearance, easy_access, sync_video_with_start, cta_text, cta_url, cta_color, cta_price_original, cta_price_now, cta_image_url, cta_countdown_seconds, cta_start_seconds, cta_end_seconds, registration_headline, registration_subtitle, registration_button_text, registration_collect_phone, registration_require_phone, registration_cover_url, registration_badge_text, registration_progress_enabled, registration_progress_value, registration_scarcity_note, share_title, share_description, share_image_url, video_sources(source_url, provider, duration_seconds)",
      )
      .eq("slug", data.slug)
      .maybeSingle();

    if (!webinar) return null;

    const [{ data: comments }, { data: audience }, { data: socialProof }, { data: simulated }] =
      await Promise.all([
        supabaseAdmin
          .from("scheduled_comments")
          .select("id, author_name, avatar_url, message, offset_seconds, created_at")
          .eq("webinar_id", webinar.id)
          .order("offset_seconds", { ascending: true }),
        supabaseAdmin
          .from("audience_configuration")
          .select("mode, curve")
          .eq("webinar_id", webinar.id)
          .maybeSingle(),
        supabaseAdmin
          .from("social_proof_settings")
          .select(
            "enabled, product_name, start_mode, start_delay_seconds, start_seconds, end_seconds, min_interval_seconds, max_interval_seconds, position, display_seconds, animation, sound_enabled, notification_color",
          )
          .eq("webinar_id", webinar.id)
          .maybeSingle(),
        supabaseAdmin
          .from("simulated_purchase_events")
          .select("id, buyer_name, product_name, message, offset_seconds")
          .eq("webinar_id", webinar.id)
          .order("offset_seconds", { ascending: true }),
      ]);

    const source = webinar.video_sources;
    const duration = source?.duration_seconds || webinar.duration_seconds;
    const session = sessionWindow({ ...webinar, duration_seconds: duration });

    return {
      webinar: {
        id: webinar.id,
        organization_id: webinar.organization_id,
        public_title: webinar.public_title,
        description: webinar.description,
        host_name: webinar.host_name ?? "",
        host_role: webinar.host_role ?? "",
        host_avatar_url: webinar.host_avatar_url ?? "",
        chat_pin_title: webinar.chat_pin_title ?? "",
        chat_pin_message: webinar.chat_pin_message ?? "",
        offer_pin_title: webinar.offer_pin_title ?? "",
        offer_pin_message: webinar.offer_pin_message ?? "",
        status: webinar.status,
        room_theme: webinar.room_theme === "light" ? "light" : "dark",
        scheduled_at: webinar.scheduled_at,
        session_start: session.startMs ? new Date(session.startMs).toISOString() : null,
        session_end: session.endMs ? new Date(session.endMs).toISOString() : null,
        session_ended: session.endedMs ? new Date(session.endedMs).toISOString() : null,
        waiting_open: session.waitingOpen,
        schedule_mode: webinar.schedule_mode,
        recurrence_enabled: webinar.recurrence_enabled,
        timezone: webinar.timezone,
        duration_seconds: duration,
        replay_enabled: webinar.replay_enabled,
        waiting_room_enabled: webinar.waiting_room_enabled,
        prelive_enabled: webinar.prelive_enabled,
        prelive_seconds: webinar.prelive_seconds,
        prelive_sound: webinar.prelive_sound,
        prelive_message: webinar.prelive_message,
        prelive_template: webinar.prelive_template,
        prelive_appearance: webinar.prelive_appearance,
        easy_access: webinar.easy_access,
        sync_video_with_start: webinar.sync_video_with_start,
        cta_text: webinar.cta_text,
        cta_url: webinar.cta_url,
        cta_color: webinar.cta_color,
        cta_price_original: webinar.cta_price_original,
        cta_price_now: webinar.cta_price_now,
        cta_image_url: webinar.cta_image_url,
        cta_countdown_seconds: webinar.cta_countdown_seconds,
        cta_start_seconds: webinar.cta_start_seconds,
        cta_end_seconds: webinar.cta_end_seconds,
        registration_headline: webinar.registration_headline,
        registration_subtitle: webinar.registration_subtitle,
        registration_button_text: webinar.registration_button_text,
        registration_collect_phone: webinar.registration_collect_phone,
        registration_require_phone: webinar.registration_require_phone,
        registration_cover_url: webinar.registration_cover_url,
        registration_badge_text: webinar.registration_badge_text,
        registration_progress_enabled: webinar.registration_progress_enabled,
        registration_progress_value: webinar.registration_progress_value,
        registration_scarcity_note: webinar.registration_scarcity_note,
        share_title: webinar.share_title,
        share_description: webinar.share_description,
        share_image_url: webinar.share_image_url,
        video_url: source?.source_url ?? null,
        video_provider: source?.provider ?? null,
      },
      comments: comments ?? [],
      audience: { mode: audience?.mode ?? "simulated", curve: audience?.curve ?? [] },
      socialProof: socialProof ?? null,
      simulatedPurchases: simulated ?? [],
    };
  });

/**
 * Envia o aviso para o endereço configurado na integração WebHook.
 * Falhas nunca interrompem a experiência do participante.
 */
async function notifyWebhook(
  url: string | null | undefined,
  enabled: boolean | null | undefined,
  payload: Record<string, unknown>,
) {
  const endpoint = (url ?? "").trim();
  if (!enabled || !/^https?:\/\//i.test(endpoint)) return;
  try {
    await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, sent_at: new Date().toISOString() }),
    });
  } catch {
    // ignorado de propósito
  }
}

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
      })
      .select("id, name")
      .single();

    if (error) throw new Error("Não foi possível entrar na sala.");

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

    return { participantId: participant.id, name: participant.name };
  });

export const sendPublicRoomMessage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => messageSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: participant } = await supabaseAdmin
      .from("participants")
      .select("id, name, webinar_id, organization_id")
      .eq("id", data.participantId)
      .maybeSingle();
    if (!participant) throw new Error("Participante desconhecido.");

    const { data: existing } = await supabaseAdmin
      .from("private_conversations")
      .select("id")
      .eq("participant_id", participant.id)
      .maybeSingle();

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
    }

    const { error: messageError } = await supabaseAdmin.from("private_messages").insert({
      conversation_id: conversationId,
      organization_id: participant.organization_id,
      participant_id: participant.id,
      sender_kind: "participant",
      body: data.body,
    });
    if (messageError) throw new Error("Não foi possível enviar a mensagem.");

    await supabaseAdmin
      .from("private_conversations")
      .update({ last_message_at: new Date().toISOString(), status: "waiting" })
      .eq("id", conversationId);

    // Agente IA: usa o relógio real do participante (live ou replay). Uma
    // falha aqui nunca pode perder a mensagem — fica para a equipa humana.
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
      await supabaseAdmin
        .from("private_conversations")
        .update({ needs_human: true, escalation_reason: "Problema técnico do assistente" })
        .eq("id", conversationId);
    }

    return { ok: true };
  });

export const trackPublicRoomCta = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ctaSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: participant } = await supabaseAdmin
      .from("participants")
      .select("id, name, email, webinar_id, organization_id")
      .eq("id", data.participantId)
      .maybeSingle();
    if (!participant) return { ok: false };

    await supabaseAdmin.from("cta_events").insert({
      organization_id: participant.organization_id,
      webinar_id: participant.webinar_id,
      participant_id: participant.id,
      event_type: data.eventType,
    });

    if (data.eventType === "click") {
      await supabaseAdmin
        .from("participants")
        .update({ cta_clicked: true })
        .eq("id", participant.id);

      const { data: webinar } = await supabaseAdmin
        .from("webinars")
        .select("public_title, webhook_url, webhook_enabled")
        .eq("id", participant.webinar_id)
        .maybeSingle();

      await notifyWebhook(webinar?.webhook_url, webinar?.webhook_enabled, {
        event: "cta_click",
        webinar_id: participant.webinar_id,
        webinar: webinar?.public_title ?? null,
        participant_id: participant.id,
        name: participant.name,
        email: participant.email,
      });
    }


    return { ok: true };
  });

export const trackPublicRoomProgress = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => watchedSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("participants")
      .update({ watched_seconds: data.watchedSeconds })
      .eq("id", data.participantId);
    return { ok: true };
  });

/** Mensagens privadas de um participante, incluindo as respostas da equipa de suporte. */
export const getPublicRoomMessages = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ participantId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: messages } = await supabaseAdmin
      .from("private_messages")
      .select("id, body, sender_kind, created_at")
      .eq("participant_id", data.participantId)
      .order("created_at", { ascending: true })
      .limit(200);

    return { messages: messages ?? [] };
  });
