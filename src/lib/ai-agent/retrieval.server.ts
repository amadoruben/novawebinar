/**
 * Recuperação de conhecimento do webinar para o Agente IA.
 *
 * Duas coisas diferentes, de propósito:
 *  - compreender: pode olhar para a estrutura completa do webinar;
 *  - poder revelar: só o que já foi dito até ao instante atual da sessão.
 *
 * O corte temporal é feito aqui, no servidor, antes de existir prompt.
 */
import type { TranscriptVersion } from "@/lib/temporal/engine.server";
import type { NormalizedSentence, TemporalSemanticMoment } from "@/lib/temporal/types";

export type WebinarPassage = {
  transcriptVersionId: string;
  semanticMomentId: string | null;
  startMs: number;
  endMs: number;
  text: string;
  topic: string | null;
};

const STOP = new Set([
  "a","o","as","os","de","do","da","dos","das","e","em","um","uma","que","para","por","com","no","na",
  "nos","nas","se","ao","à","às","aos","é","ele","ela","isso","isto","quando","como","qual","quais",
  "sobre","mais","menos","muito","você","voce","eu","tu","nós","nos","the","of",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3 && !STOP.has(word));
}

function momentFor(
  moments: TemporalSemanticMoment[],
  startMs: number,
): TemporalSemanticMoment | null {
  return moments.find((m) => startMs >= m.startMs && startMs <= m.endMs) ?? null;
}

/** Junta frases seguidas num trecho legível de ~35 s. */
function groupSentences(sentences: NormalizedSentence[], maxMs = 35_000): NormalizedSentence[][] {
  const groups: NormalizedSentence[][] = [];
  let current: NormalizedSentence[] = [];
  for (const sentence of sentences) {
    const first = current[0];
    if (!first || sentence.endMs - first.startMs <= maxMs) current.push(sentence);
    else {
      groups.push(current);
      current = [sentence];
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

/**
 * Procura na transcrição os trechos relevantes para a pergunta.
 *
 * `revealableUntilMs` é o relógio real do participante (live ou replay):
 * nada depois desse instante entra no resultado.
 */
export function searchWebinarKnowledge(input: {
  version: TranscriptVersion;
  question: string;
  revealableUntilMs: number;
  limit?: number;
}): WebinarPassage[] {
  const { version, question, revealableUntilMs } = input;
  const limit = input.limit ?? 4;
  const query = new Set(tokens(question));
  if (query.size === 0) return [];

  const allowed = version.sentences.filter((sentence) => sentence.endMs <= revealableUntilMs);
  if (allowed.length === 0) return [];

  const scored = groupSentences(allowed).map((group) => {
    const text = group.map((s) => s.text).join(" ").trim();
    const words = tokens(text);
    let hits = 0;
    for (const word of words) if (query.has(word)) hits += 1;
    const startMs = group[0]!.startMs;
    const endMs = group[group.length - 1]!.endMs;
    const moment = momentFor(version.moments, startMs);
    /** Peso pequeno para o tópico do momento, quando existe. */
    const topicHits = moment
      ? tokens(`${moment.topic} ${moment.summary}`).filter((word) => query.has(word)).length
      : 0;
    const score = hits / Math.sqrt(Math.max(words.length, 8)) + topicHits * 0.08;
    return {
      score,
      passage: {
        transcriptVersionId: version.id,
        semanticMomentId: moment?.id ?? null,
        startMs,
        endMs,
        text,
        topic: moment?.topic ?? null,
      } satisfies WebinarPassage,
    };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.passage);
}

/** Contexto imediato: o que está a ser dito agora e os últimos momentos. */
export function immediateContext(version: TranscriptVersion, nowMs: number) {
  const recent = version.sentences.filter(
    (sentence) => sentence.endMs <= nowMs && sentence.endMs >= nowMs - 120_000,
  );
  const moments = version.moments.filter((m) => m.endMs <= nowMs).slice(-3);
  const events = version.events.filter((e) => e.endMs <= nowMs).slice(-5);
  return {
    recentTranscript: recent.map((s) => s.text).join(" ").slice(-1800),
    currentMoment: moments[moments.length - 1] ?? null,
    recentMoments: moments.map((m) => ({ topic: m.topic, summary: m.summary })),
    recentEvents: events.map((e) => ({ type: e.type, text: e.triggerText })),
  };
}
