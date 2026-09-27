import { describe, expect, it } from "vitest";

import { modelPrice, providerOrder, ROUTES, tierModel } from "./models";
import { backoffMs, Breaker } from "./policy";

describe("espera entre tentativas", () => {
  it("cresce por tentativa e varia entre metade e uma vez e meia", () => {
    expect(backoffMs(1, () => 0)).toBe(250);
    expect(backoffMs(1, () => 1)).toBe(750);
    expect(backoffMs(2, () => 0.5)).toBe(1500);
    expect(backoffMs(3, () => 0.5)).toBe(4500);
  });
});

describe("disjuntor", () => {
  it("abre ao fim de 3 falhas seguidas e deixa testar depois do intervalo", () => {
    let now = 0;
    const breaker = new Breaker(3, 60_000, () => now);
    breaker.failure();
    breaker.failure();
    expect(breaker.state()).toBe("closed");
    breaker.failure();
    expect(breaker.state()).toBe("open");
    expect(breaker.allow()).toBe(false);
    now = 60_000;
    expect(breaker.state()).toBe("half_open");
    expect(breaker.allow()).toBe(true);
  });

  it("um teste falhado volta a abrir; um bem-sucedido fecha", () => {
    let now = 0;
    const breaker = new Breaker(3, 60_000, () => now);
    for (let i = 0; i < 3; i += 1) breaker.failure();
    now = 60_000;
    breaker.failure();
    expect(breaker.state()).toBe("open");
    now = 120_000;
    breaker.success();
    expect(breaker.state()).toBe("closed");
  });

  it("um sucesso pelo meio recomeça a contagem", () => {
    const breaker = new Breaker(3, 60_000, () => 0);
    breaker.failure();
    breaker.failure();
    breaker.success();
    breaker.failure();
    expect(breaker.state()).toBe("closed");
  });
});

describe("ordem dos fornecedores", () => {
  it("sem nada configurado, só a OpenAI, como antes", () => {
    expect(providerOrder({})).toEqual(["openai"]);
  });

  it("principal, reserva e segunda reserva, sem repetidos nem desconhecidos", () => {
    expect(
      providerOrder({
        AI_PROVIDER: "Gemini",
        AI_FALLBACK_PROVIDER: "anthropic",
        AI_FALLBACK_2_PROVIDER: "gemini",
      }),
    ).toEqual(["gemini", "anthropic"]);
    expect(providerOrder({ AI_PROVIDER: "outro", AI_FALLBACK_PROVIDER: "openai" })).toEqual([
      "openai",
    ]);
  });
});

describe("router", () => {
  it("tarefas simples nunca usam o modelo maior", () => {
    for (const task of ["classification", "intent", "summary"] as const) {
      expect(ROUTES[task].tier).toBe("fast");
    }
    expect(ROUTES.complex_reasoning.tier).toBe("capable");
  });

  it("modelo por nível lido do ambiente, com valores por omissão", () => {
    const defaults = { fast: "f", balanced: "b", capable: "c" };
    expect(tierModel("GEMINI", "fast", defaults, {})).toBe("f");
    expect(tierModel("GEMINI", "balanced", defaults, { GEMINI_MODEL: "x" })).toBe("x");
    expect(tierModel("GEMINI", "capable", defaults, { GEMINI_MODEL_CAPABLE: " y " })).toBe("y");
  });
});

describe("preço por modelo", () => {
  const env = {
    AI_MODEL_PRICES: '{"claude-haiku-4-5":[1,5]}',
    AI_CHAT_MODEL: "gpt-x",
    AI_PRICE_INPUT_PER_MTOK: "0.4",
    AI_PRICE_OUTPUT_PER_MTOK: "1.6",
  };

  it("usa a tabela e, para o modelo de AI_CHAT_MODEL, o preço geral", () => {
    expect(modelPrice("claude-haiku-4-5", env)).toEqual({ inputPerMTok: 1, outputPerMTok: 5 });
    expect(modelPrice("gpt-x", env)).toEqual({ inputPerMTok: 0.4, outputPerMTok: 1.6 });
  });

  it("preço desconhecido é null, nunca zero", () => {
    // O preço geral é o do modelo OpenAI configurado; não se aplica a outros modelos.
    expect(modelPrice("gemini-3.8-flash", env)).toBeNull();
    expect(modelPrice("gpt-x", { AI_CHAT_MODEL: "gpt-x" })).toBeNull();
    // Meio preço também é preço desconhecido.
    expect(
      modelPrice("gpt-x", { AI_CHAT_MODEL: "gpt-x", AI_PRICE_INPUT_PER_MTOK: "2" }),
    ).toBeNull();
    expect(modelPrice("m", { AI_MODEL_PRICES: '{"m":[1]}' })).toBeNull();
  });

  it("zero configurado de propósito é um preço conhecido", () => {
    expect(modelPrice("m", { AI_MODEL_PRICES: '{"m":[0,0]}' })).toEqual({
      inputPerMTok: 0,
      outputPerMTok: 0,
    });
  });

  it("tabela inválida não parte nada: os modelos ficam sem preço", () => {
    expect(modelPrice("m", { AI_MODEL_PRICES: "{" })).toBeNull();
  });
});
