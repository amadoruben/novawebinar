/**
 * Fornecedor Google Gemini, por `fetch` directo à Gemini API (`generateContent`),
 * com saída estruturada (`responseJsonSchema`).
 *
 * Configuração (só no servidor):
 *   GEMINI_API_KEY        chave (obrigatória)
 *   GEMINI_MODEL_FAST / GEMINI_MODEL / GEMINI_MODEL_CAPABLE   modelo por nível
 */
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

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULTS = {
  fast: "gemini-3.5-flash-lite",
  balanced: "gemini-3.8-flash",
  capable: "gemini-3.8-pro",
};

/** Motivos de paragem que são recusas por política, não falhas técnicas. */
const BLOCKED = ["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"];

type GenerateContent = {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
  error?: { message?: string };
};

const apiKey = () => process.env["GEMINI_API_KEY"]?.trim() ?? "";

const fail = (model: string, code: AIErrorCode, status: number | null, detail: string | null) =>
  failure("gemini", model, code, status, detail);

export const geminiProvider: AIModelProvider = {
  id: "gemini",

  isConfigured() {
    return apiKey().length > 0;
  },

  model(tier) {
    return tierModel("GEMINI", tier, DEFAULTS);
  },

  async complete(request: ProviderRequest): Promise<ChatJsonResult> {
    const { model } = request;
    let response: Response;
    let raw = "";
    try {
      response = await fetch(`${BASE_URL}/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey(), "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.system }] },
          contents: [{ role: "user", parts: [{ text: request.user }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: request.schema.schema,
            maxOutputTokens: request.maxOutputTokens,
            // O nível de raciocínio existe a partir da geração 3.
            ...(model.startsWith("gemini-3")
              ? { thinkingConfig: { thinkingLevel: request.effort.toUpperCase() } }
              : {}),
          },
        }),
        signal: AbortSignal.timeout(request.timeoutMs),
      });
      raw = await response.text();
    } catch (error) {
      const name = (error as Error)?.name;
      return name === "TimeoutError" || name === "AbortError"
        ? fail(model, "timeout", null, "sem resposta dentro do tempo limite")
        : fail(model, "unavailable", null, String((error as Error)?.message ?? error));
    }

    let payload: GenerateContent = {};
    try {
      payload = raw ? (JSON.parse(raw) as GenerateContent) : {};
    } catch {
      payload = {};
    }
    if (!response.ok) {
      const detail = payload.error?.message || raw.slice(0, 300) || response.statusText;
      // A Gemini responde 400 a uma chave inválida; é um problema do fornecedor, não do pedido.
      const code = raw.includes("API_KEY_INVALID")
        ? "unauthorized"
        : codeFromStatus(response.status);
      return fail(model, code, response.status, detail);
    }

    if (payload.promptFeedback?.blockReason) {
      return fail(model, "refused", response.status, payload.promptFeedback.blockReason);
    }
    const candidate = payload.candidates?.[0];
    const reason = candidate?.finishReason ?? "";
    if (BLOCKED.includes(reason)) return fail(model, "refused", response.status, reason);
    if (reason === "MAX_TOKENS") {
      return fail(model, "invalid_json", response.status, "resposta cortada pelo limite de tokens");
    }
    const text = (candidate?.content?.parts ?? [])
      .filter((part) => !part.thought)
      .map((part) => part.text ?? "")
      .join("");
    const json = readObject(text);
    if (!json) return fail(model, "invalid_json", response.status, "resposta sem o objeto pedido");

    const usage = payload.usageMetadata;
    return {
      ok: true,
      json,
      provider: "gemini",
      model,
      ...(usage
        ? {
            usage: {
              inputTokens: usage.promptTokenCount ?? 0,
              // O raciocínio é cobrado como saída.
              outputTokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
            },
          }
        : {}),
    };
  },
};
