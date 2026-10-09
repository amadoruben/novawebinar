import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Os corações da sala, para o Painel os contar. A sala junta os toques de cada pessoa e grava um
 * registo de 30 em 30 segundos (com o progresso), nunca um pedido por toque: em analytics_events,
 * `event_name` «hearts», com a contagem em `properties.count`.
 * ponytail: o tecto por envio (500) trava enganos, não abuso; quem forjar envios só infla os seus.
 */
export const HEARTS_EVENT = "hearts";

let heartsLimiter: import("@/lib/registration").RateLimiter | undefined;

const heartsSchema = z.object({
  token: z.string().min(10).max(200),
  count: z.number().int().min(1).max(500),
  videoSecond: z.number().int().min(0).max(86_400).optional(),
});

export const recordRoomHearts = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => heartsSchema.parse(data))
  .handler(async ({ data }) => {
    const { participantFromToken } = await import("@/lib/public-room.server");
    const { VIEWER_EXPIRED } = await import("@/lib/public-room.functions");
    const participantId = participantFromToken(data.token);
    if (!participantId) throw new Error(VIEWER_EXPIRED);
    // A sala envia no máximo um registo a cada 30 s (mais ao esconder a página): mais do que isso é um
    // ciclo a encher analytics_events. Recusado, a sala guarda os corações e manda-os no sinal seguinte.
    // ponytail: memória de cada instância da função; chega para travar um ciclo, não um ataque distribuído.
    const { RateLimiter } = await import("@/lib/registration");
    heartsLimiter ??= new RateLimiter(10, 60_000);
    if (!heartsLimiter.allow(participantId)) throw new Error("Demasiados envios seguidos.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: person } = await supabaseAdmin
      .from("participants")
      .select("organization_id, webinar_id, email")
      .eq("id", participantId)
      .maybeSingle();
    if (!person) throw new Error(VIEWER_EXPIRED);
    const { error } = await supabaseAdmin.from("analytics_events").insert({
      organization_id: person.organization_id,
      webinar_id: person.webinar_id,
      participant_id: participantId,
      event_name: HEARTS_EVENT,
      video_second: data.videoSecond ?? null,
      properties: { count: data.count },
      // A sala de teste entra como «teste-…@sala.local»: os corações dela não contam.
      is_real: !/^teste-.*@sala\.local$/i.test(person.email ?? ""),
    });
    // A sala volta a enviar estes corações no próximo sinal.
    if (error) throw new Error("Não foi possível guardar as reacções.");
    return { ok: true };
  });
