/**
 * Contrato comum da camada de IA: o que o produto pede, o que recebe e o que
 * cada fornecedor (`AIModelProvider`) tem de cumprir. Nenhum fornecedor aqui.
 */

export const PROVIDER_IDS = ["openai", "gemini", "anthropic"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

/** O que o pedido faz; o router escolhe modelo, limites e esforço a partir daqui. */
export const AI_TASKS = [
  "classification",
  "intent",
  "summary",
  "chat",
  "generation",
  "analysis",
  "complex_reasoning",
] as const;
export type AITask = (typeof AI_TASKS)[number];

/** Nível de modelo de cada fornecedor: rápido e barato, equilibrado, o mais capaz. */
export type Tier = "fast" | "balanced" | "capable";
export type Effort = "low" | "medium" | "high";

export type AIErrorCode =
  /** Fornecedor desconhecido ou sem chave configurada. */
  | "not_configured"
  /** 401/403: chave inválida, revogada ou sem acesso ao modelo. */
  | "unauthorized"
  /** 429: limite de pedidos ou quota. */
  | "rate_limited"
  /** 5xx, falha de rede ou disjuntor aberto: serviço indisponível. */
  | "unavailable"
  /** Sem resposta dentro do tempo limite. */
  | "timeout"
  /** O modelo respondeu, mas sem o objeto pedido (vazio, cortado ou inválido). */
  | "invalid_json"
  /** O fornecedor recusou responder por política de segurança. */
  | "refused"
  /** Outro erro HTTP (por exemplo 400 por pedido inválido). */
  | "http_error";

/**
 * Forma da resposta em JSON Schema: objetos com `additionalProperties: false`
 * e todas as chaves em `required`, sem limites numéricos nem de texto (é o
 * que os três fornecedores aceitam em modo estrito). Ver `./schema.ts`.
 */
export type JsonSchema = { name: string; schema: Record<string, unknown> };

export type ChatJsonInput = {
  task: AITask;
  system: string;
  user: string;
  schema: JsonSchema;
};

export type Usage = { inputTokens: number; outputTokens: number };

export type ChatJsonSuccess = {
  ok: true;
  /** O objeto pedido, já lido e na forma do esquema. */
  json: Record<string, unknown>;
  provider: string;
  model: string;
  /** Tokens contados pelo fornecedor, para cobrar o custo real. */
  usage?: Usage;
};

export type ChatJsonFailure = {
  ok: false;
  code: AIErrorCode;
  /** Código HTTP quando existiu resposta do fornecedor. */
  status: number | null;
  /** Frase em português, pronta para o utilizador, sem segredos nem código. */
  reason: string;
  /** Detalhe técnico para logs (nunca contém a chave). */
  detail: string | null;
  provider: string;
  model: string;
};

export type ChatJsonResult = ChatJsonSuccess | ChatJsonFailure;

/** O pedido já decidido pelo router, tal como chega a um fornecedor. */
export type ProviderRequest = {
  system: string;
  user: string;
  schema: JsonSchema;
  model: string;
  maxOutputTokens: number;
  effort: Effort;
  timeoutMs: number;
};

export type ImageInput = {
  prompt: string;
  /** Com streaming, o resultado traz eventos SSE com fotogramas parciais; sem, um JSON final. */
  stream?: boolean;
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

export type ImageResult = ImageSuccess | ChatJsonFailure;

export interface AIModelProvider {
  readonly id: ProviderId;
  /** Há chave e configuração suficientes para fazer pedidos? */
  isConfigured(): boolean;
  /** Modelo deste fornecedor para cada nível. */
  model(tier: Tier): string;
  /** Pede o objeto do esquema. Nunca lança: devolve sempre um resultado tipado. */
  complete(request: ProviderRequest): Promise<ChatJsonResult>;
  /** Gera uma imagem. Opcional: nem todos os fornecedores têm imagens. Nunca lança. */
  generateImage?(input: ImageInput & { timeoutMs: number }): Promise<ImageResult>;
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
    case "refused":
      return "A IA recusou responder a este pedido.";
    default:
      return status != null
        ? `A IA recusou o pedido (código ${status}).`
        : "A IA não conseguiu responder a este pedido.";
  }
}

/** Código de erro a partir do estado HTTP do fornecedor. */
export function codeFromStatus(status: number): AIErrorCode {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 408) return "timeout";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "unavailable";
  return "http_error";
}

export function failure(
  provider: string,
  model: string,
  code: AIErrorCode,
  status: number | null,
  detail: string | null,
): ChatJsonFailure {
  return {
    ok: false,
    code,
    status,
    reason: describeFailure(code, status),
    detail: detail ? detail.slice(0, 300) : null,
    provider,
    model,
  };
}

/** O texto de uma saída estruturada é o próprio JSON: sem cercas nem cortes. */
export function readObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

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
