/**
 * Tópicos: agrupar momentos semânticos que falam do mesmo assunto e saber,
 * a cada instante, se esse assunto ainda está em cima da mesa.
 *
 * Uma reação não é válida só por estar dentro de um número de segundos: tem
 * de ser ao assunto que ainda está vivo. A passagem de "ativo" para "morto"
 * não é instantânea — há transições — por isso guardamos uma relevância
 * contínua entre 0 e 1, e não apenas um sim/não.
 */
import type { TemporalSemanticMoment } from "./types";

/** Tempo, depois do fim do tópico, ao fim do qual a relevância chega a zero. */
export const TOPIC_DECAY_MS = 45_000;
/** Tempo com outro tópico a decorrer que sozinho apaga o assunto anterior. */
export const TOPIC_SWITCH_MS = 25_000;
/** Abaixo disto considera-se que o assunto já não está ativo. */
export const TOPIC_ACTIVE_THRESHOLD = 0.35;

const STOP = new Set([
  "sobre",
  "porque",
  "quando",
  "depois",
  "agora",
  "mesmo",
  "pessoas",
  "coisas",
  "aquilo",
  "muito",
  "então",
  "entao",
  "vocês",
  "voces",
]);

function keywords(moment: TemporalSemanticMoment): Set<string> {
  const text = `${moment.topic} ${moment.summary}`.toLowerCase();
  const words = text
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 5 && !STOP.has(word));
  return new Set(words);
}

function overlap(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

export type TopicSpan = {
  id: string;
  startMs: number;
  endMs: number;
  keywords: Set<string>;
};

/**
 * Atribui um tópico a cada momento. Momentos seguidos que partilham
 * vocabulário significativo (ou que se seguem sem pausa temática) ficam no
 * mesmo tópico.
 */
export function assignTopics(moments: TemporalSemanticMoment[]): {
  moments: TemporalSemanticMoment[];
  topics: TopicSpan[];
} {
  const ordered = [...moments].sort((a, b) => a.startMs - b.startMs);
  const topics: TopicSpan[] = [];
  const out: TemporalSemanticMoment[] = [];

  for (const moment of ordered) {
    const words = keywords(moment);
    const last = topics[topics.length - 1];
    const continues =
      last != null &&
      moment.startMs - last.endMs <= 30_000 &&
      (overlap(words, last.keywords) >= 0.25 || words.size === 0);

    if (continues && last) {
      last.endMs = Math.max(last.endMs, moment.endMs);
      for (const word of words) last.keywords.add(word);
      out.push({ ...moment, topicId: last.id });
      continue;
    }

    const topic: TopicSpan = {
      id: `t${topics.length + 1}`,
      startMs: moment.startMs,
      endMs: moment.endMs,
      keywords: words,
    };
    topics.push(topic);
    out.push({ ...moment, topicId: topic.id });
  }

  return { moments: out, topics };
}

/**
 * Relevância do tópico num instante: 1 enquanto está a decorrer, a descer
 * progressivamente depois de terminar e mais depressa quando o apresentador
 * já entrou noutro assunto.
 */
export function topicRelevanceAt(topics: TopicSpan[], topicId: string | null, ms: number): number {
  if (!topicId) return 0.5;
  const topic = topics.find((item) => item.id === topicId);
  if (!topic) return 0.5;
  if (ms <= topic.endMs) return 1;

  const elapsed = ms - topic.endMs;
  const byTime = Math.max(0, 1 - elapsed / TOPIC_DECAY_MS);

  // Outro tópico já a decorrer acelera o esquecimento do anterior.
  const next = topics.find((item) => item.startMs > topic.startMs && item.startMs <= ms);
  const bySwitch = next ? Math.max(0, 1 - (ms - next.startMs) / TOPIC_SWITCH_MS) : 1;

  return Math.max(0, Math.min(1, byTime * bySwitch));
}

export function topicStillActive(relevance: number) {
  return relevance >= TOPIC_ACTIVE_THRESHOLD;
}
