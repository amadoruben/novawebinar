/**
 * Fornecedor OpenAI, por `fetch` directo, sem SDK.
 *
 * Endpoint: Chat Completions com `response_format: { type: "json_object" }`.
 * Todos os prompts do produto pedem JSON explicitamente, como a OpenAI exige
 * para este modo.
 *
 * Configuração (só no servidor):
 *   OPENAI_API_KEY   chave da OpenAI (obrigatória)
 *   AI_CHAT_MODEL    modelo (por omissão `gpt-5.6-luna`)
 *   AI_BASE_URL      base alternativa compatível com a API da OpenAI (opcional)
 */
import {
  DEFAULT_TIMEOUT_MS,
  codeFromStatus,
  describeFailure,
  parseJsonText,
  type AIErrorCode,
  type AIProvider,
  type ChatJsonFailure,
  type ChatJsonInput,
  type ChatJsonResult,
  type ImageInput,
  type ImageResult,
} from "../provider";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-5.6-luna";
/** Modelo de imagem por omissão; `AI_IMAGE_MODEL` substitui-o. */
const DEFAULT_IMAGE_MODEL = "gpt-image-1";
/** Fotogramas parciais pedidos no streaming (o editor mostra-os desfocados até ao final). */
const PARTIAL_IMAGES = 2;

type ChatCompletion = {
  choices?: { message?: { content?: string | null }; finish_reason?: string | null }[];
  error?: { message?: string; type?: string; code?: string | null } | null;
};

function apiKey(): string {
  return process.env["OPENAI_API_KEY"]?.trim() ?? "";
}

function baseUrl(): string {
  const configured = process.env["AI_BASE_URL"]?.trim();
  return (configured || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function model(): string {
  return process.env["AI_CHAT_MODEL"]?.trim() || DEFAULT_MODEL;
}

function imageModel(): string {
  return process.env["AI_IMAGE_MODEL"]?.trim() || DEFAULT_IMAGE_MODEL;
}

/** Nunca deixa a chave, nem fragmentos dela, passar para logs ou mensagens. */
function redact(text: string): string {
  const key = apiKey();
  const withoutKey = key ? text.split(key).join("[redacted]") : text;
  return withoutKey.replace(/sk-[A-Za-z0-9_*-]{4,}/g, "[redacted]");
}

function failure(
  code: AIErrorCode,
  status: number | null,
  detail: string | null,
  used: string,
): ChatJsonFailure {
  return {
    ok: false,
    code,
    status,
    reason: describeFailure(code, status),
    detail: detail ? redact(detail).slice(0, 300) : null,
    provider: "openai",
    model: used,
  };
}

export const openAiProvider: AIProvider = {
  id: "openai",

  isConfigured() {
    return apiKey().length > 0;
  },

  defaultModel() {
    return model();
  },

  async chatJson(input: ChatJsonInput): Promise<ChatJsonResult> {
    const used = input.model?.trim() || model();
    const key = apiKey();
    if (!key) return failure("not_configured", null, "chave em falta", used);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${baseUrl()}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: used,
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: input.user },
          ],
          response_format: { type: "json_object" },
          ...(input.maxTokens ? { max_completion_tokens: input.maxTokens } : {}),
        }),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timer);
      const aborted = (error as Error)?.name === "AbortError";
      return failure(
        aborted ? "timeout" : "unavailable",
        null,
        aborted ? "sem resposta dentro do tempo limite" : String((error as Error)?.message ?? error),
        used,
      );
    }

    let raw = "";
    try {
      raw = await response.text();
    } catch (error) {
      clearTimeout(timer);
      const aborted = (error as Error)?.name === "AbortError";
      return failure(aborted ? "timeout" : "unavailable", response.status, null, used);
    }
    clearTimeout(timer);

    let payload: ChatCompletion = {};
    try {
      payload = raw ? (JSON.parse(raw) as ChatCompletion) : {};
    } catch {
      payload = {};
    }

    if (!response.ok) {
      const detail = payload.error?.message || raw.slice(0, 300) || response.statusText;
      return failure(codeFromStatus(response.status), response.status, detail, used);
    }

    const choice = payload.choices?.[0];
    const text = (choice?.message?.content ?? "").trim();
    if (!text) {
      return failure("invalid_json", response.status, "resposta vazia", used);
    }
    const json = parseJsonText(text);
    if (json == null || typeof json !== "object") {
      const cut = choice?.finish_reason === "length" ? "resposta cortada pelo limite de tokens" : null;
      return failure("invalid_json", response.status, cut ?? "texto sem JSON válido", used);
    }

    return { ok: true, json, text, provider: "openai", model: used };
  },

  /**
   * Imagens pelo endpoint `/images/generations`. Com `stream`, a OpenAI emite
   * SSE `data: { type: "image_generation.partial_image" | "image_generation.completed", b64_json }`,
   * exactamente o que `stream-image.ts` lê; sem `stream`, devolve `{ data: [{ b64_json }] }`.
   * O corpo é reencaminhado tal e qual: nada é descodificado no servidor.
   */
  async generateImage(input: ImageInput): Promise<ImageResult> {
    const used = input.model?.trim() || imageModel();
    const key = apiKey();
    if (!key) return failure("not_configured", null, "chave em falta", used);
    const stream = input.stream !== false;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${baseUrl()}/images/generations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: used,
          prompt: input.prompt,
          ...(stream ? { stream: true, partial_images: PARTIAL_IMAGES } : {}),
        }),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timer);
      const aborted = (error as Error)?.name === "AbortError";
      return failure(
        aborted ? "timeout" : "unavailable",
        null,
        aborted ? "sem resposta dentro do tempo limite" : String((error as Error)?.message ?? error),
        used,
      );
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
      return failure(codeFromStatus(response.status), response.status, detail, used);
    }

    if (stream) {
      // Os cabeçalhos chegaram: o resto flui para o browser sem limite de tempo aqui.
      clearTimeout(timer);
      return { ok: true, body: response.body, contentType: "text/event-stream", provider: "openai", model: used };
    }

    let raw = "";
    try {
      raw = await response.text();
    } catch (error) {
      clearTimeout(timer);
      const aborted = (error as Error)?.name === "AbortError";
      return failure(aborted ? "timeout" : "unavailable", response.status, null, used);
    }
    clearTimeout(timer);
    return {
      ok: true,
      body: new Blob([raw]).stream() as ReadableStream<Uint8Array>,
      contentType: "application/json",
      provider: "openai",
      model: used,
    };
  },
};
