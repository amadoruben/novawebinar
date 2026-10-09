/**
 * O comentário da equipa como viaja pelo canal da sala, e o texto que o servidor assina: igual no
 * servidor (room-team.server) e no browser (room-team), que confirma a assinatura sem chamar o servidor.
 */

export type TeamRole = "equipa" | "apresentador";
export type TeamMessage = { id: string; name: string; role: TeamRole; text: string; at: number };
export type TeamWire = { message: TeamMessage; sig: string };

/** Um comentário assinado só vale estes minutos: um comentário antigo reenviado não volta a aparecer. */
export const TEAM_FRESH_MS = 15 * 60_000;

// Em JSON, para o nome e o texto não se poderem trocar de lugar à volta de um «:».
export const teamMessageSubject = (webinarId: string, m: TeamMessage) =>
  JSON.stringify(["room-team-msg", webinarId, m.id, m.at, m.role, m.name, m.text]);

/**
 * O que chega pelo canal tem a forma de um comentário da equipa recente (antes de ver a assinatura)?
 * O resto deita-se fora logo, sem gastar verificações.
 */
export function teamWireOk(wire: unknown, nowMs = Date.now()): wire is TeamWire {
  const w = wire as Partial<TeamWire> | null;
  const m = w?.message as Partial<TeamMessage> | undefined;
  return (
    typeof w?.sig === "string" &&
    /^[\w-]{86}$/.test(w.sig) &&
    typeof m?.id === "string" &&
    m.id.length > 0 &&
    m.id.length <= 64 &&
    typeof m.name === "string" &&
    m.name.trim().length > 0 &&
    m.name.length <= 40 &&
    (m.role === "equipa" || m.role === "apresentador") &&
    typeof m.text === "string" &&
    m.text.trim().length > 0 &&
    m.text.length <= 200 &&
    Number.isInteger(m.at) &&
    Math.abs(nowMs - m.at!) <= TEAM_FRESH_MS
  );
}

/** Confirmações pedidas ao servidor por minuto, em cada sala (só nos browsers sem Ed25519). */
export const TEAM_CHECKS_PER_MINUTE = 30;

/**
 * A vez seguinte do servidor: até 20 de cada vez e 30 por minuto. Nada se perde: o que não cabe fica
 * em `rest` e volta a tentar-se em `wait` ms (quando a janela de um minuto liberta lugar).
 */
export function teamBatch(queue: readonly TeamWire[], checked: readonly number[], now: number) {
  const recent = checked.filter((t) => now - t <= 60_000);
  const fresh = queue.filter((w) => teamWireOk(w, now));
  const take = Math.max(0, Math.min(20, TEAM_CHECKS_PER_MINUTE - recent.length));
  const batch = fresh.slice(0, take);
  const rest = fresh.slice(take);
  const wait = rest.length ? (batch.length ? 300 : recent[0]! + 60_000 - now + 50) : null;
  return { batch, rest, recent, wait };
}
