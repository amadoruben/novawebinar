/**
 * Verificação de integridade dos tempos por palavra.
 *
 * Só marcamos uma transcrição como "word" quando as palavras trazem mesmo
 * tempos próprios do motor: tempos distintos, ordem coerente e início nunca
 * depois do fim. Tempos repetidos ou distribuídos matematicamente dentro da
 * frase não contam como precisão por palavra.
 */
import type { NormalizedWord, TimestampPrecision } from "./types";

export type WordIntegrity = {
  ok: boolean;
  reason: string | null;
  distinctStarts: number;
  words: number;
  outOfOrder: number;
  invalidRanges: number;
  zeroLength: number;
};

export function checkWordIntegrity(words: NormalizedWord[]): WordIntegrity {
  const total = words.length;
  const starts = new Set<number>();
  let outOfOrder = 0;
  let invalidRanges = 0;
  let zeroLength = 0;

  words.forEach((word, index) => {
    starts.add(word.startMs);
    if (word.endMs < word.startMs) invalidRanges += 1;
    if (word.endMs === word.startMs) zeroLength += 1;
    const previous = index > 0 ? words[index - 1] : null;
    if (previous && word.startMs < previous.startMs) outOfOrder += 1;
  });

  const base: Omit<WordIntegrity, "ok" | "reason"> = {
    distinctStarts: starts.size,
    words: total,
    outOfOrder,
    invalidRanges,
    zeroLength,
  };

  if (total < 20) {
    return { ...base, ok: false, reason: "A transcrição trouxe palavras a menos para confiar nos tempos." };
  }
  if (invalidRanges > 0) {
    return { ...base, ok: false, reason: "Há palavras com fim antes do início." };
  }
  if (outOfOrder > 0) {
    return { ...base, ok: false, reason: "As palavras não estão em ordem temporal." };
  }
  if (starts.size < total * 0.9) {
    return { ...base, ok: false, reason: "Muitas palavras partilham o mesmo tempo — não é tempo real por palavra." };
  }
  if (zeroLength > total * 0.2) {
    return { ...base, ok: false, reason: "Muitas palavras não têm duração própria." };
  }
  return { ...base, ok: true, reason: null };
}

/** Precisão efetiva: "word" só quando os dados o justificam. */
export function effectivePrecision(
  declared: TimestampPrecision,
  words: NormalizedWord[],
): { precision: TimestampPrecision; integrity: WordIntegrity | null } {
  if (declared !== "word") return { precision: declared, integrity: null };
  const integrity = checkWordIntegrity(words);
  return { precision: integrity.ok ? "word" : "estimated", integrity };
}
