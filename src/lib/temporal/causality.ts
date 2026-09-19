/**
 * Liga cada comentário gerado à sua causa temporal e semântica.
 *
 * A IA declara a relação ("reage", "responde", "provoca", "espontaneo"), o
 * segundo da fala relacionada e o motivo. Aqui essa declaração é resolvida de
 * forma determinística contra os eventos do apresentador, os momentos
 * semânticos e as frases da transcrição — nada é inventado: se não houver
 * evidência temporal, a causa fica por resolver e o comentário é tratado como
 * inválido a montante (exceto o espontâneo, que nunca precisa de trecho).
 */
import type {
  CommentCausality,
  NormalizedSentence,
  PresenterEvent,
  TemporalSemanticMoment,
  TimestampPrecision,
  TemporalRelation,
} from "./types";
import { precisionSafetyMarginMs } from "./types";
import { topicRelevanceAt, topicStillActive, type TopicSpan } from "./topics";


export type CausalityInput = {
  at: number;
  message?: string;
  kind?: "provoca" | "reage" | "responde" | "espontaneo";
  anchor?: number | null;
  reason?: string | null;
  /** Oportunidade de onde a mensagem nasceu, quando existe. */
  slot?: {
    id: string;
    triggerType: "PRESENTER_EVENT" | "SEMANTIC_MOMENT";
    triggerId: string;
    triggerStartMs: number;
    triggerEndMs: number;
    triggerText?: string;
    topicId?: string | null;
  } | null;
};

export type CausalityContext = {
  sentences: NormalizedSentence[];
  moments: TemporalSemanticMoment[];
  events: PresenterEvent[];
  precision: TimestampPrecision;
  /** Tópicos, para medir se o assunto ainda estava vivo. */
  topics?: TopicSpan[];
  /** Diferença entre o relógio do áudio transcrito e o relógio do player. */
  mediaTimeOffsetMs?: number;
};


const RELATION: Record<string, TemporalRelation> = {
  reage: "REACTION_TO_PRESENTER",
  responde: "ANSWER_TO_PRESENTER",
  provoca: "CAUSE_OF_PRESENTER_SPEECH",
  espontaneo: "SPONTANEOUS",
};

function covering<T extends { startMs: number; endMs: number }>(list: T[], ms: number): T | null {
  let best: T | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const item of list) {
    if (ms >= item.startMs && ms <= item.endMs) return item;
    const distance = ms < item.startMs ? item.startMs - ms : ms - item.endMs;
    if (distance < bestDistance) {
      best = item;
      bestDistance = distance;
    }
  }
  return bestDistance <= 20_000 ? best : null;
}

