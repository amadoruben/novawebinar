/**
 * Atendimento: os nomes, os estados e as regras simples que o resto usa.
 * Os ids são os mesmos que as colunas `intent`, `priority`, `status` da base de dados.
 */
import type { Database } from "@/integrations/supabase/types";
import { TIMELINE_LABEL } from "@/lib/contacts";

type Tables = Database["public"]["Tables"];
export type CaseRow = Tables["support_cases"]["Row"];
export type StaffRow = Tables["support_staff"]["Row"];
export type DepartmentRow = Tables["support_departments"]["Row"];
export type SkillRow = Tables["support_skills"]["Row"];
export type RuleRow = Tables["support_routing_rules"]["Row"];
export type EventRow = Tables["activity_events"]["Row"];

export const INTENTS = [
  { id: "purchase", label: "Compra" },
  { id: "payment", label: "Pagamento" },
  { id: "checkout", label: "Checkout" },
  { id: "negotiation", label: "Negociação" },
  { id: "offer_question", label: "Dúvida sobre a oferta" },
  { id: "access", label: "Acesso" },
  { id: "technical", label: "Problema técnico" },
  { id: "post_purchase", label: "Pós-compra" },
  { id: "refund", label: "Reembolso" },
  { id: "complaint", label: "Reclamação" },
  { id: "human_request", label: "Pedido de humano" },
  { id: "information", label: "Informação" },
  { id: "other", label: "Outro" },
] as const;
export type Intent = (typeof INTENTS)[number]["id"];

export const CATEGORIES = [
  { id: "offer", label: "Oferta" },
  { id: "payment", label: "Pagamento" },
  { id: "access", label: "Acesso" },
  { id: "technical", label: "Técnico" },
  { id: "post_purchase", label: "Pós-compra" },
  { id: "content", label: "Conteúdo" },
  { id: "general", label: "Geral" },
] as const;
export type Category = (typeof CATEGORIES)[number]["id"];

/** Da mais urgente para a menos urgente. */
export const PRIORITIES = [
  { id: "critical", label: "Crítica" },
  { id: "high", label: "Alta" },
  { id: "normal", label: "Normal" },
  { id: "low", label: "Baixa" },
] as const;
export type Priority = (typeof PRIORITIES)[number]["id"];

export const CASE_STATUSES = [
  { id: "new", label: "Novo", open: true },
  { id: "reviewing", label: "Em análise", open: true },
  { id: "assigned", label: "Atribuído", open: true },
  { id: "in_progress", label: "Em atendimento", open: true },
  { id: "waiting_customer", label: "Aguardando cliente", open: true },
  { id: "waiting_team", label: "Aguardando equipa", open: true },
  { id: "escalated", label: "Escalado", open: true },
  { id: "reopened", label: "Reaberto", open: true },
  { id: "resolved", label: "Resolvido", open: false },
  { id: "closed", label: "Fechado", open: false },
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number]["id"];

export const STAFF_STATUSES = [
  { id: "available", label: "Disponível", hint: "Recebe casos novos" },
  { id: "online", label: "Online", hint: "Recebe casos quando ninguém está disponível" },
  { id: "busy", label: "Ocupado", hint: "Não recebe casos novos" },
  { id: "away", label: "Ausente", hint: "Não recebe casos novos" },
  { id: "offline", label: "Offline", hint: "Fora do atendimento" },
] as const;
export type StaffStatus = (typeof STAFF_STATUSES)[number]["id"];

export const CHANNELS = [
  { id: "webinar_chat", label: "Chat do webinar", ready: true },
  { id: "whatsapp", label: "WhatsApp", ready: false },
  { id: "email", label: "Email", ready: false },
  { id: "instagram", label: "Instagram", ready: false },
] as const;

const label = <T extends { id: string; label: string }>(list: readonly T[], id: string | null | undefined) =>
  list.find((item) => item.id === id)?.label ?? "—";

