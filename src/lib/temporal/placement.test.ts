import { describe, expect, it } from "vitest";

import {
  applyAuditFixes,
  moveTo,
  placeInTimeline,
  syncOffsets,
  toStorageOffsets,
  type PlacementReport,
} from "./placement";

/** Comentário com os metadados que a geração produz e que a revisão tem de preservar. */
type Draft = {
  at: number;
  atMs?: number;
  author: string;
  message: string;
  moment: string;
  kind: "provoca" | "reage" | "responde" | "espontaneo";
  anchor: number | null;
  reason: string;
  slot: string | null;
  causality?: { triggerType: string; triggerId: string; temporalRelation: string };
  transcriptVersionId?: string;
};

const DURATION = 329;
const BOUNDS = { start: 0, end: DURATION };

function draft(at: number, index: number, extra: Partial<Draft> = {}): Draft {
  return {
    at,
    atMs: at * 1000,
    author: `Pessoa ${index}`,
    message: `Mensagem ${index}`,
    moment: "explicacao",
    kind: "reage",
    anchor: Math.max(0, at - 5),
    reason: `razão ${index}`,
    slot: `s${index}`,
    causality: { triggerType: "PRESENTER_EVENT", triggerId: `e${index}`, temporalRelation: "REACTION_TO_PRESENTER" },
    transcriptVersionId: "v1",
    ...extra,
  };
}

/** Caso real: vídeo de 329 s, muitos comentários com segundos repetidos. */
function crowdedTimeline(): Draft[] {
  const list: Draft[] = [];
  let index = 0;
  // 120 comentários em 12 segundos repetidos, todos dentro do vídeo.
  for (const second of [10, 10, 60, 60, 60, 120, 200, 200, 280, 300, 320, 325]) {
    for (let k = 0; k < 10; k += 1) list.push(draft(second, index++));
  }
  // Alguns já depois do fim, como a revisão antiga deixava passar.
  list.push(draft(400, index++), draft(750, index++));
  return list;
}

describe("placeInTimeline: integridade temporal com duração de 329 s", () => {
  it("nunca deixa um comentário depois do fim e mantém segundos e milissegundos em sintonia", () => {
    const input = crowdedTimeline();
    const report: PlacementReport<Draft> = { dropped: [] };
    const kept = placeInTimeline(input, BOUNDS, 2, report);

    expect(kept.length).toBeGreaterThan(0);
    for (const comment of kept) {
      expect(comment.at).toBeLessThanOrEqual(DURATION);
      expect(comment.atMs).toBeLessThanOrEqual(DURATION * 1000);
      expect(comment.at).toBe(Math.round(comment.atMs! / 1000));
      const stored = toStorageOffsets(comment);
      expect(stored.offset_seconds).toBeLessThanOrEqual(DURATION);
      expect(stored.offset_ms).toBeLessThanOrEqual(DURATION * 1000);
      expect(stored.offset_seconds).toBe(Math.round(stored.offset_ms / 1000));
    }
  });

  it("ordena estritamente no tempo e não inventa posições artificiais depois do fim", () => {
    const input = crowdedTimeline();
    const report: PlacementReport<Draft> = { dropped: [] };
    const kept = placeInTimeline(input, BOUNDS, 2, report);

    for (let i = 1; i < kept.length; i += 1) {
      expect(kept[i]!.at).toBeGreaterThan(kept[i - 1]!.at);
      expect(kept[i]!.atMs!).toBeGreaterThan(kept[i - 1]!.atMs!);
    }
    // Nada é empurrado para depois de 329 s: quem não cabe é descartado.
    expect(kept.every((c) => c.at <= DURATION)).toBe(true);
    expect(kept.length + report.dropped.length).toBe(input.length);
    // Os dois que já vinham depois do fim são descartados com razão própria.
    const afterEnd = report.dropped.filter((d) => d.reason === "depois_do_fim");
    expect(afterEnd.map((d) => d.comment.at).sort()).toEqual([400, 750]);
    // Os restantes descartes são por falta de espaço, nunca por invenção.
    for (const d of report.dropped) expect(["depois_do_fim", "sem_espaco"]).toContain(d.reason);
  });

  it("preserva a ordem causal relativa e todos os metadados dos comentários mantidos", () => {
    const input = crowdedTimeline();
    const byMessage = new Map(input.map((c) => [c.message, { ...c }]));
    const report: PlacementReport<Draft> = { dropped: [] };
    const kept = placeInTimeline(input, BOUNDS, 2, report);

    for (const comment of kept) {
      const original = byMessage.get(comment.message)!;
      expect(comment.author).toBe(original.author);
      expect(comment.moment).toBe(original.moment);
      expect(comment.kind).toBe(original.kind);
      expect(comment.anchor).toBe(original.anchor);
      expect(comment.reason).toBe(original.reason);
      expect(comment.slot).toBe(original.slot);
      expect(comment.causality).toEqual(original.causality);
      expect(comment.transcriptVersionId).toBe(original.transcriptVersionId);
      // Um comentário nunca é puxado para antes do instante em que nasceu.
      expect(comment.at).toBeGreaterThanOrEqual(original.at);
    }
    // Nunca dois comentários no mesmo segundo.
    expect(kept.length).toBe(new Set(kept.map((c) => c.at)).size);
  });
});

