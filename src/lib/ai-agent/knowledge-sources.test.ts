import { describe, expect, it } from "vitest";
import { readSources, sourcePatch } from "./knowledge-sources";

describe("fontes de conhecimento do webinar", () => {
  it("sem escolha gravada: tudo marcado menos a transcrição (coluna desligada à partida)", () => {
    expect(readSources(null)).toEqual({ transcricao: false, oferta: true, pagina: true, faqs: true, objecoes: true, notas: true });
    expect(readSources({ use_webinar_transcript: true, personality: { tone: "proximo" } }).transcricao).toBe(true);
  });

  it("desmarcar e voltar a marcar grava na linha sem perder o tom nem as outras fontes", () => {
    const row = { use_webinar_transcript: false, personality: { tone: "proximo", sources: { faqs: false } } };
    const off = sourcePatch(row, "oferta", false);
    expect(off).toEqual({ personality: { tone: "proximo", sources: { faqs: false, oferta: false } } });
    const after = { ...row, ...off };
    expect(readSources(after)).toMatchObject({ oferta: false, faqs: false, pagina: true });
    expect(readSources({ ...after, ...sourcePatch(after, "oferta", true) }).oferta).toBe(true);
  });

  it("a transcrição grava na sua coluna", () => {
    expect(sourcePatch(null, "transcricao", true)).toEqual({ use_webinar_transcript: true });
  });
});
