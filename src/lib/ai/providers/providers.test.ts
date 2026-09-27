import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProviderRequest } from "../types";

/** O SDK da Anthropic simulado: guarda o pedido e devolve a mensagem que o teste preparar. */
const sdk = vi.hoisted(() => {
  class APIError extends Error {
    constructor(
      readonly status: number | undefined,
      message: string,
    ) {
      super(message);
    }
  }
  class APIConnectionError extends APIError {}
  class APIConnectionTimeoutError extends APIConnectionError {}
  class APIUserAbortError extends APIError {}
  const state: { params: Record<string, unknown> | null; reply: unknown } = {
    params: null,
    reply: null,
  };
  class Anthropic {
    static APIError = APIError;
    static APIConnectionError = APIConnectionError;
    static APIConnectionTimeoutError = APIConnectionTimeoutError;
    static APIUserAbortError = APIUserAbortError;
    beta = {
      messages: {
        stream: (params: Record<string, unknown>) => {
          state.params = params;
          return {
            finalMessage: async () => {
              if (state.reply instanceof Error) throw state.reply;
              return state.reply;
            },
          };
        },
      },
    };
  }
  return { Anthropic, APIError, state };
});
vi.mock("@anthropic-ai/sdk", () => ({ default: sdk.Anthropic }));

const { openAiProvider } = await import("./openai.server");
const { geminiProvider } = await import("./gemini.server");
const { anthropicProvider } = await import("./anthropic.server");

const request = (model: string): ProviderRequest => ({
  system: "sistema",
  user: "pedido",
  schema: { name: "coisa", schema: { type: "object", properties: {} } },
  model,
  maxOutputTokens: 4000,
  effort: "low",
  timeoutMs: 1000,
});

let sent: { url: string; init: RequestInit } | null = null;
function reply(status: number, body: unknown) {
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    sent = { url, init };
    return new Response(JSON.stringify(body), { status });
  });
}
const body = () => JSON.parse(String(sent!.init.body)) as Record<string, unknown>;

beforeEach(() => {
  process.env["OPENAI_API_KEY"] = "sk-test";
  process.env["GEMINI_API_KEY"] = "g-test";
  process.env["ANTHROPIC_API_KEY"] = "a-test";
  sent = null;
  sdk.state.params = null;
});
afterEach(() => vi.unstubAllGlobals());

describe("OpenAI", () => {
  const ok = (content: string, finish = "stop") => ({
    choices: [{ message: { content }, finish_reason: finish }],
    usage: { prompt_tokens: 12, completion_tokens: 3 },
  });

  it("pede saída estruturada estrita, com limite e esforço nos modelos de raciocínio", async () => {
    reply(200, ok('{"a":1}'));
    const result = await openAiProvider.complete(request("gpt-5.6-luna"));
    expect(result).toEqual({
      ok: true,
      json: { a: 1 },
      provider: "openai",
      model: "gpt-5.6-luna",
      usage: { inputTokens: 12, outputTokens: 3 },
    });
    expect(body()).toMatchObject({
      response_format: {
        type: "json_schema",
        json_schema: { name: "coisa", strict: true, schema: { type: "object" } },
      },
      max_completion_tokens: 4000,
      reasoning_effort: "low",
    });
  });

  it("modelos sem raciocínio não recebem o parâmetro de esforço", async () => {
    reply(200, ok("{}"));
    await openAiProvider.complete(request("gpt-4.1"));
    expect(body()).not.toHaveProperty("reasoning_effort");
  });

  it.each([
    [429, "rate_limited"],
    [401, "unauthorized"],
    [503, "unavailable"],
    [400, "http_error"],
  ])("HTTP %i vira %s", async (status, code) => {
    reply(status, { error: { message: "x" } });
    expect(await openAiProvider.complete(request("gpt-5.6-luna"))).toMatchObject({
      ok: false,
      code,
    });
  });

  it("recusa e resposta cortada não passam por objeto válido", async () => {
    reply(200, {
      choices: [{ message: { content: null, refusal: "não" }, finish_reason: "stop" }],
    });
    expect(await openAiProvider.complete(request("gpt-5.6-luna"))).toMatchObject({
      code: "refused",
    });
    reply(200, ok('{"a":', "length"));
    expect(await openAiProvider.complete(request("gpt-5.6-luna"))).toMatchObject({
      code: "invalid_json",
    });
  });

  it("tempo esgotado vira timeout e a chave nunca aparece no detalhe", async () => {
    vi.stubGlobal("fetch", async () => {
      throw Object.assign(new Error("sk-test demorou"), { name: "TimeoutError" });
    });
    expect(await openAiProvider.complete(request("gpt-5.6-luna"))).toMatchObject({
      code: "timeout",
    });
    vi.stubGlobal("fetch", async () => {
      throw new Error("ligação recusada com sk-test");
    });
    const result = await openAiProvider.complete(request("gpt-5.6-luna"));
    expect(result).toMatchObject({ code: "unavailable" });
    expect(JSON.stringify(result)).not.toContain("sk-test");
  });
});

