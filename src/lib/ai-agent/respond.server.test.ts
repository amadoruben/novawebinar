import { beforeEach, describe, expect, it, vi } from "vitest";

/** Que agente responde num webinar (o próprio ou o da conta, migração 0073) e com que conhecimento. */
let own: Record<string, unknown> | null;
let account: Record<string, unknown> | null;

/** O conhecimento de cada linha de agente, pelo `agent_id` pedido. */
const ROWS: Record<string, (agentId: string) => Record<string, unknown>[]> = {
  ai_agent_knowledge: (agentId) => [{ agent_id: agentId, section: "produto", label: "O que está incluído?", value: `Aulas de ${agentId}`, approved: true, visibility: "always" }],
  ai_agent_faqs: (agentId) => [{ agent_id: agentId, question: "Há certificado?", answer: `Sim (${agentId})`, approved: true, visibility: "always" }],
  ai_agent_objections: () => [],
};

vi.mock("@/integrations/supabase/client.server", () => {
  const query = (table: string) => {
    let accountQuery = false;
    let agentId = "";
    const chain: Record<string, unknown> = new Proxy(
      {},
      {
        get(_, name: string) {
          if (name === "then") {
            const data =
              table === "ai_agents"
                ? accountQuery
                  ? account
                  : own
                : table === "webinars"
                  ? { organization_id: "org-1", status: "active", slug: "aula", public_title: "Aula", cta_text: "Quero", cta_price_now: "25 000 Kz", cta_start_seconds: 0, schedule_mode: "on_demand" }
                  : ROWS[table]
                    ? ROWS[table](agentId)
                    : null;
            return (ok: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(ok);
          }
          return (...args: unknown[]) => {
            if (name === "is") accountQuery = true;
            if (name === "eq" && args[0] === "agent_id") agentId = String(args[1]);
            return chain;
          };
        },
      },
    );
    return chain;
  };
  return { supabaseAdmin: { from: (table: string) => query(table) } };
});

const { agentOutcome, buildAgentContext, loadAgentBundle, PASS_PERSON, PASS_UNKNOWN } = await import("./respond.server");

beforeEach(() => {
  own = null;
  account = null;
});

describe("agente que responde no webinar", () => {
  it("antes da migração (sem agente da conta) fica o do webinar, ligado ou não", async () => {
    own = { id: "a-w", organization_id: "org-1", enabled: false };
    expect((await loadAgentBundle("w-1"))?.agent["id"]).toBe("a-w");
    own = null;
    expect(await loadAgentBundle("w-1")).toBeNull();
  });

  it("«Só este webinar» e ligado: o do webinar, mesmo com agente da conta", async () => {
    own = { id: "a-w", organization_id: "org-1", enabled: true, scope: "webinar" };
    account = { id: "a-conta", organization_id: "org-1", enabled: true, scope: "account" };
    expect((await loadAgentBundle("w-1"))?.agent["id"]).toBe("a-w");
  });

  it("«Só este webinar» e desligado: continua o do webinar (ninguém responde), não o da conta", async () => {
    own = { id: "a-w", organization_id: "org-1", enabled: false, scope: "webinar" };
    account = { id: "a-conta", organization_id: "org-1", enabled: true, scope: "account" };
    expect((await loadAgentBundle("w-1"))?.agent["id"]).toBe("a-w");
  });

  it("«Todos os webinars» ou webinar sem agente: o da conta", async () => {
    account = { id: "a-conta", organization_id: "org-1", enabled: true, scope: "account" };
    own = { id: "a-w", organization_id: "org-1", enabled: true, scope: "account" };
    expect((await loadAgentBundle("w-1"))?.agent["id"]).toBe("a-conta");
    own = null;
    expect((await loadAgentBundle("w-1"))?.agent["id"]).toBe("a-conta");
  });
});

describe("conhecimento deste webinar", () => {
  it("com «Todos os webinars», o agente é o da conta mas o conhecimento e as fontes são do webinar", async () => {
    account = { id: "a-conta", organization_id: "org-1", enabled: true, scope: "account", webinar_id: null };
    own = { id: "a-w", organization_id: "org-1", scope: "account", webinar_id: "w-1", personality: { sources: { faqs: false } } };
    const bundle = await loadAgentBundle("w-1");
    expect(bundle?.agent["id"]).toBe("a-conta");
    expect(bundle?.knowledge[0]?.["agent_id"]).toBe("a-w");
    expect(bundle?.faqs[0]?.["agent_id"]).toBe("a-w");
    expect(bundle?.sources).toMatchObject({ faqs: false, notas: true, transcricao: false });
  });

  it("só as fontes marcadas entram no que o agente sabe", async () => {
    own = { id: "a-w", organization_id: "org-1", scope: "webinar", webinar_id: "w-1" };
    const ids = async () =>
      (await buildAgentContext({ webinarId: "w-1", question: "Preço?", sessionMs: 60_000, history: [] }))!.catalogue.map((c) => c.id[0]);
    // Tudo marcado (menos a transcrição): produto [K], perguntas [F], página [D] e oferta [P].
    expect(new Set(await ids())).toEqual(new Set(["K", "F", "D", "P"]));
    own = { ...own, personality: { sources: { faqs: false, oferta: false, pagina: false } } };
    expect(await ids()).toEqual(["K"]);
    own = { ...own, personality: { sources: { notas: false, faqs: false, oferta: false, pagina: false } } };
    expect(await ids()).toEqual([]);
  });
});

describe("passa à equipa quando (os motivos do passo Agente)", () => {
  type Decision = Parameters<typeof agentOutcome>[0]["decision"];
  const model = (over: Partial<Decision> = {}): Decision => ({
    decision: "ESCALATE",
    answer: "",
    confidence: 0.3,
    escalationReason: null,
    classification: "QUESTION",
    ...over,
  });
  const question = { alwaysHuman: false, defaultReason: "Precisa de uma pessoa da equipa", intent: "information" as const };
  // A regra da organização de origem: o pedido de pessoa é sempre de uma pessoa.
  const person = { alwaysHuman: true, defaultReason: "O cliente pediu uma pessoa da equipa", intent: "human_request" as const };
  const agent = (reasons?: string[], mode = "hibrido") => ({ mode, confidence_threshold: 0.75, escalation: reasons ? { reasons } : {} });

  it("sem lista gravada, ou com os dois marcados, passa como sempre", () => {
    for (const a of [agent(), agent([PASS_UNKNOWN, PASS_PERSON])]) {
      expect(agentOutcome({ agent: a, decision: model({ decision: "RESPOND", answer: "Sim.", confidence: 0.4 }), classified: question })).toMatchObject({
        toCase: true,
        escalationReason: "Baixa confiança",
        decision: "ESCALATE",
      });
      expect(agentOutcome({ agent: a, decision: model(), classified: question })).toMatchObject({ toCase: true, escalationReason: "Pergunta não coberta" });
      expect(agentOutcome({ agent: a, decision: model({ classification: "HUMAN_REQUEST" }), classified: person })).toMatchObject({
        toCase: true,
        escalationReason: "O cliente pediu uma pessoa da equipa",
      });
      expect(agentOutcome({ agent: a, decision: model({ decision: "RESPOND", answer: "Sim.", confidence: 0.9 }), classified: question })).toMatchObject({ autoSend: true, toCase: false });
    }
  });

  it("«Não sabe responder» desligado: sem certeza fica como sugestão, sem resposta não acontece nada; o pedido de pessoa continua a passar", () => {
    const a = agent([PASS_PERSON]);
    expect(agentOutcome({ agent: a, decision: model({ decision: "RESPOND", answer: "Sim.", confidence: 0.4 }), classified: question })).toMatchObject({
      toCase: false,
      autoSend: false,
      suggestionOnly: true,
      escalationReason: null,
      decision: "SUGGEST_TO_TEAM",
    });
    expect(agentOutcome({ agent: a, decision: model(), classified: question })).toMatchObject({ toCase: false, ignore: true, decision: "IGNORE" });
    // No Automático, o que o modelo escreveu em vez de passar sai como resposta.
    expect(agentOutcome({ agent: agent([PASS_PERSON], "automatico"), decision: model({ answer: "Não tenho essa informação." }), classified: question })).toMatchObject({
      autoSend: true,
      toCase: false,
      decision: "RESPOND",
    });
    expect(agentOutcome({ agent: a, decision: model({ classification: "HUMAN_REQUEST" }), classified: person })).toMatchObject({ toCase: true });
  });

  it("«Pedem uma pessoa» desligado: o pedido de pessoa não abre caso, mesmo com a regra da organização; o resto passa", () => {
    const a = agent([PASS_UNKNOWN]);
    expect(agentOutcome({ agent: agent([PASS_UNKNOWN], "automatico"), decision: model({ answer: "Sou um assistente; posso ajudar.", confidence: 0.9 }), classified: person })).toMatchObject({
      autoSend: true,
      toCase: false,
    });
    expect(agentOutcome({ agent: a, decision: model(), classified: person })).toMatchObject({ toCase: false, ignore: true });
    // Só pela classificação do modelo, sem a regra: também é um pedido de pessoa.
    expect(agentOutcome({ agent: a, decision: model({ classification: "HUMAN_REQUEST" }), classified: question })).toMatchObject({ toCase: false });
    expect(agentOutcome({ agent: a, decision: model(), classified: question })).toMatchObject({ toCase: true, escalationReason: "Pergunta não coberta" });
  });

  it("as outras regras da organização (sempre uma pessoa) passam sempre, com os motivos todos desligados", () => {
    const refund = { alwaysHuman: true, defaultReason: "Reembolso", intent: "refund" as const };
    expect(agentOutcome({ agent: agent([]), decision: model({ decision: "RESPOND", answer: "Sim.", confidence: 0.9 }), classified: refund })).toMatchObject({
      toCase: true,
      autoSend: false,
      escalationReason: "Reembolso",
    });
  });
});
