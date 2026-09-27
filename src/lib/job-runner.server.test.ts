import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Base de dados simulada: cada tabela responde o que o teste definir, e
 * ficam registados os filtros e as escritas que o motor fez.
 */
let filters: [string, unknown][];
let reads: number;
let answers: Record<string, unknown>;
let updates: Record<string, unknown>[];

vi.mock("@/integrations/supabase/client.server", () => {
  const query = (table: string) => {
    let op = "select";
    const chain: Record<string, unknown> = new Proxy(
      {},
      {
        get(_, name: string) {
          if (name === "then") {
            const data = answers[`${table}.${op}`] ?? [];
            return (ok: (value: unknown) => unknown) =>
              Promise.resolve({ data, error: null }).then(ok);
          }
          return (...args: unknown[]) => {
            if (name === "in") filters.push([String(args[0]), args[1]]);
            if (name === "update") {
              op = "update";
              updates.push(args[0] as Record<string, unknown>);
            }
            return chain;
          };
        },
      },
    );
    return chain;
  };
  return {
    supabaseAdmin: {
      from: (table: string) => {
        reads += 1;
        return query(table);
      },
    },
  };
});

const billed = vi.hoisted(() => ({ calls: [] as unknown[], block: false }));
vi.mock("@/lib/ai/billing.server", async (original) => {
  const real = await original<typeof import("@/lib/ai/billing.server")>();
  return {
    ...real,
    runBilled: async (ctx: unknown, fn: () => Promise<unknown>) => {
      billed.calls.push(ctx);
      if (billed.block) throw new real.NoCreditsError("Sem saldo de IA.");
      return fn();
    },
  };
});

const { runPendingJobs } = await import("./job-runner.server");

beforeEach(() => {
  filters = [];
  reads = 0;
  answers = {};
  updates = [];
  billed.calls = [];
  billed.block = false;
});

describe("fila de trabalhos: fronteira entre organizações", () => {
  it("quem empurra a fila só chega aos trabalhos das suas organizações", async () => {
    await runPendingJobs(1000, ["org-a", "org-b"]);
    expect(filters).toContainEqual(["organization_id", ["org-a", "org-b"]]);
  });

  it("quem não pertence a nenhuma organização não lê a fila", async () => {
    expect(await runPendingJobs(1000, [])).toEqual({ steps: 0 });
    expect(reads).toBe(0);
  });

  it("o servidor e a chamada agendada avançam a fila inteira", async () => {
    await runPendingJobs(1000);
    expect(filters.some(([column]) => column === "organization_id")).toBe(false);
  });
});

describe("fila de trabalhos: cobrança", () => {
  const job = {
    id: "job-1",
    kind: "sync",
    webinar_id: "w-1",
    organization_id: "org-a",
    created_by: "u-1",
    state: {},
    payload: {},
    attempts: 0,
  };

  beforeEach(() => {
    let served = false;
    // O trabalho aparece uma vez na fila; a segunda leitura vem vazia.
    Object.defineProperty(answers, "background_jobs.select", {
      get: () => (served ? [] : ((served = true), [job])),
      configurable: true,
    });
    answers["background_jobs.update"] = [{ id: "job-1" }];
    answers["webinars.select"] = { organization_id: "org-a" };
    answers["organization_members.select"] = [{ id: "m-1" }];
  });

  it("cada etapa é cobrada à organização do webinar", async () => {
    await runPendingJobs(1000);
    expect(billed.calls[0]).toEqual({ organizationId: "org-a", action: "chat_generation" });
  });

  it("sem saldo, o trabalho pára com a razão em vez de repetir", async () => {
    billed.block = true;
    await runPendingJobs(1000);
    expect(updates).toContainEqual(
      expect.objectContaining({ status: "error", error: "Sem saldo de IA.", locked_until: null }),
    );
    expect(updates.some((u) => u["note"] === "A tentar novamente...")).toBe(false);
  });
});
