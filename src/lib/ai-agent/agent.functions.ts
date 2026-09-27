/**
 * Funções de servidor do Agente IA: configuração, conhecimento, simulador,
 * sugestões para a equipa e métricas.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { assertWebinarAccess, requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runBilled } from "@/lib/ai/billing.server";
import { defaultPermissions, KNOWLEDGE_FIELDS, type AgentSource } from "./defaults";

type Row = Record<string, any>;

const uuid = z.string().uuid();

async function ensureAgentRow(supabase: any, webinarId: string) {
  const { data: existing } = await supabase
    .from("ai_agents")
    .select("*")
    .eq("webinar_id", webinarId)
    .maybeSingle();
  if (existing) return existing as Row;

  const { data: webinar } = await supabase
    .from("webinars")
    .select("id, organization_id")
    .eq("id", webinarId)
    .single();
  if (!webinar) throw new Error("Webinar não encontrado.");

  const { data: created, error } = await supabase
    .from("ai_agents")
    .insert({
      webinar_id: webinarId,
      organization_id: webinar.organization_id,
      permissions: defaultPermissions(),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const rows = KNOWLEDGE_FIELDS.map((field, index) => ({
    agent_id: created.id,
    organization_id: webinar.organization_id,
    section: field.section,
    field: field.field,
    label: field.label,
    value: "",
    visibility: "always",
    position: index,
  }));
  await supabase.from("ai_agent_knowledge").insert(rows);
  return created as Row;
}

export type AgentBundle = {
  agent: Row;
  knowledge: Row[];
  faqs: Row[];
  objections: Row[];
};

export const getAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ webinarId: uuid }).parse(data))
  .handler(async ({ data, context }): Promise<AgentBundle> => {
    const supabase = context.supabase as never as any;
    const agent = await ensureAgentRow(supabase, data.webinarId);
    const [{ data: knowledge }, { data: faqs }, { data: objections }] = await Promise.all([
      supabase.from("ai_agent_knowledge").select("*").eq("agent_id", agent["id"]).order("position"),
      supabase.from("ai_agent_faqs").select("*").eq("agent_id", agent["id"]).order("position"),
      supabase.from("ai_agent_objections").select("*").eq("agent_id", agent["id"]).order("position"),
    ]);
    return {
      agent,
      knowledge: (knowledge ?? []) as Row[],
      faqs: (faqs ?? []) as Row[],
      objections: (objections ?? []) as Row[],
    };
  });

export const saveAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        webinarId: uuid,
        patch: z.record(z.string(), z.unknown()),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as never as any;
    const agent = await ensureAgentRow(supabase, data.webinarId);
    const { error } = await supabase
      .from("ai_agents")
      .update({ ...data.patch, updated_at: new Date().toISOString() })
      .eq("id", agent["id"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveAgentKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        webinarId: uuid,
        items: z.array(
          z.object({
            id: uuid,
            value: z.string(),
            visibility: z.enum(["always", "after_presented"]),
            presentedAfterMs: z.number().int().nonnegative().nullable(),
          }),
        ),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as never as any;
    for (const item of data.items) {
      await supabase
        .from("ai_agent_knowledge")
        .update({
          value: item.value,
          visibility: item.visibility,
          presented_after_ms: item.presentedAfterMs,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
    }
    return { ok: true };
  });

export const saveAgentFaq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        webinarId: uuid,
        id: uuid.nullable(),
        question: z.string().min(1),
        answer: z.string(),
        visibility: z.enum(["always", "after_presented"]).default("always"),
        approved: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as never as any;
    const agent = await ensureAgentRow(supabase, data.webinarId);
    const payload = {
      question: data.question,
      answer: data.answer,
      visibility: data.visibility,
      approved: data.approved,
      updated_at: new Date().toISOString(),
    };
    if (data.id) await supabase.from("ai_agent_faqs").update(payload).eq("id", data.id);
    else
      await supabase.from("ai_agent_faqs").insert({
        ...payload,
        agent_id: agent["id"],
        organization_id: agent["organization_id"],
      });
    return { ok: true };
  });

export const saveAgentObjection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        webinarId: uuid,
        id: uuid.nullable(),
        objection: z.string().min(1),
        response: z.string().default(""),
        keyPoints: z.string().default(""),
        neverSay: z.string().default(""),
        allowedCta: z.string().default(""),
        escalateWhen: z.string().default(""),
        approved: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as never as any;
    const agent = await ensureAgentRow(supabase, data.webinarId);
    const payload = {
      objection: data.objection,
      response: data.response,
      key_points: data.keyPoints,
      never_say: data.neverSay,
      allowed_cta: data.allowedCta,
      escalate_when: data.escalateWhen,
      approved: data.approved,
      updated_at: new Date().toISOString(),
    };
    if (data.id) await supabase.from("ai_agent_objections").update(payload).eq("id", data.id);
    else
      await supabase.from("ai_agent_objections").insert({
        ...payload,
        agent_id: agent["id"],
        organization_id: agent["organization_id"],
      });
    return { ok: true };
  });

export const deleteAgentItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ table: z.enum(["ai_agent_faqs", "ai_agent_objections"]), id: uuid }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await (context.supabase as never as any).from(data.table).delete().eq("id", data.id);
    return { ok: true };
  });

export type SimulationResult = {
  ok: boolean;
  classification: string;
  decision: string;
  answer: string;
  confidence: number;
  sources: AgentSource[];
  escalationReason: string | null;
  reason: string;
  model: string;
  error?: string;
};

export const simulateAgentReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        webinarId: uuid,
        question: z.string().min(1).max(1000),
        sessionSeconds: z.number().int().nonnegative(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<SimulationResult> => {
    const organizationId = await assertWebinarAccess(context.supabase, data.webinarId);
    const { decideAgentReply } = await import("./respond.server");
    const result = await runBilled({ organizationId, action: "agent_reply" }, () =>
      decideAgentReply({
        webinarId: data.webinarId,
        question: data.question,
        sessionMs: data.sessionSeconds * 1000,
        history: [],
        participantName: "Participante de teste",
      }),
    );
    if (!result.ok) {
      return {
        ok: false,
        classification: "UNKNOWN",
        decision: "ESCALATE",
        answer: "",
        confidence: 0,
        sources: [],
        escalationReason: "Problema técnico do assistente",
        reason: "",
        model: "",
        error: result.reason,
      };
    }
    return {
      ok: true,
      classification: result.classification,
      decision: result.decision,
      answer: result.answer,
      confidence: result.confidence,
      sources: result.sources,
      escalationReason: result.escalationReason,
      reason: result.reason,
      model: result.model,
    };
  });

export type LearnSuggestions = {
  ok: boolean;
  error?: string;
  faqs: { question: string; answer: string }[];
  objections: { objection: string; response: string }[];
};

/** "Aprender com este webinar": sugestões que o vendedor tem de aprovar. */
export const learnFromWebinar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ webinarId: uuid }).parse(data))
  .handler(async ({ data, context }): Promise<LearnSuggestions> => {
    const organizationId = await assertWebinarAccess(context.supabase, data.webinarId);
    const [{ latestReadyVersion }, { askModelJson, parseJsonObject }] = await Promise.all([
      import("@/lib/temporal/engine.server"),
      import("./model.server"),
    ]);
    const version = await latestReadyVersion(data.webinarId);
    if (!version || !version.rawText) {
      return { ok: false, error: "Ainda não há transcrição deste webinar.", faqs: [], objections: [] };
    }
    const text = version.rawText.slice(0, 24000);
    const result = await runBilled({ organizationId, action: "agent_content" }, () => askModelJson({
      system:
        "És um assistente que prepara conhecimento de apoio a vendas a partir da transcrição de um webinar. Responde apenas com JSON válido: {\"faqs\":[{\"question\":\"\",\"answer\":\"\"}],\"objections\":[{\"objection\":\"\",\"response\":\"\"}]}. Português de Portugal. Nunca inventes preços, garantias ou bónus que não apareçam no texto.",
      user: `Transcrição do webinar:\n${text}\n\nSugere até 12 perguntas frequentes e até 8 objeções com resposta, apenas com base no que foi dito.`,
    }));
    if (!result.ok) return { ok: false, error: result.reason, faqs: [], objections: [] };
    const parsed = parseJsonObject<LearnSuggestions>(result.text);
    if (!parsed) return { ok: false, error: "Sugestões incompletas.", faqs: [], objections: [] };
    return {
      ok: true,
      faqs: (parsed.faqs ?? []).slice(0, 12),
      objections: (parsed.objections ?? []).slice(0, 8),
    };
  });