describe("placeInTimeline: sem espaço temporal suficiente", () => {
  it("descarta explicitamente o que não cabe, sem ultrapassar a duração", () => {
    // 50 comentários no mesmo segundo, a 1 s do fim: só cabe um.
    const input = Array.from({ length: 50 }, (_, i) => draft(328, i));
    const report: PlacementReport<Draft> = { dropped: [] };
    const kept = placeInTimeline(input, BOUNDS, 2, report);

    expect(kept).toHaveLength(1);
    expect(kept[0]!.at).toBe(328);
    expect(kept[0]!.atMs).toBe(328_000);
    expect(report.dropped).toHaveLength(49);
    for (const d of report.dropped) {
      expect(d.reason).toBe("sem_espaco");
      expect(d.detail).toContain("329");
    }
  });

  it("com o vídeo cheio, tudo o que sobra é descartado e nada fica fora de [0, fim]", () => {
    // Um comentário a cada segundo já ocupa o vídeo inteiro com gap 2 → só metade cabe.
    const input = Array.from({ length: 2 * DURATION }, (_, i) => draft(Math.floor(i / 2), i));
    const report: PlacementReport<Draft> = { dropped: [] };
    const kept = placeInTimeline(input, BOUNDS, 2, report);

    expect(kept.every((c) => c.at >= 0 && c.at <= DURATION)).toBe(true);
    expect(kept.length + report.dropped.length).toBe(input.length);
    expect(report.dropped.length).toBeGreaterThan(0);
    expect(Math.max(...kept.map((c) => c.at))).toBeLessThanOrEqual(DURATION);
  });

  it("uma lista vazia ou um vídeo sem duração útil não rebenta", () => {
    expect(placeInTimeline([], BOUNDS)).toEqual([]);
    const report: PlacementReport<Draft> = { dropped: [] };
    const kept = placeInTimeline([draft(5, 1), draft(5, 2)], { start: 0, end: 0 }, 2, report);
    expect(kept).toEqual([]);
    expect(report.dropped).toHaveLength(2);
  });
});

describe("syncOffsets, moveTo e toStorageOffsets", () => {
  it("os milissegundos mandam quando existem", () => {
    const c = syncOffsets({ at: 12, atMs: 12_900 });
    expect(c.at).toBe(13);
    expect(c.atMs).toBe(12_900);
  });

  it("sem milissegundos, derivam dos segundos", () => {
    const c = syncOffsets<{ at: number; atMs?: number }>({ at: 5.4 });
    expect(c.at).toBe(5);
    expect(c.atMs).toBe(5000);
  });

  it("mover actualiza os dois campos ao mesmo tempo", () => {
    const c = moveTo({ at: 10, atMs: 10_250 }, 42);
    expect(c.at).toBe(42);
    expect(c.atMs).toBe(42_000);
  });

  it("os valores gravados nunca divergem entre si", () => {
    expect(toStorageOffsets({ at: 7, atMs: 7_499 })).toEqual({ offset_seconds: 7, offset_ms: 7_499 });
    expect(toStorageOffsets({ at: 7, atMs: 7_500 })).toEqual({ offset_seconds: 8, offset_ms: 7_500 });
    expect(toStorageOffsets({ at: 9 })).toEqual({ offset_seconds: 9, offset_ms: 9_000 });
  });
});

describe("applyAuditFixes: a revisão só mexe no instante", () => {
  it("aplica as correcções válidas, ignora as inválidas e preserva os metadados", () => {
    const list = [draft(50, 1), draft(100, 2), draft(150, 3)];
    const snapshot = list.map((c) => ({ ...c }));
    applyAuditFixes(
      list,
      [
        { index: 0, at: 60 }, // válida
        { index: 1, at: 900 }, // fora do vídeo: fica no fim, nunca depois
        { index: 7, at: 10 }, // índice inexistente
        { index: 2, at: "abc" }, // segundo inválido
      ],
      BOUNDS,
    );
    expect(list[0]!.at).toBe(60);
    expect(list[0]!.atMs).toBe(60_000);
    expect(list[1]!.at).toBe(DURATION);
    expect(list[1]!.atMs).toBe(DURATION * 1000);
    expect(list[2]!.at).toBe(150);
    for (let i = 0; i < list.length; i += 1) {
      const { at: _a, atMs: _b, ...rest } = list[i]!;
      const { at: _c, atMs: _d, ...original } = snapshot[i]!;
      expect(rest).toEqual(original);
    }
  });
});