export const intentLabel = (id: string | null | undefined) => label(INTENTS, id);
export const categoryLabel = (id: string | null | undefined) => label(CATEGORIES, id);
export const priorityLabel = (id: string | null | undefined) => label(PRIORITIES, id);
export const statusLabel = (id: string | null | undefined) => label(CASE_STATUSES, id);
export const staffStatusLabel = (id: string | null | undefined) => label(STAFF_STATUSES, id);
export const channelLabel = (id: string | null | undefined) => label(CHANNELS, id);

export const isIntent = (value: unknown): value is Intent =>
  typeof value === "string" && INTENTS.some((i) => i.id === value);

export function isOpenStatus(status: string | null | undefined) {
  return CASE_STATUSES.find((s) => s.id === status)?.open ?? false;
}

export function priorityRank(priority: string | null | undefined) {
  const index = PRIORITIES.findIndex((p) => p.id === priority);
  return index < 0 ? PRIORITIES.length : index;
}

/* ---------- Presença ---------- */

/** Sem sinal do ecrã há mais do que isto, a pessoa conta como fora. */
export const PRESENCE_TIMEOUT_MS = 3 * 60_000;
export const PRESENCE_BEAT_MS = 60_000;

/** O estado que a pessoa escolheu só vale enquanto tiver o painel aberto. */
export function effectiveStatus(
  staff: Pick<StaffRow, "status" | "last_seen_at" | "user_id" | "active">,
  now = Date.now(),
): StaffStatus {
  if (!staff.active || !staff.user_id || !staff.last_seen_at) return "offline";
  if (now - Date.parse(staff.last_seen_at) > PRESENCE_TIMEOUT_MS) return "offline";
  return (STAFF_STATUSES.some((s) => s.id === staff.status) ? staff.status : "offline") as StaffStatus;
}

/* ---------- Prazo de resposta ---------- */

export type SlaState = "none" | "met" | "ok" | "risk" | "breached";

/**
 * O prazo conta até à primeira resposta de uma pessoa. "Em risco" é o último
 * quarto do prazo, o mesmo critério do aviso automático.
 */
export function slaState(
  c: Pick<CaseRow, "status" | "sla_deadline" | "sla_minutes" | "first_response_at" | "sla_breached_at">,
  now = Date.now(),
): { state: SlaState; minutesLeft: number | null } {
  if (!c.sla_deadline) return { state: "none", minutesLeft: null };
  const deadline = Date.parse(c.sla_deadline);
  if (c.first_response_at) {
    const late = Boolean(c.sla_breached_at) || Date.parse(c.first_response_at) > deadline;
    return { state: late ? "breached" : "met", minutesLeft: null };
  }
  if (!isOpenStatus(c.status)) return { state: "none", minutesLeft: null };
  const minutesLeft = Math.round((deadline - now) / 60_000);
  if (c.sla_breached_at || deadline <= now) return { state: "breached", minutesLeft };
  const warnAt = deadline - c.sla_minutes * 15_000;
  return { state: now >= warnAt ? "risk" : "ok", minutesLeft };
}

export function slaLabel(sla: { state: SlaState; minutesLeft: number | null }) {
  const minutes = Math.abs(sla.minutesLeft ?? 0);
  const time = minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
  switch (sla.state) {
    case "met":
      return "Respondido no prazo";
    case "breached":
      return sla.minutesLeft === null ? "Respondido fora do prazo" : `Prazo ultrapassado há ${time}`;
    case "risk":
      return `Faltam ${time}`;
    case "ok":
      return `Responder em ${time}`;
    default:
      return "Sem prazo";
  }
}

/* ---------- O que se pode fazer a um caso ---------- */

export type CaseAction =
  | "assume"
  | "transfer"
  | "waiting_customer"
  | "waiting_team"
  | "resume"
  | "escalate"
  | "return_to_ai"
  | "resolve"
  | "reopen"
  | "close"
  | "request_call";

export const ACTION_LABEL: Record<CaseAction, string> = {
  assume: "Assumir",
  transfer: "Transferir",
  waiting_customer: "Aguardar cliente",
  waiting_team: "Aguardar equipa",
  resume: "Retomar",
  escalate: "Escalar para o supervisor",
  return_to_ai: "Devolver à IA",
  resolve: "Resolver",
  reopen: "Reabrir",
  close: "Fechar",
  request_call: "Marcar ligação",
};

