/**
 * Quando repetir, quanto esperar e quando deixar um fornecedor de lado.
 * Puro, com relógio injectável, para se poder testar.
 */
import type { AIErrorCode } from "./types";

/** Falhas passageiras: vale a pena repetir no mesmo fornecedor. */
export const RETRYABLE: readonly AIErrorCode[] = ["rate_limited", "unavailable", "timeout"];

/**
 * Falhas do fornecedor, não do pedido: contam para o disjuntor. Uma recusa ou
 * um objeto inválido dizem respeito a este pedido e não o abrem.
 */
export const PROVIDER_FAULTS: readonly AIErrorCode[] = [...RETRYABLE, "unauthorized"];

/**
 * Espera antes da tentativa seguinte: 0,5 s, 1,5 s, 4,5 s…, entre metade e
 * uma vez e meia do valor, para pedidos em paralelo não baterem juntos outra vez.
 */
export function backoffMs(attempt: number, random: () => number = Math.random) {
  return Math.round(500 * 3 ** (attempt - 1) * (0.5 + random()));
}

export type BreakerState = "closed" | "open" | "half_open";

/**
 * Disjuntor de um fornecedor: depois de `threshold` falhas seguidas fica
 * aberto `cooldownMs`; passado esse tempo deixa passar pedidos de teste, e o
 * primeiro que falhe volta a abri-lo.
 *
 * ponytail: estado em memória, por processo. Em alojamento com várias
 * instâncias cada uma aprende sozinha; partilhar pelo registo `ai_calls` se
 * isso vier a pesar.
 */
export class Breaker {
  private failures = 0;
  private openUntil = 0;

  constructor(
    private readonly threshold = 3,
    private readonly cooldownMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  state(): BreakerState {
    if (this.failures < this.threshold) return "closed";
    return this.now() < this.openUntil ? "open" : "half_open";
  }

  allow() {
    return this.state() !== "open";
  }

  success() {
    this.failures = 0;
    this.openUntil = 0;
  }

  failure() {
    this.failures += 1;
    if (this.failures >= this.threshold) this.openUntil = this.now() + this.cooldownMs;
  }
}
