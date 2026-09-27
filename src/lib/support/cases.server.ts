/**
 * Núcleo de casos: quando a IA não resolve (ou não deve resolver), classifica o
 * pedido, escolhe a pessoa e abre o caso. A gravação é uma só operação na base
 * de dados (`open_support_case`): caso, IA em pausa na conversa e rasto.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { firstName } from "@/lib/contacts";
import { classifyCase, type CaseClassification } from "./classify";
import { contextFacts } from "./context";
import { loadContactContext, type LoadedContext } from "./context.server";
import { effectiveStatus, type DepartmentRow, type RuleRow, type SkillRow, type StaffRow } from "./model";
import { chooseStaff, type Candidate } from "./routing";

export type Team = {
  rules: RuleRow[];
  departments: DepartmentRow[];
  skills: SkillRow[];
  staff: StaffRow[];
  candidates: Candidate[];
};

async function readTeam(organizationId: string) {
  const [rules, departments, skills, staff, load] = await Promise.all([
    supabaseAdmin.from("support_routing_rules").select("*").eq("organization_id", organizationId),
    supabaseAdmin
      .from("support_departments")
      .select("*")
      .eq("organization_id", organizationId)
      .order("position"),
    supabaseAdmin.from("support_skills").select("*").eq("organization_id", organizationId),
    supabaseAdmin.from("support_staff").select("*").eq("organization_id", organizationId),
    supabaseAdmin.from("support_staff_load").select("*").eq("organization_id", organizationId),
  ]);
  // Sem regras lidas, um pedido de reembolso passaria por pergunta normal e a
  // IA responderia: uma leitura falhada pára tudo e a mensagem vai para a equipa.
  const failed = [rules, departments, skills, staff, load].find((part) => part.error);
  if (failed?.error) throw new Error(`Equipa por ler: ${failed.error.message}`);
  return {
    rules: rules.data ?? [],
    departments: departments.data ?? [],
    skills: skills.data ?? [],
    staff: staff.data ?? [],
    load: load.data ?? [],
  };
}

export async function loadTeam(organizationId: string, now = Date.now()): Promise<Team> {
  let team = await readTeam(organizationId);
  // Organização nova em que ainda ninguém abriu o Atendimento.
  if (team.rules.length === 0 && team.departments.length === 0) {
    await supabaseAdmin.rpc("support_seed_defaults", { _organization_id: organizationId });
    team = await readTeam(organizationId);
  }
  const open = new Map(team.load.map((row) => [row.staff_id, row.open_cases ?? 0]));
  return {
    rules: team.rules,
    departments: team.departments,
    skills: team.skills,
    staff: team.staff,
    candidates: team.staff.map((s) => ({
      id: s.id,
      name: s.name,
      departmentId: s.department_id,
      skills: s.skills,
      channels: s.channels,
      status: effectiveStatus(s, now),
      capacity: s.capacity,
      openCases: open.get(s.id) ?? 0,
      active: s.active,
      lastAssignedAt: s.last_assigned_at,
    })),
  };
}

export type AgentReading = {
  intent?: string | null | undefined;
  classification?: string | null | undefined;
  sentiment?: string | null | undefined;
  confidence?: number | null | undefined;
  summary?: string | null | undefined;
  recommendedAction?: string | null | undefined;
};

export type EscalationInput = {
  organizationId: string;
  conversationId: string;
  participantId: string | null;
  webinarId: string | null;
  /** A mensagem que levou ao caso. */
  text: string;
  actor: "ai" | "system" | "human";
  actorUserId?: string | undefined;
  reason?: string | null | undefined;
  agent?: AgentReading | null | undefined;
  channel?: string | undefined;
  /** Já lidos por quem chama; evita repetir as leituras. */
  loaded?: LoadedContext | undefined;
  team?: Team | undefined;
  /** Uma pessoa assumiu: o caso é dela, sem encaminhamento. */
  assignStaffId?: string | undefined;
};

export type EscalationResult = {
  caseId: string;
  number: number;
  created: boolean;
  reopened: boolean;
  assignedStaffId: string | null;
  classification: CaseClassification;
};

const SENTIMENTS = ["positive", "neutral", "negative"];

