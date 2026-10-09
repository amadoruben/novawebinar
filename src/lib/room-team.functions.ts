import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertWebinarAccess, requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * A equipa na sala (ver room-team.server). O link de equipa pede sessão iniciada na organização; com ele,
 * quem entra assina cada comentário no servidor antes de o enviar pelo canal da sala, e cada sala
 * confirma a assinatura (no browser, com a chave pública) antes de o mostrar.
 */

const webinarId = z.string().uuid();
const token = z.string().min(10).max(200);
const message = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(40),
  role: z.enum(["equipa", "apresentador"]),
  text: z.string().trim().min(1).max(200),
  at: z.number().int().positive(),
});

/** O link de equipa, para quem tem sessão iniciada na organização do webinar. */
export const getTeamRoomToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ webinarId }).parse(data))
  .handler(async ({ data, context }) => {
    await assertWebinarAccess(context.supabase, data.webinarId);
    const { teamToken } = await import("@/lib/room-team.server");
    return { token: teamToken(data.webinarId) };
  });

/** Confirma um link de equipa antes de mostrar a entrada. */
export const checkTeamRoomToken = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ webinarId, token }).parse(data))
  .handler(async ({ data }) => {
    const { isTeamToken } = await import("@/lib/room-team.server");
    return { ok: isTeamToken(data.webinarId, data.token) };
  });

/** Assina um comentário da equipa; a hora é a do servidor. */
export const signTeamRoomMessage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ webinarId, token, message: message.omit({ at: true }) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { isTeamToken, signTeamMessage } = await import("@/lib/room-team.server");
    if (!isTeamToken(data.webinarId, data.token)) throw new Error("O link de equipa não é válido.");
    const signed = { ...data.message, at: Date.now() };
    return { message: signed, sig: signTeamMessage(data.webinarId, signed) };
  });

/** A chave pública com que cada sala confirma, no browser, os comentários da equipa. */
export const getTeamRoomKey = createServerFn({ method: "GET" }).handler(async () => {
  const { teamPublicKey } = await import("@/lib/room-team.server");
  return { key: teamPublicKey() };
});

/**
 * Quais destes comentários são mesmo da equipa (a sala só mostra esses). Só para os browsers sem Ed25519
 * no WebCrypto; os outros confirmam sozinhos.
 * ponytail: sem limite global; cada espectador faz no máximo 30 por minuto (room-team).
 */
export const verifyTeamRoomMessages = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({ webinarId, items: z.array(z.object({ message, sig: z.string().max(100) })).max(20) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { isTeamMessage } = await import("@/lib/room-team.server");
    return { ok: data.items.filter((item) => isTeamMessage(data.webinarId, item.message, item.sig)).map((item) => item.message.id) };
  });