export type GeneratedContent = {
  ok: boolean;
  error?: string;
  usedTranscript: boolean;
  knowledge: { field: string; value: string }[];
  faqs: { question: string; answer: string }[];
  objections: {
    objection: string;
    response: string;
    keyPoints: string;
    neverSay: string;
    allowedCta: string;
    escalateWhen: string;
  }[];
};

const EMPTY_CONTENT: Omit<GeneratedContent, "ok" | "error" | "usedTranscript"> = {
  knowledge: [],
  faqs: [],
  objections: [],
};

/**
 * "Gerar com IA" das secções de conhecimento, FAQs e objeções.
 *
 * Usa como fonte o que o vendedor já preencheu e, quando existe, a
 * transcrição real do webinar. Tudo é sugestão: só entra depois de aprovado.
 */
export const generateAgentContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        webinarId: uuid,
        target: z.enum(["knowledge", "faqs", "objections"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<GeneratedContent> => {
    const supabase = context.supabase as never as any;
    const agent = await ensureAgentRow(supabase, data.webinarId);

    const [{ data: webinar }, { data: knowledge }, { latestReadyVersion }, model] =
      await Promise.all([
        supabase.from("webinars").select("title, description").eq("id", data.webinarId).single(),
        supabase.from("ai_agent_knowledge").select("*").eq("agent_id", agent["id"]).order("position"),
        import("@/lib/temporal/engine.server"),
        import("./model.server"),
      ]);

    const version = await latestReadyVersion(data.webinarId).catch(() => null);
    const transcript = version?.rawText ? version.rawText.slice(0, 24000) : "";
    const usedTranscript = transcript.length > 0;

    const filled = ((knowledge ?? []) as Row[])
      .filter((row) => String(row["value"] ?? "").trim())
      .map((row) => `- ${row["label"]}: ${row["value"]}`)
      .join("\n");

    const fieldList = KNOWLEDGE_FIELDS.map((f) => `- ${f.field}: ${f.label}`).join("\n");

    const shape =
      data.target === "knowledge"
        ? '{"knowledge":[{"field":"","value":""}]}'
        : data.target === "faqs"
          ? '{"faqs":[{"question":"","answer":""}]}'
          : '{"objections":[{"objection":"","response":"","keyPoints":"","neverSay":"","allowedCta":"","escalateWhen":""}]}';

    const ask =
      data.target === "knowledge"
        ? `Preenche os campos em falta usando apenas informação presente nas fontes. Campos possíveis:\n${fieldList}\nDevolve só os campos para os quais tens base real. Nunca inventes preço, garantia, prazos ou bónus.`
        : data.target === "faqs"
          ? "Sugere até 12 perguntas frequentes com resposta curta e concreta, apenas com base nas fontes."
          : "Sugere até 8 objeções reais com resposta recomendada, pontos-chave, o que nunca dizer, chamada à ação permitida e quando passar para uma pessoa da equipa.";

    const sources = [
      webinar?.title ? `Webinar: ${webinar.title}` : "",
      webinar?.description ? `Descrição: ${webinar.description}` : "",
      filled ? `Conhecimento já preenchido pelo vendedor:\n${filled}` : "",
      transcript ? `Transcrição do webinar:\n${transcript}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    if (!sources.trim()) {
      return {
        ok: false,
        error: "Ainda não há informação suficiente. Preencha alguns campos ou gere a transcrição.",
        usedTranscript,
        ...EMPTY_CONTENT,
      };
    }

    const result = await runBilled(
      { organizationId: String(agent["organization_id"]), action: "agent_content" },
      () => model.askModelJson({
      system: `És um assistente que prepara conhecimento de apoio a vendas para um webinar. Responde apenas com JSON válido no formato ${shape}. Português de Portugal. Nunca inventes preços, descontos, garantias, bónus ou resultados que não apareçam nas fontes.`,
      user: `${sources}\n\n${ask}`,
    }),
    );
    if (!result.ok) return { ok: false, error: result.reason, usedTranscript, ...EMPTY_CONTENT };

    const parsed = model.parseJsonObject<GeneratedContent>(result.text);
    if (!parsed)
      return { ok: false, error: "Sugestões incompletas.", usedTranscript, ...EMPTY_CONTENT };

    const allowed = new Set(KNOWLEDGE_FIELDS.map((f) => f.field));
    return {
      ok: true,
      usedTranscript,
      knowledge: (parsed.knowledge ?? [])
        .filter((item) => item && allowed.has(item.field) && String(item.value ?? "").trim())
        .slice(0, KNOWLEDGE_FIELDS.length),
      faqs: (parsed.faqs ?? []).filter((item) => item?.question).slice(0, 12),
      objections: (parsed.objections ?? [])
        .filter((item) => item?.objection)
        .slice(0, 8)
        .map((item) => ({
          objection: item.objection ?? "",
          response: item.response ?? "",
          keyPoints: item.keyPoints ?? "",
          neverSay: item.neverSay ?? "",
          allowedCta: item.allowedCta ?? "",
          escalateWhen: item.escalateWhen ?? "",
        })),
    };
  });


export type AgentSuggestion = {
  id: string;
  conversationId: string | null;
  participantId: string | null;
  inboundText: string;
  classification: string;
  decision: string;
  answer: string;
  confidence: number;
  sources: AgentSource[];
  escalationReason: string | null;
  status: string;
  createdAt: string;
};

export const listAgentSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ webinarId: uuid }).parse(data))
  .handler(async ({ data, context }): Promise<AgentSuggestion[]> => {
    const { data: rows } = await (context.supabase as never as any)
      .from("ai_agent_messages")
      .select("*")
      .eq("webinar_id", data.webinarId)
      .eq("status", "suggested")
      .order("created_at", { ascending: false })
      .limit(50);
    return ((rows ?? []) as Row[]).map((row) => ({
      id: row["id"],
      conversationId: row["conversation_id"],
      participantId: row["participant_id"],
      inboundText: row["inbound_text"],
      classification: row["classification"],
      decision: row["decision"],
      answer: row["answer"],
      confidence: Number(row["confidence"] ?? 0),
      sources: (row["sources"] ?? []) as AgentSource[],
      escalationReason: row["escalation_reason"],
      status: row["status"],
      createdAt: row["created_at"],
    }));
  });

/** A equipa aprova (com ou sem edição) e a resposta segue para o participante. */
export const sendAgentSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: uuid, finalAnswer: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as never as any;
    const { data: row } = await supabase
      .from("ai_agent_messages")
      .select("*")
      .eq("id", data.id)
      .single();
    if (!row) throw new Error("Sugestão não encontrada.");
    const edited = data.finalAnswer.trim() !== String(row.answer ?? "").trim();

    await supabase.from("private_messages").insert({
      conversation_id: row.conversation_id,
      organization_id: row.organization_id,
      participant_id: row.participant_id,
      sender_kind: "ai_agent",
      body: data.finalAnswer,
      agent_message_id: row.id,
    });
    await supabase
      .from("private_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        status: "active",
        needs_human: false,
        escalation_reason: null,
      })
      .eq("id", row.conversation_id);
    await supabase
      .from("ai_agent_messages")
      .update({
        status: edited ? "edited" : "sent",
        human_edit: edited ? data.finalAnswer : null,
        final_answer: data.finalAnswer,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return { ok: true };
  });

export const discardAgentSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    await (context.supabase as never as any)
      .from("ai_agent_messages")
      .update({ status: "discarded", updated_at: new Date().toISOString() })
      .eq("id", data.id);
    return { ok: true };
  });

export const rateAgentMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: uuid, feedback: z.enum(["up", "down"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await (context.supabase as never as any)
      .from("ai_agent_messages")
      .update({ feedback: data.feedback, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    return { ok: true };
  });

export type AgentAnalytics = {
  conversations: number;
  answers: number;
  suggestions: number;
  approved: number;
  edited: number;
  escalations: number;
  unanswered: number;
  averageLatencyMs: number;
  averageConfidence: number;
};

export const getAgentAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ webinarId: uuid }).parse(data))
  .handler(async ({ data, context }): Promise<AgentAnalytics> => {
    const { data: rows } = await (context.supabase as never as any)
      .from("ai_agent_messages")
      .select("*")
      .eq("webinar_id", data.webinarId)
      .eq("is_simulation", false);
    const list = (rows ?? []) as Row[];
    const conversations = new Set(list.map((row) => row["conversation_id"]).filter(Boolean)).size;
    const sent = list.filter((row) => row["status"] === "sent");
    const edited = list.filter((row) => row["status"] === "edited");
    const suggested = list.filter((row) => row["status"] === "suggested");
    const escalated = list.filter((row) => row["decision"] === "ESCALATE");
    const latency = list.reduce((sum, row) => sum + Number(row["latency_ms"] ?? 0), 0);
    const confidence = list.reduce((sum, row) => sum + Number(row["confidence"] ?? 0), 0);
    return {
      conversations,
      answers: sent.length + edited.length,
      suggestions: suggested.length + sent.length + edited.length,
      approved: sent.length,
      edited: edited.length,
      escalations: escalated.length,
      unanswered: escalated.filter((row) => row["escalation_reason"]?.includes("não coberta")).length,
      averageLatencyMs: list.length > 0 ? Math.round(latency / list.length) : 0,
      averageConfidence: list.length > 0 ? confidence / list.length : 0,
    };
  });
