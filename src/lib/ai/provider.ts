/**
 * Camada própria de IA (AIProvider).
 *
 * O resto do produto pede "uma resposta em JSON a partir de um system prompt e
 * de um user prompt" e recebe um resultado tipado. Só este módulo e os
 * fornecedores em `./providers/` sabem que existe um endpoint, uma chave ou
 * um formato de resposta. Trocar de fornecedor é escrever um novo ficheiro
 * que cumpra a interface `AIProvider` e apontar `AI_PROVIDER` para ele.
 *
 * Só corre no servidor: a chave nunca chega ao browser.
 */
import { meterImage, meterTokens } from "./billing.server";
import { openAiProvider } from "./providers/openai.server";

export type AIErrorCode =
  /** Fornecedor desconhecido ou sem chave configurada. */
  | "not_configured"
  /** 401/403: chave inválida, revogada ou sem acesso ao modelo. */
  | "unauthorized"
  /** 429: limite de pedidos ou quota. */
  | "rate_limited"
  /** 5xx ou falha de rede: serviço indisponível. */
  | "unavailable"
  /** Sem resposta dentro do tempo limite. */
  | "timeout"
  /** O modelo respondeu, mas o texto não é JSON válido ou veio vazio/cortado. */
  | "invalid_json"
  /** Outro erro HTTP (por exemplo 400 por pedido inválido). */
  | "http_error";

export type ChatJsonInput = {
  system: string;
  user: string;
  /** Modelo a usar; sem valor, o fornecedor usa o seu modelo por omissão. */
  model?: string;
  /** Limite de tokens gerados, quando o fornecedor o suporta. */
  maxTokens?: number;
  /** Tempo máximo à espera de resposta completa. */
  timeoutMs?: number;
};

export type ChatJsonSuccess = {
  ok: true;
  /** Objeto JSON já parseado, sem cercas ```json. */
  json: unknown;
  /** Texto bruto devolvido pelo modelo. */
  text: string;
  provider: string;
  model: string;
  /** Tokens contados pelo fornecedor, para cobrar o custo real. */
  usage?: { inputTokens: number; outputTokens: number };
};

export type ChatJsonFailure = {
  ok: false;
  code: AIErrorCode;
  /** Código HTTP quando existiu resposta do fornecedor. */
  status: number | null;
  /** Frase em português, pronta para o utilizador, sem segredos nem código. */
  reason: string;
  /** Detalhe técnico devolvido pelo fornecedor, para logs (nunca contém a chave). */
  detail: string | null;
  provider: string;
  model: string;
};

export type ChatJsonResult = ChatJsonSuccess | ChatJsonFailure;

export type ImageInput = {
  prompt: string;
  /** Com streaming, o resultado traz eventos SSE com fotogramas parciais; sem, um JSON final. */
  stream?: boolean;
  /** Modelo de imagem; sem valor, o fornecedor usa `AI_IMAGE_MODEL` ou o seu modelo por omissão. */
  model?: string;
  /** Tempo máximo à espera do fornecedor (cabeçalhos no streaming; corpo completo sem streaming). */
  timeoutMs?: number;
};

/**
 * Corpo do fornecedor pronto a reencaminhar para o browser, no formato que o
 * editor já lê: `text/event-stream` com eventos `{ type, b64_json }` cujo tipo
 * final acaba em `.completed`, ou `application/json` com `{ data: [{ b64_json }] }`.
 */
export type ImageSuccess = {
  ok: true;
  body: ReadableStream<Uint8Array>;
  contentType: "text/event-stream" | "application/json";
  provider: string;
  model: string;
};

export type ImageFailure = ChatJsonFailure;

export type ImageResult = ImageSuccess | ImageFailure;

export interface AIProvider {
  readonly id: string;
  /** Há chave e configuração suficientes para fazer pedidos? */
  isConfigured(): boolean;
  /** Modelo usado quando a chamada não indica um. */
  defaultModel(): string;
  /** Pede uma resposta JSON. Nunca lança: devolve sempre um resultado tipado. */
  chatJson(input: ChatJsonInput): Promise<ChatJsonResult>;
  /** Gera uma imagem. Opcional: nem todos os fornecedores têm imagens. Nunca lança. */
  generateImage?(input: ImageInput): Promise<ImageResult>;
}

/** Tempo limite por omissão. Os prompts de análise são longos, por isso é generoso. */
export const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Erro lançável a partir de um resultado falhado, para os pontos do produto
 * que trabalham com exceções. A mensagem é a razão em português.
 */
export class AIError extends Error {
  readonly code: AIErrorCode;
  readonly status: number | null;
  readonly provider: string;
  readonly model: string;
  readonly detail: string | null;