export function availableActions(
  c: Pick<CaseRow, "status" | "assigned_staff_id" | "call_required" | "conversation_id">,
  myStaffId: string | null,
): CaseAction[] {
  const status = c.status as CaseStatus;
  if (status === "closed") return ["reopen"];
  if (status === "resolved") return ["reopen", "close"];
  const actions: CaseAction[] = [];
  if (c.assigned_staff_id !== myStaffId || status !== "in_progress") actions.push("assume");
  actions.push("transfer");
  if (status === "waiting_customer" || status === "waiting_team") actions.push("resume");
  else actions.push("waiting_customer", "waiting_team");
  if (!c.call_required) actions.push("request_call");
  if (status !== "escalated") actions.push("escalate");
  if (c.conversation_id) actions.push("return_to_ai");
  actions.push("resolve");
  return actions;
}

/** O motivo com que fica um caso aberto à mão por quem atende (Assumir, Responder, Transferir). */
export const TEAM_TOOK_REASON = "Assumido pela equipa";

/**
 * Quem abriu o caso: o agente (deixa a sua leitura, com confiança), uma pessoa
 * da equipa, ou uma regra (agente em pausa, webinar sem agente, pedidos que são
 * sempre de uma pessoa). Só a primeira é uma passagem do agente.
 */
export function caseOpenedBy(
  c: Pick<CaseRow, "confidence" | "reason_for_escalation">,
): "agent" | "team" | "rule" {
  if (c.confidence !== null) return "agent";
  return c.reason_for_escalation === TEAM_TOOK_REASON ? "team" : "rule";
}

/* ---------- Rasto ---------- */

export const EVENT_LABEL: Record<string, string> = {
  conversation_created: "Conversa iniciada",
  message_received: "Mensagem do cliente",
  ai_response: "Resposta da IA aprovada pela equipa",
  ai_resolution: "A IA respondeu sozinha",
  ai_escalation: "A IA passou para a equipa",
  ai_resumed: "Conversa devolvida à IA",
  purchase_intent_detected: "Intenção de compra",
  case_created: "Caso criado",
  case_classified: "Caso classificado",
  case_assigned: "Caso atribuído",
  case_unassigned: "Sem responsável: na fila da equipa",
  case_transferred: "Caso transferido",
  case_escalated: "Escalado para o supervisor",
  case_reviewing: "Em análise pelo supervisor",
  case_waiting: "A aguardar",
  case_resumed: "Atendimento retomado",
  case_resolved: "Caso resolvido",
  case_reopened: "Caso reaberto",
  case_closed: "Caso fechado",
  case_stalled: "Caso parado há mais de uma hora",
  case_note: "Nota interna",
  call_requested: "Ligação pedida",
  human_assumed: "Assumido por uma pessoa",
  human_replied: "Resposta da equipa",
  sla_warning: "Prazo quase a terminar",
  sla_breached: "Prazo ultrapassado",
};

// Pagamentos e fim da sessão também chegam ao rasto: o nome é o mesmo da linha do tempo.
export const eventLabel = (name: string) => EVENT_LABEL[name] ?? TIMELINE_LABEL[name] ?? name;

/** Eventos que pedem a atenção do supervisor. */
export const ALERT_EVENTS = ["case_unassigned", "sla_warning", "sla_breached", "case_stalled", "case_escalated"];

/* ---------- Quem vê o quê no painel ---------- */

export type WorkspaceRole = Database["public"]["Enums"]["workspace_role"];

export const canAttend = (role: WorkspaceRole | undefined) =>
  role === "owner" || role === "admin" || role === "support";
export const canManageTeam = (role: WorkspaceRole | undefined) => role === "owner" || role === "admin";

/** O que a função "suporte" abre; o resto do painel é de quem gere os webinars. */
const SUPPORT_PATHS = ["/support", "/cases", "/contacts", "/settings"];

export function canOpenPath(role: WorkspaceRole | undefined, pathname: string) {
  if (role !== "support") return true;
  return SUPPORT_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
