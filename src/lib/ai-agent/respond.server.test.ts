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

const { buildAgentContext, loadAgentBundle } = await import("./respond.server");

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
