/**
 * As legendas da sala: cada frase da transcrição parte-se em pedaços curtos (no telemóvel, no máximo
 * duas linhas curtas) que passam ao ritmo da fala. A transcrição só traz o início de cada frase.
 */
export type SpokenLine = { at: number; text: string };

/** Caracteres por legenda e por linha: no telemóvel duas linhas de ~32; no ecrã grande, um pouco mais. */
export const CAPTION_CHARS = { compact: 64, full: 84 } as const;
export const CAPTION_LINE = { compact: 34, full: 44 } as const;

/** Fala devagar (caracteres por segundo): uma frase nunca dura mais do que isto; o resto é silêncio. */
const SLOW_CHARS_PER_SECOND = 12;

/** Uma oração longa em pedaços de tamanho parecido, sem cortar palavras. */
function byWords(clause: string, max: number) {
  const target = clause.length / Math.ceil(clause.length / max);
  const out: string[] = [];
  let cur = "";
  for (const word of clause.split(" ")) {
    if (cur && (cur.length + 1 + word.length > max || cur.length >= target)) {
      out.push(cur);
      cur = word;
    } else cur = cur ? `${cur} ${word}` : word;
  }
  if (cur) out.push(cur);
  return out;
}

/** Parte o texto em pedaços até `max` caracteres, de preferência depois de uma pausa (. , ; : ? !). */
export function captionChunks(text: string, max: number) {
  const out: string[] = [];
  let cur = "";
  for (const clause of text.replace(/\s+/g, " ").trim().split(/(?<=[.!?…;:,]) /)) {
    if (!clause) continue;
    const joined = cur ? `${cur} ${clause}` : clause;
    if (joined.length <= max) {
      cur = joined;
      continue;
    }
    if (cur) out.push(cur);
    const pieces = byWords(clause, max);
    cur = pieces.pop() ?? "";
    out.push(...pieces);
  }
  if (cur) out.push(cur);
  return out;
}

/** Um pedaço que não cabe numa linha de `max` caracteres fica em duas, de tamanho parecido (com «\n»). */
export function captionLines(piece: string, max: number) {
  if (piece.length <= max) return piece;
  const middle = piece.length / 2;
  let cut = -1;
  for (let i = piece.indexOf(" "); i !== -1; i = piece.indexOf(" ", i + 1)) {
    if (cut === -1 || Math.abs(i - middle) < Math.abs(cut - middle)) cut = i;
  }
  return cut === -1 ? piece : `${piece.slice(0, cut)}\n${piece.slice(cut + 1)}`;
}

/**
 * O pedaço de legenda do segundo `t` (as frases em qualquer ordem). Cada frase dura até à seguinte (ou,
 * se houver silêncio, o tempo de a dizer devagar) e os pedaços dividem esse tempo pelo tamanho; o
 * último fica mais 2 s.
 */
export function captionAt(lines: readonly SpokenLine[], t: number, max: number) {
  // A última frase já começada e o início da seguinte, sem contar com a ordem (a transcrição pode vir baralhada).
  let line: SpokenLine | undefined;
  let next = Number.POSITIVE_INFINITY;
  for (const l of lines) {
    if (l.at <= t) {
      if (!line || l.at >= line.at) line = l;
    } else if (l.at < next) next = l.at;
  }
  if (!line) return null;
  const gap = next - line.at;
  const span = Math.min(gap, line.text.length / SLOW_CHARS_PER_SECOND);
  const into = t - line.at;
  if (into >= Math.min(gap, span + 2)) return null;
  const pieces = captionChunks(line.text, max);
  const total = pieces.reduce((n, piece) => n + piece.length, 0);
  let said = 0;
  for (const piece of pieces) {
    said += piece.length;
    if (into < (span * said) / total) return piece;
  }
  return pieces.at(-1) ?? null;
}
