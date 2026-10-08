import { beforeEach, describe, expect, it, vi } from "vitest";

/** Que agente responde num webinar: o próprio ou o da conta (âmbito, migração 0073). */
let own: Record<string, unknown> | null;
let account: Record<string, unknown> | null;

vi.mock("@/integrations/supabase/client.server", () => {
  const query = (table: string) => {
    let accountQuery = false;
    const chain: Record<string, unknown> = new Proxy(
      {},
      {
        get(_, name: string) {
          if (name === "then") {
            const data =
              table === "ai_agents" ? (accountQuery ? account : own) : table === "webinars" ? { organization_id: "org-1" } : [];
            return (ok: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(ok);
          }
          return () => {
            if (name === "is") accountQuery = true;
            return chain;
          };
        },
      },
    );
    return chain;
  };
  return { supabaseAdmin: { from: (table: string) => query(table) } };
});

const { loadAgentBundle } = await import("./respond.server");

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
