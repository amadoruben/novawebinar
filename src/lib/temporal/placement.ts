/**
 * Colocação de comentários na linha temporal do vídeo.
 *
 * Invariantes garantidas por este módulo:
 *   1. nenhum comentário fica depois do fim do vídeo (`end`, em segundos);
 *   2. `at` (segundos) e `atMs` (milissegundos) representam sempre o mesmo
 *      instante: `at === Math.round(atMs / 1000)`;
 *   3. mover um comentário actualiza os dois campos ao mesmo tempo;
 *   4. dois comentários nunca partilham o mesmo segundo, mas o afastamento
 *      nunca ultrapassa o fim: quem não cabe é descartado de forma explícita
 *      e devolvido em `dropped`, com a razão, em vez de inventar um instante.
 *
 * O módulo é puro: só conhece `at`/`atMs` e devolve os mesmos objectos,
 * por isso todos os outros campos (causalidade, razão, slot, ...) ficam intactos.
 */

export type TimedItem = { at: number; atMs?: number };

export type DropReason =
  /** Já estava depois do fim do vídeo. */
  | "depois_do_fim"
  /** Não havia segundo livre entre o anterior e o fim do vídeo. */
  | "sem_espaco"
  /** A causa (fala, pergunta, oferta) só permite um instante depois do fim. */
  | "causa_depois_do_fim";

export type Dropped<T> = { comment: T; reason: DropReason; detail: string };

export type PlacementReport<T extends TimedItem = TimedItem> = { dropped: Dropped<T>[] };

export type Bounds = { start: number; end: number };

/** Segundos inteiros a partir de milissegundos, sempre pela mesma regra. */
export function secondsFromMs(ms: number): number {
  return Math.max(0, Math.round(ms / 1000));
}

/**
 * Põe `at` e `atMs` de acordo. Quando existe `atMs` válido é ele que manda,
 * porque traz a precisão dos tempos por palavra; senão deriva-se de `at`.
 */
export function syncOffsets<T extends TimedItem>(item: T): T {
  if (typeof item.atMs === "number" && Number.isFinite(item.atMs) && item.atMs >= 0) {
    item.atMs = Math.round(item.atMs);
    item.at = secondsFromMs(item.atMs);
  } else {
    item.at = Math.max(0, Math.round(item.at));
    item.atMs = item.at * 1000;
  }
  return item;
}

/** Move o comentário para um segundo concreto, actualizando os dois campos. */
export function moveTo<T extends TimedItem>(item: T, seconds: number): T {
  const at = Math.max(0, Math.round(seconds));
  item.at = at;
  item.atMs = at * 1000;
  return item;
}

/** Instante válido dentro do vídeo: entre o início e o fim, inclusive. */
export function isWithin(seconds: number, bounds: Bounds): boolean {
  return Number.isFinite(seconds) && seconds >= bounds.start && seconds <= bounds.end;
}

/**
 * Regra de afastamento: dois comentários nunca no mesmo segundo, com `gap`
 * segundos entre eles, sem nunca passar o fim do vídeo.
 *
 * A lista é ordenada por `at`; os objectos devolvidos são os mesmos que
 * entraram (só `at`/`atMs` mudam), e a ordem causal relativa mantém-se.
 */
export function placeInTimeline<T extends TimedItem>(
  list: T[],
  bounds: Bounds,
  gap = 2,
  report?: PlacementReport<T>,
): T[] {
  const dropped: Dropped<T>[] = report?.dropped ?? [];
  const ordered = list.map(syncOffsets).sort((a, b) => a.atMs! - b.atMs!);
  const kept: T[] = [];
  let previous = -Infinity;

  for (const item of ordered) {
    if (item.at > bounds.end) {
      dropped.push({
        comment: item,
        reason: "depois_do_fim",
        detail: `${item.at}s é depois do fim do vídeo (${bounds.end}s)`,
      });
      continue;
    }
    let at = Math.max(item.at, bounds.start);
    if (at <= previous) at = previous + gap;
    if (at > bounds.end) {
      dropped.push({
        comment: item,
        reason: "sem_espaco",
        detail: `sem segundo livre entre ${previous}s e o fim do vídeo (${bounds.end}s)`,
      });
      continue;
    }
    if (at !== item.at) moveTo(item, at);
    else syncOffsets(item);
    previous = at;
    kept.push(item);
  }

  if (report) report.dropped = dropped;
  return kept;
}

/**
 * Aplica as correcções de segundo sugeridas pela revisão (índice → segundo)
 * só ao instante, mantendo todos os outros campos. Índices inválidos e
 * segundos fora do vídeo são ignorados em vez de inventar posições.
 */
export function applyAuditFixes<T extends TimedItem>(
  list: T[],
  fixes: { index?: unknown; at?: unknown }[],
  bounds: Bounds,
): T[] {
  for (const fix of fixes) {
    const index = Number(fix.index);
    const at = Number(fix.at);
    const target = Number.isInteger(index) ? list[index] : undefined;
    if (!target || !Number.isFinite(at)) continue;
    moveTo(target, Math.max(bounds.start, Math.min(bounds.end, Math.round(at))));
  }
  return list;
}

/**
 * Valores para gravar em `scheduled_comments`: os milissegundos mandam e os
 * segundos derivam deles, para os dois campos nunca divergirem na base.
 */
export function toStorageOffsets(item: TimedItem): { offset_seconds: number; offset_ms: number } {
  const offset_ms =
    typeof item.atMs === "number" && Number.isFinite(item.atMs) && item.atMs >= 0
      ? Math.round(item.atMs)
      : Math.max(0, Math.round(item.at)) * 1000;
  return { offset_seconds: secondsFromMs(offset_ms), offset_ms };
}
