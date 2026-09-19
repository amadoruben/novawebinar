/**
 * Janelas válidas: quando é que ainda faz sentido alguém escrever.
 *
 * Duas fases, de propósito:
 *  1. Antes de gerar — `baseReactionWindow` / `baseAnswerWindow` só dependem
 *     do momento ou do pedido. A mensagem ainda não existe.
 *  2. Depois de gerar — `reactionLatencyFor`, `answerAcceptance` e
 *     `pickTimestamp` afinam a latência e escolhem o instante exato com o
 *     texto já escrito. Sem dependência circular.
 */
import type { PresenterEvent, TemporalSemanticMoment } from "./types";

export type ReactionKind = "curta" | "media" | "reflexiva";

export type Window = { earliestMs: number; latestMs: number };

/** Duração da janela por tipo de reação, a contar do fim do momento. */
const REACTION_SPAN_MS: Record<ReactionKind, number> = {
  curta: 14_000,
  media: 32_000,
  reflexiva: 55_000,
};

/** Latência mínima humana antes de qualquer mensagem aparecer. */
export const MIN_HUMAN_LATENCY_MS = 900;

/** Classifica a reação pelo texto — só depois de a mensagem existir. */
export function classifyReactionKind(message: string): ReactionKind {
  const text = message.trim();
  const length = text.length;
  if (length <= 28) return "curta";
  if (length <= 90 && !/[,;:]/.test(text)) return "media";
  if (length > 130 || /(porque|quando|se eu|no meu caso|sempre que|já tentei)/i.test(text)) {
    return "reflexiva";
  }
  return "media";
}

/** Janela base de uma reação, sem depender do texto. */
export function baseReactionWindow(
  moment: Pick<TemporalSemanticMoment, "endMs" | "reactionWindowStartMs">,
  kind: ReactionKind = "media",
): Window {
  const start = Math.max(moment.endMs, moment.reactionWindowStartMs ?? moment.endMs);
  return {
    earliestMs: start + MIN_HUMAN_LATENCY_MS,
    latestMs: start + REACTION_SPAN_MS[kind],
  };
}

/** Janela base de uma resposta a um pedido do apresentador. */
export function baseAnswerWindow(
  event: Pick<PresenterEvent, "endMs" | "responseWindowMs" | "expectedResponseType">,
): Window {
  const span =
    event.responseWindowMs > 0
      ? event.responseWindowMs
      : event.expectedResponseType === "CONFIRMATION"
        ? 30_000
        : 45_000;
  return {
    earliestMs: event.endMs + MIN_HUMAN_LATENCY_MS,
    latestMs: event.endMs + span,
  };
}

/** Tempo a escrever esta mensagem, com o ritmo próprio da persona. */
export function typingLatencyMs(message: string, typingSpeedCps = 3.2, seed = 0) {
  const length = Math.min(message.trim().length, 220);
  const thinking = 700 + (/[?]/.test(message) ? 600 : 0);
  const typing = (length / Math.max(1.2, typingSpeedCps)) * 1000;
  const jitter = Math.abs(((Math.sin((length + seed) * 12.9898) * 43758.5453) % 1) * 1600);
  return Math.round(thinking + typing + jitter);
}

/** Latência total plausível de uma reação, já com o texto escrito. */
export function reactionLatencyFor(message: string, seed = 0, typingSpeedCps = 3.2) {
  return Math.max(MIN_HUMAN_LATENCY_MS, typingLatencyMs(message, typingSpeedCps, seed));
}

export type AcceptanceInput = {
  /** Tempo decorrido desde o fim do gatilho. */
  elapsedMs: number;
  expectedResponseType?: PresenterEvent["expectedResponseType"];
  messageLength: number;
  /** 0 a 1: quão atenta está a persona neste momento. */
  attention?: number;
  /** 0 a 1: quanto o assunto ainda está vivo. */
  topicRelevance?: number;
  /** Mensagens por minuto no chat à volta deste instante. */
  chatActivity?: number;
};

/**
 * Probabilidade (0..1) de esta mensagem ainda ser plausível neste atraso.
 * Cai progressivamente: não há proibição rígida aos 20 segundos.
 */
export function answerAcceptance(input: AcceptanceInput): number {
  const expected = input.expectedResponseType ?? "ANSWER";
  // Respostas de uma palavra esgotam-se depressa; respostas longas duram mais.
  const tau =
    expected === "CONFIRMATION" || expected === "KEYWORD"
      ? 9_000
      : expected === "LOCATION"
        ? 12_000
        : 16_000;
  const lengthBonus = 1 + Math.min(input.messageLength, 160) / 400;
  const elapsed = Math.max(0, input.elapsedMs);
  let score = Math.exp(-elapsed / (tau * lengthBonus));

  score *= 0.6 + 0.4 * (input.attention ?? 0.8);
  score *= 0.35 + 0.65 * (input.topicRelevance ?? 1);
  // Chat muito movimentado empurra as mensagens tardias para fora de vista.
  if ((input.chatActivity ?? 0) > 25) score *= 0.8;

  return Math.max(0, Math.min(1, score));
}

/** Abaixo disto, a mensagem tardia deixa de ser plausível. */
export const ACCEPTANCE_THRESHOLD = 0.06;

/**
 * Escolhe o instante exato dentro da janela: latência da persona, tamanho da
 * mensagem, mensagens já agendadas e um pouco de ruído humano — para não
 * ficarem intervalos certinhos nem duas mensagens no mesmo instante.
 */
export function pickTimestamp(
  window: Window,
  options: {
    message: string;
    seed?: number;
    typingSpeedCps?: number;
    /** Instantes já ocupados (ms), para evitar sobreposições artificiais. */
    scheduledMs?: number[];
    /** Posição na cascata de respostas ao mesmo gatilho (0 = primeira). */
    order?: number;
  },
): number {
  const seed = options.seed ?? options.message.length;
  const latency = reactionLatencyFor(options.message, seed, options.typingSpeedCps);
  const order = options.order ?? 0;
  const span = Math.max(1000, window.latestMs - window.earliestMs);

  // Cada pessoa seguinte na cascata demora um pouco mais a escrever.
  const cascade = order * (span / 6);
  const noise = (((Math.sin((seed + order * 7.7) * 78.233) * 43758.5453) % 1) + 1) / 2;
  let at = window.earliestMs + latency - MIN_HUMAN_LATENCY_MS + cascade + noise * (span / 5);
  at = Math.max(window.earliestMs, Math.min(window.latestMs, Math.round(at)));

  const taken = new Set((options.scheduledMs ?? []).map((ms) => Math.round(ms / 1000)));
  let guard = 0;
  while (taken.has(Math.round(at / 1000)) && guard < 8) {
    at = Math.min(window.latestMs, at + 1100);
    guard += 1;
  }
  return at;
}
