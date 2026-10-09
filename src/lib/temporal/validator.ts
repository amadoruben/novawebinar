/**
 * Temporal Validation Engine.
 *
 * Auditoria determinística (sem IA) da causalidade de cada comentário.
 * Regra final: se não se consegue explicar por que razão a mensagem aparece
 * naquele instante, a mensagem não é publicada.
 */
import type {
  CommentCausality,
  PresenterEvent,
  TemporalSemanticMoment,
  TimestampPrecision,
} from "./types";
import { precisionSafetyMarginMs } from "./types";
import { topicRelevanceAt, topicStillActive, type TopicSpan } from "./topics";
import {
  ACCEPTANCE_THRESHOLD,
  answerAcceptance,
  baseAnswerWindow,
  baseReactionWindow,
  classifyReactionKind,
} from "./windows";

export type TimedComment = {
  id: string;
  atMs: number;
  author: string;
  message: string;
  causality: CommentCausality;
};

export type ValidationContext = {
  precision: TimestampPrecision;
  moments: TemporalSemanticMoment[];
  events: PresenterEvent[];
  /** Tópicos do webinar, para saber se o assunto ainda está vivo. */
  topics?: TopicSpan[];
  /** Momento em que a oferta começa, em ms. Antes disto nada de preço/bónus. */
  offerStartMs: number | null;
};


export type ValidationIssue = {
  commentId: string;
  rule: string;
  detail: string;
  action: "reposicionado" | "eliminado";
  fromMs: number;
  toMs: number | null;
};

export type ValidationReport = {
  kept: TimedComment[];
  removed: TimedComment[];
  issues: ValidationIssue[];
  moved: number;
};

/** Latência humana plausível para escrever esta mensagem. */
export function humanLatencyMs(message: string, seed = 0): number {
  const length = message.trim().length;
  const base = 900 + Math.min(length, 160) * 38;
  const complexity = /[?]/.test(message) ? 700 : 0;
  // Variação natural determinística (mesma entrada, mesmo resultado).
  const jitter = ((Math.sin((length + seed) * 12.9898) * 43758.5453) % 1) * 1800;
  return Math.round(base + complexity + Math.abs(jitter));
}

const OFFER_WORDS =
  /(pre[çc]o|pagar|pagamento|presta[çc]|parcel|desconto|b[óo]nus|garantia|inscri|comprar|checkout|matr[íi]cula|vaga)/i;

function findMoment(context: ValidationContext, id: string | null) {
  return context.moments.find((moment) => moment.id === id) ?? null;
}

function findEvent(context: ValidationContext, id: string | null) {
  return context.events.find((event) => event.id === id) ?? null;
}

/**
 * Valida (e quando possível reposiciona) a cronologia completa.
 * Nunca inventa conteúdo: só move no tempo ou elimina.
 */
