/**
 * Fornecedor Anthropic (Claude), pelo SDK oficial, com saída estruturada
 * (`output_config.format`).
 *
 * Configuração (só no servidor):
 *   ANTHROPIC_API_KEY     chave (obrigatória)
 *   ANTHROPIC_MODEL_FAST / ANTHROPIC_MODEL / ANTHROPIC_MODEL_CAPABLE   modelo por nível
 *   ANTHROPIC_REFUSAL_FALLBACK=on   reserva da própria Anthropic para recusas (desligada)
 */
import type Anthropic from "@anthropic-ai/sdk";

import { tierModel } from "../models";
import {
  codeFromStatus,
  failure,
  readObject,
  type AIErrorCode,
  type AIModelProvider,
  type ChatJsonResult,
  type ProviderRequest,
} from "../types";

const DEFAULTS = {
  fast: "claude-haiku-4-5",
  balanced: "claude-sonnet-5",
  capable: "claude-opus-5",
};

/** O nível de esforço existe nestes modelos; o Haiku 4.5 recusa-o. */
const takesEffort = (model: string) =>
  /^claude-(opus-4-[6-9]|opus-5|sonnet-4-6|sonnet-5|fable)/.test(model);

/**
 * Reserva da própria Anthropic: uma recusa por política repete-se sozinha
 * noutro modelo Claude dentro do mesmo pedido. Desligada por omissão, porque
 * a cadeia de reservas é do gateway e esta chamada extra ficaria escondida.
 */
const refusalFallback = (model: string) =>
  process.env["ANTHROPIC_REFUSAL_FALLBACK"] === "on" && /^claude-(opus-5|fable)/.test(model);

const apiKey = () => process.env["ANTHROPIC_API_KEY"]?.trim() ?? "";

/**
 * O SDK só se carrega na primeira chamada. Importado no topo, entrava no
 * mesmo pedaço do bundle que as server functions e partia o arranque do
 * servidor de produção (ciclo de imports no rolldown).
 */
let loaded: Promise<typeof Anthropic> | null = null;
const sdkClass = () => (loaded ??= import("@anthropic-ai/sdk").then((m) => m.default));

let client: Anthropic | null = null;
let clientKey = "";
async function sdk() {
  const key = apiKey();
  if (!client || clientKey !== key) {
    const Sdk = await sdkClass();
    // As repetições e o tempo limite são do gateway.
    client = new Sdk({ apiKey: key, maxRetries: 0 });
    clientKey = key;
  }
  return client;
}

const fail = (model: string, code: AIErrorCode, status: number | null, detail: string | null) =>
  failure("anthropic", model, code, status, detail);

export const anthropicProvider: AIModelProvider = {
  id: "anthropic",

  isConfigured() {
    return apiKey().length > 0;
  },

  model(tier) {
    return tierModel("ANTHROPIC", tier, DEFAULTS);
  },

  async complete(request: ProviderRequest): Promise<ChatJsonResult> {
    const { model } = request;
    let message: Anthropic.Beta.BetaMessage;
    const Sdk = await sdkClass();
    try {
      // Em streaming: respostas longas passariam o tempo limite do SDK sem ele.
      const stream = (await sdk()).beta.messages.stream(
        {
          model,
          max_tokens: request.maxOutputTokens,
          system: request.system,
          messages: [{ role: "user", content: request.user }],
          output_config: {
            format: { type: "json_schema", schema: request.schema.schema },
            ...(takesEffort(model) ? { effort: request.effort } : {}),
          },
          ...(refusalFallback(model)
            ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
            : {}),
        },
        { signal: AbortSignal.timeout(request.timeoutMs) },
      );
      message = await stream.finalMessage();
    } catch (error) {
      if (error instanceof Sdk.APIConnectionTimeoutError) {
        return fail(model, "timeout", null, "sem resposta dentro do tempo limite");
      }
      if (error instanceof Sdk.APIUserAbortError || (error as Error)?.name === "TimeoutError") {
        return fail(model, "timeout", null, "sem resposta dentro do tempo limite");
      }
      if (error instanceof Sdk.APIConnectionError) {
        return fail(model, "unavailable", null, error.message);
      }
      if (error instanceof Sdk.APIError && typeof error.status === "number") {
        return fail(model, codeFromStatus(error.status), error.status, error.message);
      }
      return fail(model, "unavailable", null, String((error as Error)?.message ?? error));
    }

    if (message.stop_reason === "refusal") {
      return fail(model, "refused", 200, message.stop_details?.category ?? "recusa");
    }
    if (message.stop_reason === "max_tokens") {
      return fail(model, "invalid_json", 200, "resposta cortada pelo limite de tokens");
    }
    const text = message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
    const json = readObject(text);
    if (!json) return fail(model, "invalid_json", 200, "resposta sem o objeto pedido");

    const usage = message.usage;
    return {
      ok: true,
      json,
      provider: "anthropic",
      model: message.model || model,
      usage: {
        inputTokens:
          usage.input_tokens +
          (usage.cache_creation_input_tokens ?? 0) +
          (usage.cache_read_input_tokens ?? 0),
        outputTokens: usage.output_tokens,
      },
    };
  },
};