/** Resolve a causa de um comentário. Devolve sempre um objeto preenchido. */
export function resolveCausality(
  comment: CausalityInput,
  context: CausalityContext,
): CommentCausality {
  const offset = context.mediaTimeOffsetMs ?? 0;
  const relation = RELATION[comment.kind ?? "espontaneo"] ?? "SPONTANEOUS";
  const reason = (comment.reason ?? "").trim();
  const base = precisionSafetyMarginMs(context.precision);
  const commentMs = Math.round(comment.at * 1000);

  if (relation === "SPONTANEOUS") {
    return {
      temporalRelation: "SPONTANEOUS",
      triggerType: "NONE",
      triggerId: null,
      triggerStartMs: null,
      triggerEndMs: null,
      reactionLatencyMs: null,
      generationReason: reason || "Engajamento espontâneo, sem fala específica a causá-lo.",
      confidence: context.precision === "word" ? 0.7 : 0.5,
    };
  }

  // Nascido de uma oportunidade: a causa já é conhecida, não se adivinha.
  const slot = comment.slot ?? null;

  const anchorMs = slot
    ? slot.triggerEndMs
    : comment.anchor !== null && comment.anchor !== undefined
      ? Math.round(comment.anchor * 1000) + offset
      : null;

  if (anchorMs === null) {
    return {
      temporalRelation: relation,
      triggerType: "NONE",
      triggerId: null,
      triggerStartMs: null,
      triggerEndMs: null,
      reactionLatencyMs: null,
      generationReason: reason,
      confidence: 0,
    };
  }

  const event = covering(context.events, anchorMs);
  const moment = covering(context.moments, anchorMs);
  const sentence = covering(context.sentences, anchorMs);

  const chosen = slot
    ? {
        type: slot.triggerType,
        id: slot.triggerId,
        startMs: slot.triggerStartMs,
        endMs: slot.triggerEndMs,
        confidence: 0.9,
      }
    : relation === "ANSWER_TO_PRESENTER" && event
      ? { type: "PRESENTER_EVENT" as const, id: event.id, startMs: event.startMs, endMs: event.endMs, confidence: event.confidence }
      : event && Math.abs(event.startMs - anchorMs) <= 5_000
        ? { type: "PRESENTER_EVENT" as const, id: event.id, startMs: event.startMs, endMs: event.endMs, confidence: event.confidence }
        : moment
          ? { type: "SEMANTIC_MOMENT" as const, id: moment.id, startMs: moment.startMs, endMs: moment.endMs, confidence: 0.75 }
          : sentence
            ? { type: "SEMANTIC_MOMENT" as const, id: sentence.id, startMs: sentence.startMs, endMs: sentence.endMs, confidence: sentence.confidence ?? 0.6 }
            : null;


  if (!chosen) {
    return {
      temporalRelation: relation,
      triggerType: "NONE",
      triggerId: null,
      triggerStartMs: null,
      triggerEndMs: null,
      reactionLatencyMs: null,
      generationReason: reason,
      confidence: 0,
    };
  }

  const latency =
    relation === "CAUSE_OF_PRESENTER_SPEECH"
      ? chosen.startMs - commentMs
      : commentMs - chosen.endMs;

  const precisionPenalty = context.precision === "word" ? 0 : base > 0 ? 0.2 : 0;

  const triggerMoment =
    chosen.type === "SEMANTIC_MOMENT"
      ? context.moments.find((item) => item.id === chosen.id) ?? null
      : null;
  const topicId = slot?.topicId ?? triggerMoment?.topicId ?? null;
  const relevance = context.topics?.length
    ? topicRelevanceAt(context.topics, topicId, commentMs)
    : 1;
  const triggerText = slot?.triggerText ?? triggerMoment?.summary ?? "";
  const distance = semanticDistance(triggerText, comment.message ?? "");

  return {
    temporalRelation: relation,
    triggerType: chosen.type,
    triggerId: chosen.id,
    triggerStartMs: chosen.startMs,
    triggerEndMs: chosen.endMs,
    reactionLatencyMs: latency,
    generationReason: reason,
    confidence: Math.max(0, Math.min(1, (chosen.confidence ?? 0.6) - precisionPenalty)),
    slotId: slot?.id ?? null,
    topicId,
    topicRelevanceScore: Math.round(relevance * 100) / 100,
    topicStillActive: topicStillActive(relevance),
    semanticDistance: distance,
  };
}

/** 0 (mesmo assunto) a 1 (assunto diferente), pelo vocabulário partilhado. */
function semanticDistance(triggerText: string, message: string): number {
  const pick = (text: string) =>
    new Set(
      text
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((word) => word.length >= 5),
    );
  const a = pick(triggerText);
  const b = pick(message);
  if (a.size === 0 || b.size === 0) return 0.5;
  let shared = 0;
  for (const word of b) if (a.has(word)) shared += 1;
  return Math.max(0, Math.min(1, 1 - shared / Math.min(a.size, b.size)));
}


/** Resolve a causa de toda a lista, preservando a ordem de entrada. */
export function attachCausality<T extends CausalityInput>(
  comments: T[],
  context: CausalityContext,
): (T & { causality: CommentCausality })[] {
  return comments.map((comment) => ({ ...comment, causality: resolveCausality(comment, context) }));
}
