/**
 * Router de modelos: para cada tarefa, que nível de modelo, quanto pode
 * escrever, quanto esforço de raciocínio e quanto tempo espera. Também a ordem
 * dos fornecedores e os preços por modelo, tudo lido do ambiente.
 *
 * Puro: sem rede nem base de dados, para se poder testar.
 */
import { PROVIDER_IDS, type AITask, type Effort, type ProviderId, type Tier } from "./types";

export type TaskRoute = {
  tier: Tier;
  /** Inclui o raciocínio nos modelos que o contam como saída. */
  maxOutputTokens: number;
  effort: Effort;
  /** Por tentativa. */
  timeoutMs: number;
  /** Tentativas no mesmo fornecedor antes de passar ao seguinte. */
  attempts: number;
};

/** Tarefas simples nunca vão ao modelo maior. */
export const ROUTES: Record<AITask, TaskRoute> = {
  classification: {
    tier: "fast",
    maxOutputTokens: 8_000,
    effort: "low",
    timeoutMs: 60_000,
    attempts: 2,
  },
  intent: { tier: "fast", maxOutputTokens: 2_000, effort: "low", timeoutMs: 30_000, attempts: 2 },
  summary: { tier: "fast", maxOutputTokens: 4_000, effort: "low", timeoutMs: 60_000, attempts: 2 },
  chat: { tier: "balanced", maxOutputTokens: 8_000, effort: "low", timeoutMs: 45_000, attempts: 2 },
  generation: {
    tier: "balanced",
    maxOutputTokens: 32_000,
    effort: "medium",
    timeoutMs: 180_000,
    attempts: 2,
  },
  analysis: {
    tier: "balanced",
    maxOutputTokens: 32_000,
    effort: "medium",
    timeoutMs: 180_000,
    attempts: 2,
  },
  complex_reasoning: {
    tier: "capable",
    maxOutputTokens: 32_000,
    effort: "high",
    timeoutMs: 240_000,
    attempts: 2,
  },
};

type Env = Record<string, string | undefined>;

/** Modelo OpenAI quando `AI_CHAT_MODEL` não está definido. */
export const OPENAI_DEFAULT_MODEL = "gpt-5.6-luna";

/**
 * Principal, reserva e segunda reserva: `AI_PROVIDER` (por omissão `openai`),
 * `AI_FALLBACK_PROVIDER`, `AI_FALLBACK_2_PROVIDER`. Nomes desconhecidos e
 * repetidos ficam de fora.
 */
export function providerOrder(env: Env = process.env): ProviderId[] {
  const names = [
    env["AI_PROVIDER"] || "openai",
    env["AI_FALLBACK_PROVIDER"],
    env["AI_FALLBACK_2_PROVIDER"],
  ];
  const order: ProviderId[] = [];
  for (const name of names) {
    const id = (name ?? "").trim().toLowerCase() as ProviderId;
    if (PROVIDER_IDS.includes(id) && !order.includes(id)) order.push(id);
  }
  return order;
}

/**
 * Modelo de um fornecedor para um nível: `<PREFIXO>_MODEL_FAST`,
 * `<PREFIXO>_MODEL` (equilibrado) e `<PREFIXO>_MODEL_CAPABLE`.
 */
export function tierModel(
  prefix: string,
  tier: Tier,
  defaults: Record<Tier, string>,
  env: Env = process.env,
): string {
  const key = tier === "balanced" ? `${prefix}_MODEL` : `${prefix}_MODEL_${tier.toUpperCase()}`;
  return env[key]?.trim() || defaults[tier];
}

/**
 * Preço de um modelo em USD por milhão de tokens, de
 * `AI_MODEL_PRICES='{"modelo":[entrada, saída]}'`. `AI_PRICE_INPUT_PER_MTOK` e
 * `AI_PRICE_OUTPUT_PER_MTOK` continuam a ser o preço do modelo em
 * `AI_CHAT_MODEL`, e só desse. Sem preço configurado devolve `null`: um preço
 * desconhecido nunca passa por custo zero.
 */
export function modelPrice(
  model: string,
  env: Env = process.env,
): { inputPerMTok: number; outputPerMTok: number } | null {
  const num = (raw: unknown) => {
    const value = Number(String(raw ?? "").trim() || NaN);
    return Number.isFinite(value) && value >= 0 ? value : null;
  };
  const pair = (input: unknown, output: unknown) => {
    const inputPerMTok = num(input);
    const outputPerMTok = num(output);
    return inputPerMTok === null || outputPerMTok === null ? null : { inputPerMTok, outputPerMTok };
  };
  try {
    const table = JSON.parse(env["AI_MODEL_PRICES"] || "{}") as Record<string, unknown>;
    const entry = table[model];
    if (Array.isArray(entry)) return pair(entry[0], entry[1]);
  } catch {
    console.error("[ai] AI_MODEL_PRICES não é JSON válido; os modelos ficam sem preço.");
  }
  if (model === (env["AI_CHAT_MODEL"]?.trim() || OPENAI_DEFAULT_MODEL)) {
    return pair(env["AI_PRICE_INPUT_PER_MTOK"], env["AI_PRICE_OUTPUT_PER_MTOK"]);
  }
  return null;
}
