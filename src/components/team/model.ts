/**
 * Equipas: o resumo do agente e as pessoas arrumadas por equipa.
 * Só contas sobre o que já está na base (`ai_agents`, `support_departments`,
 * `support_staff`, `support_routing_rules`); nada é inventado.
 */
import { defaultPermissions, PERMISSIONS } from "@/lib/ai-agent/defaults";
import { INTENTS, intentLabel } from "@/lib/support/model";
import { HANDOFF_DEFAULT } from "@/lib/support/routing";

/** Os nomes dos modos no ecrã (os mesmos do passo Agente do editor). */
export const MODE_LABEL: Record<string, string> = {
  copiloto: "Sugere",
  hibrido: "Controlo",
  automatico: "Automático",
};

/** Uma linha de `ai_agents`, com o nome do webinar (null = agente da conta, migração 0073). */
export type AgentRowLite = {
  webinar_id: string | null;
  webinar_name?: string | null;
  agent_name: string;
  enabled: boolean;
  mode: string;
  permissions: unknown;
  escalation: unknown;
  updated_at: string;
  /** Só existe com a 0073: «account» quer dizer que o webinar segue o agente da conta. */
  scope?: string | null;
};

export type AgentWebinar = { id: string | null; name: string; on: boolean };

export type AgentSummary = {
  name: string;
  /** none: nunca foi aberto em nenhum webinar. */
  state: "on" | "off" | "none";
  modes: string[];
  webinars: AgentWebinar[];
  /** O que pode fazer (sem risco) e o que pode fazer com risco, nos webinars em que está ligado. */
  does: string[];
  risky: string[];
  handoffMessage: string;
};

const isOn = (row: AgentRowLite) => row.enabled && row.mode !== "desativado";

export function summarizeAgents(rows: AgentRowLite[]): AgentSummary {
  const account = rows.find((r) => r.webinar_id === null) ?? null;
  // Um webinar com «Todos os webinars» segue o agente da conta.
  const effective = (row: AgentRowLite) => (row.scope === "account" && account ? account : row);
  const webinars: AgentWebinar[] = rows
    .filter((r) => r.webinar_id !== null)
    .map((r) => ({ id: r.webinar_id, name: r.webinar_name || "Webinar sem nome", on: isOn(effective(r)) }));
  if (account) webinars.unshift({ id: null, name: "Todos os webinars", on: isOn(account) });

  const live = rows.map(effective).filter(isOn);
  const pool = live.length ? live : rows;
  const latest = [...pool].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];

  const allowed = new Set<string>();
  for (const row of pool) {
    const perms = { ...defaultPermissions(), ...((row.permissions ?? {}) as Record<string, boolean>) };
    for (const [id, on] of Object.entries(perms)) if (on) allowed.add(id);
  }
  const escalation = (latest?.escalation ?? {}) as { message?: string | null };

  return {
    name: latest?.agent_name?.trim() || "Agente IA",
    state: rows.length === 0 ? "none" : live.length ? "on" : "off",
    modes: Object.keys(MODE_LABEL)
      .filter((mode) => live.some((r) => r.mode === mode))
      .map((mode) => MODE_LABEL[mode]!),
    webinars,
    does: PERMISSIONS.filter((p) => !p.risky && allowed.has(p.id)).map((p) => p.label),
    risky: PERMISSIONS.filter((p) => p.risky && allowed.has(p.id)).map((p) => p.label),
    handoffMessage: escalation.message?.trim() || HANDOFF_DEFAULT,
  };
}

export type TeamLite = { id: string; name: string; isFallback: boolean };
export type RuleLite = { intent: string; teamId: string | null; slaMinutes: number; alwaysHuman: boolean };

export type TeamRoute = { team: TeamLite; intents: string[]; slaMinutes: number | null };

const intentOrder = (id: string) => {
  const i = INTENTS.findIndex((x) => x.id === id);
  return i < 0 ? INTENTS.length : i;
};

/**
 * A quem o agente passa cada tema: a regra aponta a equipa; sem equipa, vai para a que
 * «recebe o resto». Sem essa equipa, fica na fila (`queue`).
 */
export function agentRoutes(teams: TeamLite[], rules: RuleLite[]) {
  const fallback = teams.find((t) => t.isFallback) ?? null;
  const sorted = [...rules].sort((a, b) => intentOrder(a.intent) - intentOrder(b.intent));
  const target = (r: RuleLite) =>
    r.teamId && teams.some((t) => t.id === r.teamId) ? r.teamId : (fallback?.id ?? null);
  const routes: TeamRoute[] = teams.map((team) => {
    const mine = sorted.filter((r) => target(r) === team.id);
    return {
      team,
      intents: mine.map((r) => intentLabel(r.intent)),
      slaMinutes: mine.length ? Math.min(...mine.map((r) => r.slaMinutes)) : null,
    };
  });
  return {
    routes,
    queue: sorted.filter((r) => target(r) === null).map((r) => intentLabel(r.intent)),
    alwaysHuman: sorted.filter((r) => r.alwaysHuman).map((r) => intentLabel(r.intent)),
  };
}

/** As pessoas por equipa, pela ordem das equipas; depois quem não tem equipa e quem está inactivo. */
export function groupByTeam<P extends { teamId: string | null; active: boolean }>(people: P[], teams: TeamLite[]) {
  const known = new Set(teams.map((t) => t.id));
  const groups: { key: string; team: TeamLite | null; label: string; people: P[] }[] = teams.map((team) => ({
    key: team.id,
    team,
    label: team.name,
    people: people.filter((p) => p.active && p.teamId === team.id),
  }));
  const loose = people.filter((p) => p.active && !(p.teamId && known.has(p.teamId)));
  const inactive = people.filter((p) => !p.active);
  if (loose.length) groups.push({ key: "none", team: null, label: "Sem equipa", people: loose });
  if (inactive.length) groups.push({ key: "inactive", team: null, label: "Inactivos", people: inactive });
  return groups;
}
