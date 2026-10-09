/**
 * Palavras → frases.
 *
 * O início da frase vem da primeira palavra e o fim da última. Nunca se usa
 * o tempo do bloco original como tempo de todas as ideias contidas nele.
 */
import type { NormalizedSentence, NormalizedWord } from "./types";

const ENDS_SENTENCE = /[.!?…]$/;
const MAX_SENTENCE_WORDS = 60;
const MAX_SENTENCE_GAP_MS = 1800;

export function buildSentences(words: NormalizedWord[]): NormalizedSentence[] {
  const sentences: NormalizedSentence[] = [];
  let current: number[] = [];

  const flush = () => {
    if (current.length === 0) return;
    const first = words[current[0]!]!;
    const last = words[current[current.length - 1]!]!;
    const confidences = current
      .map((index) => words[index]!.confidence)
      .filter((value): value is number => typeof value === "number");
    sentences.push({
      id: `s${sentences.length + 1}`,
      text: current
        .map((index) => words[index]!.word)
        .join(" ")
        .replace(/\s+([,.!?…])/g, "$1")
        .trim(),
      startMs: first.startMs,
      endMs: Math.max(last.endMs, first.startMs),
      wordIndexes: current,
      speakerId: first.speakerId,
      confidence:
        confidences.length > 0
          ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
          : null,
    });
    current = [];
  };

  words.forEach((word, index) => {
    const previous = index > 0 ? words[index - 1] : null;
    const speakerChanged = previous != null && previous.speakerId !== word.speakerId;
    const bigGap = previous != null && word.startMs - previous.endMs > MAX_SENTENCE_GAP_MS;
    if (current.length > 0 && (speakerChanged || bigGap)) flush();

    current.push(index);

    if (ENDS_SENTENCE.test(word.word) || current.length >= MAX_SENTENCE_WORDS) flush();
  });
  flush();

  return sentences;
}