export async function escalateToCase(input: EscalationInput): Promise<EscalationResult> {
  const [loaded, team] = await Promise.all([
    input.loaded ?? loadContactContext(input.participantId),
    input.team ?? loadTeam(input.organizationId),
  ]);
  const classification = classifyCase({
    text: input.text,
    rules: team.rules,
    modelIntent: input.agent?.intent,
    classification: input.agent?.classification,
    sentiment: input.agent?.sentiment,
    isCustomer: loaded.context.isCustomer,
    fallbackDepartmentId: team.departments.find((d) => d.is_fallback)?.id ?? null,
  });
  const channel = input.channel ?? "webinar_chat";
  const department = team.departments.find((d) => d.id === classification.departmentId);

  let routing: { staffId: string | null; reason: string };
  if (input.assignStaffId) {
    routing = { staffId: input.assignStaffId, reason: "Assumido à mão" };
  } else {
    // Quem tratou deste contacto da última vez tem preferência entre iguais.
    const { data: last } = loaded.contactId
      ? await supabaseAdmin
          .from("support_cases")
          .select("assigned_staff_id")
          .eq("contact_id", loaded.contactId)
          .not("assigned_staff_id", "is", null)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };
    routing = chooseStaff({
      candidates: team.candidates,
      departmentId: classification.departmentId,
      requiredSkills: classification.requiredSkills,
      channel,
      preferredStaffId: last?.assigned_staff_id,
      departmentName: department?.name,
      skillNames: Object.fromEntries(team.skills.map((s) => [s.slug, s.name])),
    });
  }

  const who = firstName(loaded.name) || "O contacto";
  const quote = input.text.trim().slice(0, 400);
  const headline = input.agent?.summary?.trim() || (quote ? `${who} escreveu: "${quote}"` : "");
  const summary = [headline, ...contextFacts(loaded.context, input.webinarId)].filter(Boolean).join("\n");
  const sentiment = SENTIMENTS.includes(String(input.agent?.sentiment)) ? input.agent?.sentiment : null;

  const { data, error } = await supabaseAdmin.rpc("open_support_case", {
    _p: {
      organization_id: input.organizationId,
      conversation_id: input.conversationId,
      participant_id: input.participantId,
      webinar_id: input.webinarId,
      contact_id: loaded.contactId,
      intent: classification.intent,
      category: classification.category,
      priority: classification.priority,
      department_id: classification.departmentId,
      assigned_staff_id: routing.staffId,
      required_skills: classification.requiredSkills,
      source_channel: channel,
      summary: summary.slice(0, 4000),
      reason_for_escalation: (input.reason?.trim() || classification.defaultReason).slice(0, 300),
      recommended_action: (
        input.agent?.recommendedAction?.trim() || classification.recommendedAction
      ).slice(0, 500),
      routing_reason: routing.reason.slice(0, 500),
      call_required: classification.callRequired,
      purchase_intent: classification.purchaseIntent,
      sentiment,
      confidence: input.agent?.confidence ?? null,
      sla_minutes: classification.slaMinutes,
      actor_kind: input.actor,
      actor_user_id: input.actorUserId ?? null,
    },
  });
  if (error || !data) throw new Error(error?.message ?? "Não foi possível abrir o caso.");
  const result = data as {
    case_id: string;
    number: number;
    created: boolean;
    reopened: boolean;
    assigned_staff_id: string | null;
  };

  if (result.created || result.reopened) {
    // Para ligar a ferramentas externas enquanto não há automações dentro da plataforma.
    const { notifyOutgoing } = await import("@/lib/integrations.server");
    await notifyOutgoing(input.organizationId, result.reopened ? "case.reopened" : "case.created", {
      case_id: result.case_id,
      number: result.number,
      intent: classification.intent,
      category: classification.category,
      priority: classification.priority,
      department: department?.name ?? null,
      assigned: team.staff.find((s) => s.id === result.assigned_staff_id)?.name ?? null,
      webinar_id: input.webinarId,
      name: loaded.name,
      purchase_intent: classification.purchaseIntent,
    });
  }

  return {
    caseId: result.case_id,
    number: result.number,
    created: result.created,
    reopened: result.reopened,
    assignedStaffId: result.assigned_staff_id,
    classification,
  };
}

/** Rasto de conversas que não chegaram a caso (a IA respondeu, intenção de compra…). */
export async function logConversationEvent(
  conversationId: string,
  name: string,
  actor: "ai" | "human" | "system" | "contact",
  data: Record<string, unknown> = {},
) {
  await supabaseAdmin.rpc("support_log_conversation_event", {
    _conversation_id: conversationId,
    _name: name,
    _actor_kind: actor,
    _data: data as never,
  });
}

/**
 * Caso aberto desta conversa, se houver. Regista a mensagem e retoma um caso à
 * espera do cliente. Se a verificação falhar, falha quem chama: não saber se há
 * um caso aberto nunca é o mesmo que não haver, e a IA não responde.
 */
export async function noteInbound(conversationId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.rpc("support_case_inbound", {
    _conversation_id: conversationId,
  });
  if (error) throw new Error(`Caso aberto por verificar: ${error.message}`);
  return (data as string | null) ?? null;
}