  constructor(failure: ChatJsonFailure) {
    super(failure.reason);
    this.name = "AIError";
    this.code = failure.code;
    this.status = failure.status;
    this.provider = failure.provider;
    this.model = failure.model;
    this.detail = failure.detail;
  }
}

/**
 * Remove cercas ```json e extrai o primeiro objeto JSON do texto.
 * Devolve null quando não há JSON válido.
 */
export function parseJsonText(raw: string): unknown | null {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

/**
 * Frases para o utilizador. Evitam códigos e termos técnicos de propósito:
 * `friendlyError` substitui por uma frase genérica qualquer mensagem que
 * pareça técnica, e aqui queremos que a razão real chegue ao ecrã.
 */
export function describeFailure(code: AIErrorCode, status: number | null): string {
  switch (code) {
    case "not_configured":
      return "A ligação à IA não está configurada. Defina a chave do fornecedor no servidor.";
    case "unauthorized":
      return "A chave da IA foi recusada pelo fornecedor. Verifique a chave configurada no servidor.";
    case "rate_limited":
      return "A IA atingiu o limite de pedidos. Aguarde um pouco e tente outra vez.";
    case "unavailable":
      return "O serviço de IA está indisponível neste momento. Tente novamente daqui a pouco.";
    case "timeout":
      return "A IA demorou demasiado a responder. Tente novamente com um trecho mais curto.";
    case "invalid_json":
      return "A IA devolveu uma resposta sem a estrutura esperada. Tente gerar outra vez.";
    default:
      return status != null
        ? `A IA recusou o pedido (código ${status}).`
        : "A IA não conseguiu responder a este pedido.";
  }
}

/** Código de erro a partir do estado HTTP do fornecedor. */
export function codeFromStatus(status: number): AIErrorCode {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "unavailable";
  return "http_error";
}

function providerFor(id: string): AIProvider | null {
  // Import estático para o bundle do servidor conhecer todos os fornecedores.
  // Só se acrescentam aqui ficheiros de `./providers/`.
  if (id === "openai") return openAiProvider;
  return null;
}

/** Fornecedor escolhido por `AI_PROVIDER` (por omissão, `openai`). */
export function activeProvider(): AIProvider | null {
  const id = (process.env["AI_PROVIDER"] ?? "openai").trim().toLowerCase();
  return providerFor(id);
}

/** Identificador configurado, mesmo que não corresponda a nenhum fornecedor. */
export function activeProviderId(): string {
  return (process.env["AI_PROVIDER"] ?? "openai").trim().toLowerCase();
}

export function isConfigured(): boolean {
  const provider = activeProvider();
  return provider != null && provider.isConfigured();
}

/**
 * Ponto único de entrada: escolhe o fornecedor e devolve o resultado tipado.
 * Nunca lança. Quem precisar de exceções usa `AIError`.
 */
export async function chatJson(input: ChatJsonInput): Promise<ChatJsonResult> {
  const id = activeProviderId();
  const provider = providerFor(id);
  if (!provider) {
    return {
      ok: false,
      code: "not_configured",
      status: null,
      reason: describeFailure("not_configured", null),
      detail: `fornecedor desconhecido: ${id}`,
      provider: id,
      model: input.model ?? "",
    };
  }
  if (!provider.isConfigured()) {
    return {
      ok: false,
      code: "not_configured",
      status: null,
      reason: describeFailure("not_configured", null),
      detail: "chave em falta",
      provider: provider.id,
      model: input.model ?? provider.defaultModel(),
    };
  }
  const result = await provider.chatJson(input);
  if (result.ok) {
    // Sem contagem do fornecedor, estima-se ~4 caracteres por token.
    const usage = result.usage ?? {
      inputTokens: Math.ceil((input.system.length + input.user.length) / 4),
      outputTokens: Math.ceil(result.text.length / 4),
    };
    await meterTokens(usage.inputTokens, usage.outputTokens);
  }
  return result;
}

/** Ponto único de entrada para imagens. Nunca lança. */
export async function generateImage(input: ImageInput): Promise<ImageResult> {
  const id = activeProviderId();
  const provider = providerFor(id);
  const notConfigured = (detail: string): ImageFailure => ({
    ok: false,
    code: "not_configured",
    status: null,
    reason: describeFailure("not_configured", null),
    detail,
    provider: provider?.id ?? id,
    model: input.model ?? "",
  });
  if (!provider) return notConfigured(`fornecedor desconhecido: ${id}`);
  if (!provider.isConfigured()) return notConfigured("chave em falta");
  if (!provider.generateImage) return notConfigured(`o fornecedor ${provider.id} não gera imagens`);
  const result = await provider.generateImage(input);
  if (result.ok) await meterImage();
  return result;
}
