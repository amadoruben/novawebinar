import { describe, expect, it } from "vitest";
import { CAPTION_CHARS, CAPTION_LINE, captionAt, captionChunks, captionLines } from "./room-captions";

const LONG =
  "Boa noite a todos. Hoje vamos falar de como vender mais com webinars automáticos, sem anúncios caros e sem precisar de estar ao vivo todas as noites.";

describe("legendas curtas", () => {
  it("uma frase curta fica inteira", () => {
    expect(captionChunks("  Olá a   todos!  ", 64)).toEqual(["Olá a todos!"]);
    expect(captionChunks("", 64)).toEqual([]);
  });

  it("parte o texto em pedaços até ao limite, sem cortar palavras nem perder texto", () => {
    for (const max of [CAPTION_CHARS.compact, CAPTION_CHARS.full]) {
      const pieces = captionChunks(LONG, max);
      expect(pieces.length).toBeGreaterThan(1);
      for (const piece of pieces) expect(piece.length).toBeLessThanOrEqual(max);
      expect(pieces.join(" ")).toBe(LONG);
    }
  });

  it("corta de preferência nas pausas", () => {
    expect(captionChunks(LONG, 64)[0]).toBe("Boa noite a todos.");
  });

  it("uma oração longa sem pausas fica em pedaços de tamanho parecido", () => {
    const pieces = captionChunks("a ".repeat(50).trim(), 64);
    expect(pieces).toHaveLength(2);
    expect(Math.abs(pieces[0]!.length - pieces[1]!.length)).toBeLessThanOrEqual(6);
  });

  it("cada pedaço cabe em duas linhas curtas, de tamanho parecido", () => {
    expect(captionLines("Olá a todos!", CAPTION_LINE.compact)).toBe("Olá a todos!");
    for (const piece of captionChunks(LONG, CAPTION_CHARS.compact)) {
      const lines = captionLines(piece, CAPTION_LINE.compact).split("\n");
      expect(lines.length).toBeLessThanOrEqual(2);
      for (const line of lines) expect(line.length).toBeLessThanOrEqual(38);
      expect(lines.join(" ")).toBe(piece);
    }
  });

  it("os pedaços passam ao ritmo da fala, e a legenda sai no silêncio", () => {
    // Duas frases: a primeira dura 10 s (até à seguinte) e parte-se em 3 pedaços.
    const lines = [
      { at: 5, text: LONG },
      { at: 15, text: "Vamos a isso." },
    ];
    const pieces = captionChunks(LONG, 64);
    expect(captionAt(lines, 4, 64)).toBeNull();
    expect(captionAt(lines, 5, 64)).toBe(pieces[0]);
    expect(captionAt(lines, 14.9, 64)).toBe(pieces.at(-1));
    // A ordem dos pedaços segue o tempo.
    const seen = Array.from({ length: 100 }, (_, i) => captionAt(lines, 5 + i / 10, 64));
    expect([...new Set(seen)]).toEqual(pieces);
    // A frase curta dura o tempo de a dizer (+2 s) e depois sai.
    expect(captionAt(lines, 16, 64)).toBe("Vamos a isso.");
    expect(captionAt(lines, 18.5, 64)).toBeNull();
  });

  it("aguenta a transcrição fora de ordem e frases vazias", () => {
    const lines = [
      { at: 10, text: "Segunda frase." },
      { at: 5, text: "Primeira frase." },
    ];
    expect(captionAt(lines, 6, 64)).toBe("Primeira frase.");
    expect(captionAt(lines, 11, 64)).toBe("Segunda frase.");
    expect(captionAt([{ at: 0, text: "  " }], 0.5, 64)).toBeNull();
  });
});
