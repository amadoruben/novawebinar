/**
 * Fornecedor OpenAI, por `fetch` directo, sem SDK.
 *
 * Texto: Chat Completions com saída estruturada (`json_schema`, estrita).
 * Imagens: `/images/generations`.
 *
 * Configuração (só no servidor):
 *   OPENAI_API_KEY        chave (obrigatória)
 *   AI_CHAT_MODEL         modelo de todos os níveis (por omissão `gpt-5.6-luna`)
 *   OPENAI_MODEL_FAST / OPENAI_MODEL / OPENAI_MODEL_CAPABLE   modelo por nível
 *   AI_BASE_URL           base alternativa compatível com a API da OpenAI
 *   AI_IMAGE_MODEL        modelo de imagens (por omissão `gpt-image-1`)
 */
import { OPENAI_DEFAULT_MODEL, tierModel } from "../models";
import {
  codeFromStatus,
  failure,
  readObject,
  type AIErrorCode,
  type AIModelProvider,
  type ChatJsonResult,
  type ImageInput,
  type ImageResult,
  type ProviderRequest,
} from "../types";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_IMAGE_MODEL = "gpt-image-1";
/** Fotogramas parciais pedidos no streaming (o editor mostra-os desfocados até ao final). */
const PARTIAL_IMAGES = 2;

type ChatCompletion = {
  choices?: {
    message?: { content?: string | null; refusal?: string | null };
    finish_reason?: string | null;
  }[];
  error?: { message?: string } | null;
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
};

const apiKey = () => process.env["OPENAI_API_KEY"]?.trim() ?? "";
const baseUrl = () => (process.env["AI_BASE_URL"]?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");

/** Nunca deixa a chave, nem fragmentos dela, passar para logs ou mensagens. */
function redact(text: string): string {
  const key = apiKey();
  const withoutKey = key ? text.split(key).join("[redacted]") : text;
  return withoutKey.replace(/sk-[A-Za-z0-9_*-]{4,}/g, "[redacted]");
}

const fail = (model: string, code: AIErrorCode, status: number | null, detail: string | null) =>
  failure("openai", model, code, status, detail ? redact(detail) : null);

/** Falha de rede ou tempo esgotado antes de haver resposta. */
function networkFailure(model: string, error: unknown) {
  const name = (error as Error)?.name;
  return name === "TimeoutError" || name === "AbortError"
    ? fail(model, "timeout", null, "sem resposta dentro do tempo limite")
    : fail(model, "unavailable", null, String((error as Error)?.message ?? error));
}

/** Os modelos de raciocínio aceitam o nível de esforço; os outros recusam o parâmetro. */
const reasons = (model: string) => /^(gpt-5|o\d)/.test(model);

export const openAiProvider: AIModelProvider = {
  id: "openai",

  isConfigured() {
    return apiKey().length > 0;
  },

  model(tier) {
    const all = process.env["AI_CHAT_MODEL"]?.trim() || OPENAI_DEFAULT_MODEL;
    return tierModel("OPENAI", tier, { fast: all, balanced: all, capable: all });
  },

  async complete(request: ProviderRequest): Promise<ChatJsonResult> {
    const { model } = request;
    let response: Response;
    let raw = "";
    try {
      response = await fetch(`${baseUrl()}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: request.schema.name, schema: request.schema.schema, strict: true },
          },
          max_completion_tokens: request.maxOutputTokens,
          ...(reasons(model) ? { reasoning_effort: request.effort } : {}),
        }),
        signal: AbortSignal.timeout(request.timeoutMs),
      });
      raw = await response.text();
    } catch (error) {
      return networkFailure(model, error);
    }

    let payload: ChatCompletion = {};
    try {
      payload = raw ? (JSON.parse(raw) as ChatCompletion) : {};
    } catch {
      payload = {};
    }
    if (!response.ok) {
      const detail = payload.error?.message || raw.slice(0, 300) || response.statusText;
      return fail(model, codeFromStatus(response.status), response.status, detail);
    }

    const choice = payload.choices?.[0];
    if (choice?.message?.refusal)
      return fail(model, "refused", response.status, choice.message.refusal);
    if (choice?.finish_reason === "length") {
      return fail(model, "invalid_json", response.status, "resposta cortada pelo limite de tokens");
    }
    const json = readObject(choice?.message?.content ?? "");
    if (!json) return fail(model, "invalid_json", response.status, "resposta sem o objeto pedido");

    return {
      ok: true,
      json,
      provider: "openai",
      model,
      ...(payload.usage
        ? {
            usage: {
              inputTokens: payload.usage.prompt_tokens ?? 0,
              outputTokens: payload.usage.completion_tokens ?? 0,
            },
          }
        : {}),
    };
  },

  /**
   * Com `stream`, a OpenAI emite SSE `data: { type: "image_generation.partial_image"
   * | "image_generation.completed", b64_json }`, que o browser lê tal e qual;
   * sem `stream`, devolve `{ data: [{ b64_json }] }`. O corpo é reencaminhado
   * tal e qual: nada é descodificado no servidor.
   */
  async generateImage(input: ImageInput & { timeoutMs: number }): Promise<ImageResult> {
    const model = process.env["AI_IMAGE_MODEL"]?.trim() || DEFAULT_IMAGE_MODEL;
    const stream = input.stream !== false;
    // Só até chegarem os cabeçalhos: depois disso o corpo flui para o browser sem limite aqui.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${baseUrl()}/images/generations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt: input.prompt,
          ...(stream ? { stream: true, partial_images: PARTIAL_IMAGES } : {}),
        }),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timer);
      return networkFailure(model, error);
    }

    if (!response.ok || !response.body) {
      const raw = await response.text().catch(() => "");
      clearTimeout(timer);
      let detail = raw.slice(0, 300) || response.statusText;
      try {
        const parsed = JSON.parse(raw) as { error?: { message?: string } };
        if (parsed.error?.message) detail = parsed.error.message;
      } catch {
        /* corpo não é JSON: fica o texto */
      }
      return fail(model, codeFromStatus(response.status), response.status, detail);
    }

    if (stream) {
      clearTimeout(timer);
      return {
        ok: true,
        body: response.body,
        contentType: "text/event-stream",
        provider: "openai",
        model,
      };
    }

    let raw = "";
    try {
      raw = await response.text();
    } catch (error) {
      clearTimeout(timer);
      return networkFailure(model, error);
    }
    clearTimeout(timer);
    return {
      ok: true,
      body: new Blob([raw]).stream() as ReadableStream<Uint8Array>,
      contentType: "application/json",
      provider: "openai",
      model,
    };
  },
};