describe("Gemini", () => {
  const ok = (text: string, finishReason = "STOP") => ({
    candidates: [
      { content: { parts: [{ text: "a pensar", thought: true }, { text }] }, finishReason },
    ],
    usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 5, thoughtsTokenCount: 7 },
  });

  it("pede JSON com o esquema, o limite e o nível de raciocínio", async () => {
    reply(200, ok('{"a":1}'));
    const result = await geminiProvider.complete(request("gemini-3.8-flash"));
    expect(result).toMatchObject({
      ok: true,
      json: { a: 1 },
      usage: { inputTokens: 20, outputTokens: 12 },
    });
    expect(sent!.url).toContain("/models/gemini-3.8-flash:generateContent");
    expect((sent!.init.headers as Record<string, string>)["x-goog-api-key"]).toBe("g-test");
    expect(body()).toMatchObject({
      systemInstruction: { parts: [{ text: "sistema" }] },
      contents: [{ role: "user", parts: [{ text: "pedido" }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: { type: "object" },
        maxOutputTokens: 4000,
        thinkingConfig: { thinkingLevel: "LOW" },
      },
    });
  });

  it("chave inválida conta como falha do fornecedor, apesar do HTTP 400", async () => {
    reply(400, {
      error: {
        code: 400,
        message: "API key not valid. Please pass a valid API key.",
        status: "INVALID_ARGUMENT",
        details: [{ reason: "API_KEY_INVALID" }],
      },
    });
    expect(await geminiProvider.complete(request("gemini-3.8-flash"))).toMatchObject({
      code: "unauthorized",
    });
    reply(400, { error: { message: "Invalid JSON payload", status: "INVALID_ARGUMENT" } });
    expect(await geminiProvider.complete(request("gemini-3.8-flash"))).toMatchObject({
      code: "http_error",
    });
  });

  it("bloqueio por segurança é recusa; limite de tokens é resposta cortada", async () => {
    reply(200, ok("", "SAFETY"));
    expect(await geminiProvider.complete(request("gemini-3.8-flash"))).toMatchObject({
      code: "refused",
    });
    reply(200, { promptFeedback: { blockReason: "OTHER" } });
    expect(await geminiProvider.complete(request("gemini-3.8-flash"))).toMatchObject({
      code: "refused",
    });
    reply(200, ok('{"a"', "MAX_TOKENS"));
    expect(await geminiProvider.complete(request("gemini-3.8-flash"))).toMatchObject({
      code: "invalid_json",
    });
  });
});

describe("Anthropic", () => {
  const message = (text: string, stop_reason = "end_turn") => ({
    model: "claude-sonnet-5",
    stop_reason,
    content: [{ type: "text", text }],
    usage: { input_tokens: 30, output_tokens: 4, cache_read_input_tokens: 10 },
  });

  it("pede saída estruturada e esforço nos modelos que o aceitam", async () => {
    sdk.state.reply = message('{"a":1}');
    const result = await anthropicProvider.complete(request("claude-sonnet-5"));
    expect(result).toMatchObject({
      ok: true,
      json: { a: 1 },
      usage: { inputTokens: 40, outputTokens: 4 },
    });
    expect(sdk.state.params).toMatchObject({
      model: "claude-sonnet-5",
      max_tokens: 4000,
      system: "sistema",
      messages: [{ role: "user", content: "pedido" }],
      output_config: { format: { type: "json_schema", schema: { type: "object" } }, effort: "low" },
    });
    expect(sdk.state.params).not.toHaveProperty("fallbacks");
  });

  it("o Haiku não recebe esforço", async () => {
    sdk.state.reply = message("{}");
    await anthropicProvider.complete(request("claude-haiku-4-5"));
    expect(sdk.state.params!["output_config"]).not.toHaveProperty("effort");
  });

  it("a reserva interna para recusas só existe quando é pedida", async () => {
    sdk.state.reply = message("{}");
    delete process.env["ANTHROPIC_REFUSAL_FALLBACK"];
    await anthropicProvider.complete(request("claude-opus-5"));
    expect(sdk.state.params).not.toHaveProperty("fallbacks");
    expect(sdk.state.params).not.toHaveProperty("betas");
    process.env["ANTHROPIC_REFUSAL_FALLBACK"] = "on";
    await anthropicProvider.complete(request("claude-opus-5"));
    expect(sdk.state.params).toMatchObject({
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    delete process.env["ANTHROPIC_REFUSAL_FALLBACK"];
  });

  it("recusa, corte e erros do SDK viram os códigos comuns", async () => {
    sdk.state.reply = message("", "refusal");
    expect(await anthropicProvider.complete(request("claude-sonnet-5"))).toMatchObject({
      code: "refused",
    });
    sdk.state.reply = message('{"a"', "max_tokens");
    expect(await anthropicProvider.complete(request("claude-sonnet-5"))).toMatchObject({
      code: "invalid_json",
    });
    sdk.state.reply = new sdk.APIError(529, "sobrecarregado");
    expect(await anthropicProvider.complete(request("claude-sonnet-5"))).toMatchObject({
      code: "unavailable",
    });
    sdk.state.reply = new sdk.APIError(401, "chave");
    expect(await anthropicProvider.complete(request("claude-sonnet-5"))).toMatchObject({
      code: "unauthorized",
    });
  });
});
