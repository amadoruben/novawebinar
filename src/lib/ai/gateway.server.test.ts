import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AIErrorCode, ChatJsonResult, ProviderRequest } from "./types";

/**
 * Fornecedores simulados: cada um responde pela fila de resultados que o
 * teste lhe der e regista o pedido que recebeu.
 */
type Script = { configured: boolean; replies: (AIErrorCode | "ok")[]; calls: ProviderRequest[] };
const scripts: Record<string, Script> = {};

function fake(id: string) {
  return {
    id,
    isConfigured: () => scripts[id]!.configured,
    model: (tier: string) => `${id}-${tier}`,
    complete: async (request: ProviderRequest): Promise<ChatJsonResult> => {
      const script = scripts[id]!;
      script.calls.push(request);
      const reply = script.replies.shift() ?? "ok";
      if (reply === "ok") {
        return {
          ok: true,
          json: { from: id },
          provider: id,
          model: request.model,
          usage: { inputTokens: 100, outputTokens: 10 },
        };
      }
      return {
        ok: false,
        code: reply,
        status: null,
        reason: reply,
        detail: null,
        provider: id,
        model: request.model,
      };
    },
  };
}

vi.mock("./providers/openai.server", () => ({ openAiProvider: fake("openai") }));
vi.mock("./providers/gemini.server", () => ({ geminiProvider: fake("gemini") }));
vi.mock("./providers/anthropic.server", () => ({ anthropicProvider: fake("anthropic") }));

const metered: unknown[][] = [];
vi.mock("./billing.server", () => ({
  currentOrganizationId: async () => "org-1",
  meterTokens: async (...args: unknown[]) => void metered.push(args),
  meterImage: async () => undefined,
  // Só o modelo da reserva tem preço nestes testes.
  providerCostMicros: (model: string) => (model === "gemini-fast" ? 42 : null),
}));

const logged: Record<string, unknown>[] = [];
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        logged.push(row);
        return { error: null };
      },
    }),
  },
}));

// Sem esperas reais entre tentativas.
vi.mock("./policy", async (original) => ({
  ...(await original<typeof import("./policy")>()),
  backoffMs: () => 0,
}));

const gateway = await import("./gateway.server");

const ask = () =>
  gateway.chatJson({
    task: "classification",
    system: "s",
    user: "u",
    schema: { name: "x", schema: { type: "object" } },
  });

beforeEach(() => {
  for (const id of ["openai", "gemini", "anthropic"]) {
    scripts[id] = { configured: true, replies: [], calls: [] };
  }
  metered.length = 0;
  logged.length = 0;
  process.env["AI_PROVIDER"] = "openai";
  process.env["AI_FALLBACK_PROVIDER"] = "gemini";
  process.env["AI_FALLBACK_2_PROVIDER"] = "anthropic";
  process.env["AI_MODEL_PRICES"] = '{"gemini-fast":[1,5]}';
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("gateway de IA", () => {
  it("usa o principal, com o modelo, o esforço e os limites da tarefa", async () => {
    const result = await ask();
    expect(result).toMatchObject({ ok: true, provider: "openai", json: { from: "openai" } });
    expect(scripts["openai"]!.calls[0]).toMatchObject({
      model: "openai-fast",
      effort: "low",
      maxOutputTokens: 8000,
      timeoutMs: 60000,
    });
    expect(scripts["gemini"]!.calls).toHaveLength(0);
    expect(metered).toEqual([["openai-fast", 100, 10]]);
  });

  it("falha passageira repete no mesmo fornecedor e depois passa à reserva", async () => {
    scripts["openai"]!.replies = ["unavailable", "timeout"];
    const result = await ask();
    expect(result).toMatchObject({ ok: true, provider: "gemini" });
    expect(scripts["openai"]!.calls).toHaveLength(2);
    await vi.waitFor(() => expect(logged).toHaveLength(3));
    expect(
      logged.map((row) => [row["provider"], row["outcome"], row["attempt"], row["fallback"]]),
    ).toEqual([
      ["openai", "error", 1, false],
      ["openai", "error", 2, false],
      ["gemini", "ok", 1, true],
    ]);
    expect(logged[2]).toMatchObject({
      organization_id: "org-1",
      cost_micros: 42,
      pricing_status: "known",
      is_test: false,
      task: "classification",
    });
    // Sem preço configurado, ou sem tokens contados, o custo fica por saber.
    expect(logged[0]).toMatchObject({ cost_micros: null, pricing_status: "unknown" });
  });

  it("chamadas feitas por testes ficam marcadas como teste", async () => {
    process.env["AI_TEST_RUN"] = "1";
    await ask();
    delete process.env["AI_TEST_RUN"];
    await vi.waitFor(() => expect(logged).toHaveLength(1));
    expect(logged[0]).toMatchObject({
      is_test: true,
      pricing_status: "unknown",
      cost_micros: null,
    });
  });

  it("chave recusada ou pedido inválido não se repetem: vai logo à reserva", async () => {
    scripts["openai"]!.replies = ["unauthorized"];
    scripts["gemini"]!.replies = ["invalid_json"];
    const result = await ask();
    expect(result).toMatchObject({ ok: true, provider: "anthropic" });
    expect(scripts["openai"]!.calls).toHaveLength(1);
    expect(scripts["gemini"]!.calls).toHaveLength(1);
  });

  it("sem nenhum a responder, devolve a última falha, sem lançar", async () => {
    scripts["openai"]!.replies = ["refused"];
    scripts["gemini"]!.replies = ["refused"];
    scripts["anthropic"]!.replies = ["refused"];
    const result = await ask();
    expect(result).toMatchObject({ ok: false, code: "refused", provider: "anthropic" });
    expect(metered).toHaveLength(0);
  });

  it("fornecedores sem chave ficam de fora", async () => {
    scripts["openai"]!.configured = false;
    const result = await ask();
    expect(result).toMatchObject({ ok: true, provider: "gemini" });
  });

  it("sem nenhum fornecedor configurado responde not_configured", async () => {
    for (const id of ["openai", "gemini", "anthropic"]) scripts[id]!.configured = false;
    expect(await ask()).toMatchObject({ ok: false, code: "not_configured" });
    expect(gateway.isConfigured()).toBe(false);
  });

  it("depois de 3 falhas do fornecedor, o disjuntor salta-o", async () => {
    process.env["AI_PROVIDER"] = "anthropic";
    process.env["AI_FALLBACK_PROVIDER"] = "gemini";
    delete process.env["AI_FALLBACK_2_PROVIDER"];
    scripts["anthropic"]!.replies = ["unavailable", "unavailable", "unavailable"];
    await ask();
    await ask();
    expect(scripts["anthropic"]!.calls).toHaveLength(3);
    const third = await ask();
    expect(third).toMatchObject({ ok: true, provider: "gemini" });
    expect(scripts["anthropic"]!.calls).toHaveLength(3);
    expect(gateway.providerStatus().find((p) => p.id === "anthropic")?.breaker).toBe("open");
  });
});
