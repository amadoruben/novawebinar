import { beforeEach, describe, expect, it, vi } from "vitest";

// Fila vazia simulada: só interessa a que organizações a leitura fica limitada.
let filters: [string, unknown][];
let reads: number;

vi.mock("@/integrations/supabase/client.server", () => {
  const chain: Record<string, unknown> = new Proxy(
    {},
    {
      get(_, name: string) {
        if (name === "then") {
          return (ok: (value: unknown) => unknown) =>
            Promise.resolve({ data: [], error: null }).then(ok);
        }
        return (...args: unknown[]) => {
          if (name === "in") filters.push([String(args[0]), args[1]]);
          return chain;
        };
      },
    },
  );
  return {
    supabaseAdmin: {
      from: () => {
        reads += 1;
        return chain;
      },
    },
  };
});

const { runPendingJobs } = await import("./job-runner.server");

beforeEach(() => {
  filters = [];
  reads = 0;
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