export function validateTimeline(
  comments: TimedComment[],
  context: ValidationContext,
): ValidationReport {
  const margin = precisionSafetyMarginMs(context.precision);
  const kept: TimedComment[] = [];
  const removed: TimedComment[] = [];
  const issues: ValidationIssue[] = [];
  let moved = 0;

  const reposition = (comment: TimedComment, target: number, rule: string, detail: string) => {
    issues.push({
      commentId: comment.id,
      rule,
      detail,
      action: "reposicionado",
      fromMs: comment.atMs,
      toMs: target,
    });
    moved += 1;
    return { ...comment, atMs: target };
  };

  const drop = (comment: TimedComment, rule: string, detail: string) => {
    issues.push({
      commentId: comment.id,
      rule,
      detail,
      action: "eliminado",
      fromMs: comment.atMs,
      toMs: null,
    });
    removed.push(comment);
  };

  for (const original of [...comments].sort((a, b) => a.atMs - b.atMs)) {
    let comment = original;
    const { causality } = comment;
    // Latência declarada só vale se for humanamente plausível: valores
    // negativos ou instantâneos deixariam passar comentários antecipados.
    const declared = causality.reactionLatencyMs;
    const latency =
      declared != null && declared >= 300
        ? declared
        : humanLatencyMs(comment.message, comment.atMs);

    // D. Conteúdo da oferta antes de a oferta existir.
    if (
      context.offerStartMs != null &&
      comment.atMs < context.offerStartMs &&
      OFFER_WORDS.test(comment.message)
    ) {
      drop(
        comment,
        "conhecimento-futuro",
        "Fala de preço, bónus, garantia ou inscrição antes de a oferta ser apresentada.",
      );
      continue;
    }

    if (causality.temporalRelation === "REACTION_TO_PRESENTER") {
      const moment = findMoment(context, causality.triggerId);
      const end = moment?.endMs ?? causality.triggerEndMs;
      if (end == null) {
        drop(comment, "sem-causa", "Reação sem momento que a justifique.");
        continue;
      }
      // Janela pelo tipo de reação: "muito bom" tem validade curta, uma
      // reflexão mais longa dura mais — mas só enquanto o assunto vive.
      const kind = classifyReactionKind(comment.message);
      const window = baseReactionWindow(
        { endMs: end, reactionWindowStartMs: moment?.reactionWindowStartMs ?? end },
        kind,
      );
      const earliest = Math.max(window.earliestMs, end + margin + latency);
      if (comment.atMs < earliest) {
        comment = reposition(
          comment,
          earliest,
          "reacao-antecipada",
          "A reação aparecia antes de a ideia terminar.",
        );
      }
      const topicId = moment?.topicId ?? causality.topicId ?? null;
      const relevance = context.topics?.length
        ? topicRelevanceAt(context.topics, topicId, comment.atMs)
        : 1;
      if (comment.atMs > window.latestMs + margin) {
        drop(
          comment,
          "reacao-tardia",
          "A reação chegava fora da janela deste tipo de mensagem.",
        );
        continue;
      }
      if (!topicStillActive(relevance)) {
        drop(
          comment,
          "reacao-fora-de-topico",
          "O apresentador já tinha mudado de assunto quando esta reação aparecia.",
        );
        continue;
      }
    }

    if (causality.temporalRelation === "ANSWER_TO_PRESENTER") {
      const event = findEvent(context, causality.triggerId);
      const end = event?.endMs ?? causality.triggerEndMs;
      if (end == null) {
        drop(comment, "sem-pedido", "Resposta sem pedido do apresentador.");
        continue;
      }
      const window = baseAnswerWindow({
        endMs: end,
        responseWindowMs: event?.responseWindowMs ?? 0,
        expectedResponseType: event?.expectedResponseType ?? "ANSWER",
      });
      const earliest = Math.max(window.earliestMs, end + margin + latency);
      if (comment.atMs < earliest) {
        comment = reposition(
          comment,
          earliest,
          "resposta-antecipada",
          "A resposta aparecia antes do pedido do apresentador.",
        );
      }
      // Probabilidade decrescente: tarde é raro, não é proibido.
      const topicId = causality.topicId ?? null;
      const relevance = context.topics?.length
        ? topicRelevanceAt(context.topics, topicId, comment.atMs)
        : 1;
      const acceptance = answerAcceptance({
        elapsedMs: comment.atMs - end,
        ...(event?.expectedResponseType ? { expectedResponseType: event.expectedResponseType } : {}),
        messageLength: comment.message.length,
        topicRelevance: relevance,
      });
      if (acceptance < ACCEPTANCE_THRESHOLD) {
        drop(
          comment,
          "resposta-tardia",
          "Já era pouco plausível alguém responder tão tarde a este pedido.",
        );
        continue;
      }
    }


    if (causality.temporalRelation === "CAUSE_OF_PRESENTER_SPEECH") {
      const event = findEvent(context, causality.triggerId);
      const start = event?.startMs ?? causality.triggerStartMs;
      if (start == null) {
        drop(comment, "pretexto-sem-fala", "Pretexto sem a fala que o cita.");
        continue;
      }
      if (event && event.type !== "CHAT_REFERENCE" && event.type !== "PRESENTER_READS_CHAT") {
        drop(
          comment,
          "pretexto-invalido",
          "Só existe pretexto quando o apresentador lê ou cita o chat.",
        );
        continue;
      }
      const latest = start - margin - 1500;
      if (comment.atMs >= latest) {
        if (latest <= 0) {
          drop(comment, "pretexto-impossivel", "Não há tempo suficiente antes da fala citada.");
          continue;
        }
        comment = reposition(
          comment,
          latest,
          "pretexto-tardio",
          "O pretexto tem de existir antes de o apresentador o citar.",
        );
      }
    }

    if (causality.temporalRelation === "SPONTANEOUS") {
      const future = context.moments.find(
        (moment) => moment.startMs > comment.atMs && shares(moment.topic, comment.message),
      );
      if (future) {
        drop(
          comment,
          "conhecimento-futuro",
          "A mensagem depende de conteúdo que ainda não tinha sido dito.",
        );
        continue;
      }
    }

    if (comment.atMs < 0) {
      drop(comment, "fora-da-linha", "Tempo negativo.");
      continue;
    }

    kept.push(comment);
  }

  kept.sort((a, b) => a.atMs - b.atMs);
  return { kept, removed, issues, moved };
}

/** Sobreposição de vocabulário significativo entre tópico e mensagem. */
function shares(topic: string, message: string) {
  const words = topic
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 6);
  if (words.length === 0) return false;
  const text = message.toLowerCase();
  return words.some((word) => text.includes(word));
}
