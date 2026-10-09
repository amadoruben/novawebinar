/**
 * Encaminhamento: escolhe a pessoa certa para um caso e explica porquê.
 * Sem pessoa adequada, o caso fica na fila da equipa e o supervisor é avisado.
 */
import { staffStatusLabel, type StaffStatus } from "./model";

export type Candidate = {
  id: string;
  name: string;
  departmentId: string | null;
  skills: string[];
  channels: string[];
  /** Estado já com a presença aplicada (ver `effectiveStatus`). */
  status: StaffStatus;
  capacity: number;
  openCases: number;
  active: boolean;
  lastAssignedAt: string | null;
};

export type RoutingResult = {
  staffId: string | null;
  reason: string;
  /** 1 é o melhor encaixe; null quando ficou na fila. */
  tier: number | null;
};

const list = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;

export function chooseStaff(input: {
  candidates: Candidate[];
  departmentId: string | null;
  requiredSkills: string[];
  channel: string;
  /** Quem tratou deste contacto da última vez. */
  preferredStaffId?: string | null | undefined;
  departmentName?: string | undefined;
  skillNames?: Record<string, string> | undefined;
}): RoutingResult {
  const { departmentId, requiredSkills: required } = input;
  const team = input.departmentName;
  const department = team ? `equipa ${team}` : "a equipa";
  const skillName = (slug: string) => input.skillNames?.[slug] ?? slug;
  const queue = (why: string): RoutingResult => ({
    staffId: null,
    tier: null,
    reason: `Na fila da equipa${team ? ` ${team}` : ""}: ${why}`,
  });

  const active = input.candidates.filter((c) => c.active);
  if (active.length === 0) return queue("ainda não há pessoas registadas.");
  const present = active.filter((c) => c.status === "available" || c.status === "online");
  if (present.length === 0) return queue("ninguém está disponível neste momento.");
  const onChannel = present.filter((c) => c.channels.includes(input.channel));
  if (onChannel.length === 0) return queue("ninguém disponível atende este canal.");
  const free = onChannel.filter((c) => c.openCases < c.capacity);
  if (free.length === 0) return queue("quem está disponível já tem a capacidade cheia.");

  const solo = active.length === 1;
  const ranked = free
    .map((c) => {
      const matched = required.filter((s) => c.skills.includes(s));
      const all = required.length > 0 && matched.length === required.length;
      const inDepartment = departmentId !== null && c.departmentId === departmentId;
      let tier: number | null = null;
      let fit = "";
      if (inDepartment && (all || required.length === 0)) {
        tier = 1;
        fit = all
          ? `${department} e todas as competências (${list(matched.map(skillName))})`
          : department;
      } else if (all) {
        tier = 2;
        fit = `todas as competências (${list(matched.map(skillName))})`;
      } else if (inDepartment && matched.length > 0) {
        tier = 3;
        fit = `${department} e ${list(matched.map(skillName))}`;
      } else if (inDepartment) {
        tier = 4;
        fit = department;
      } else if (matched.length > 0) {
        tier = 5;
        fit = list(matched.map(skillName));
      } else if (solo) {
        tier = 6;
        fit = "é a única pessoa da equipa";
      }
      return { c, tier, fit };
    })
    .filter((row): row is { c: Candidate; tier: number; fit: string } => row.tier !== null);

  if (ranked.length === 0) {
    return queue(
      required.length > 0
        ? `ninguém disponível tem ${list(required.map(skillName))}.`
        : "ninguém disponível pertence a esta equipa.",
    );
  }

  ranked.sort(
    (a, b) =>
      a.tier - b.tier ||
      Number(b.c.id === input.preferredStaffId) - Number(a.c.id === input.preferredStaffId) ||
      Number(b.c.status === "available") - Number(a.c.status === "available") ||
      a.c.openCases / a.c.capacity - b.c.openCases / b.c.capacity ||
      (a.c.lastAssignedAt ?? "").localeCompare(b.c.lastAssignedAt ?? "") ||
      a.c.id.localeCompare(b.c.id),
  );

  const [best] = ranked;
  if (!best) return queue("ninguém disponível.");
  const parts = [
    best.fit,
    best.c.id === input.preferredStaffId ? "já atendeu este contacto" : "",
    `${best.c.openCases} de ${best.c.capacity} casos`,
    staffStatusLabel(best.c.status).toLowerCase(),
  ].filter(Boolean);
  return { staffId: best.c.id, tier: best.tier, reason: `${best.c.name}: ${parts.join("; ")}.` };
}

/**
 * O motivo do encaminhamento como se lê hoje. Os casos antigos guardaram
 * «departamento» (a base ainda escreve «Na fila do departamento» ao transferir).
 */
export function routingReasonLabel(reason: string) {
  return reason
    .replace(/Na fila d[oe] departamento/g, "Na fila da equipa")
    .replace(/Na fila de ([^:]+):/g, "Na fila da equipa $1:")
    .replace("pertence a este departamento", "pertence a esta equipa")
    .replace("ainda não há funcionários registados", "ainda não há pessoas registadas");
}

/** O que o agente diz por omissão ao passar a conversa (o mesmo texto do passo Agente). */
export const HANDOFF_DEFAULT = "Vou chamar alguém da equipa para confirmar isso para si.";

/**
 * A frase com que o agente termina a sua parte: a mensagem da organização e,
 * quando se sabe, quem continua o atendimento (a pessoa e a equipa).
 */
export function handoffMessage(
  base: string,
  next: { team?: string | null | undefined; person?: string | null | undefined },
) {
  const text = base.trim();
  const person = (next.person ?? "").trim().split(/\s+/)[0] ?? "";
  const team = (next.team ?? "").trim();
  const who =
    person && team ? `${person}, da equipa ${team}` : person || (team ? `a equipa ${team}` : "");
  if (!who) return text;
  return [text, `Quem continua: ${who}.`].filter(Boolean).join(" ");
}
