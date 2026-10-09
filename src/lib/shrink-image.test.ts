import { describe, expect, it } from "vitest";
import { IMAGE_PRESETS, shrinkBox, smallImage } from "./shrink-image";

describe("redução de imagens no envio", () => {
  it("foto do apresentador: quadrado do centro com 160 px", () => {
    expect(shrinkBox(1600, 1067, IMAGE_PRESETS.avatar)).toEqual({
      sx: 266.5,
      sy: 0,
      sw: 1067,
      sh: 1067,
      width: 160,
      height: 160,
    });
  });

  it("capa: cabe em 1200×630 sem cortar nem deformar", () => {
    expect(shrinkBox(4000, 3000, IMAGE_PRESETS.cover)).toMatchObject({
      sx: 0,
      sy: 0,
      width: 840,
      height: 630,
    });
    expect(shrinkBox(2400, 1260, IMAGE_PRESETS.cover)).toMatchObject({ width: 1200, height: 630 });
  });

  it("uma imagem pequena nunca cresce", () => {
    expect(shrinkBox(100, 80, IMAGE_PRESETS.avatar)).toMatchObject({ width: 80, height: 80 });
    expect(shrinkBox(600, 300, IMAGE_PRESETS.cover)).toMatchObject({ width: 600, height: 300 });
  });
});

describe("imagens já guardadas servidas pequenas", () => {
  const legacy =
    "https://abc123.supabase.co/storage/v1/object/sign/webinar-covers/w/1790082861129.png?token=x.y.z";

  it("as antigas do Storage passam pelo optimizador, com o endereço inteiro (e o token) codificado", () => {
    expect(smallImage(legacy)).toBe(`/_vercel/image?url=${encodeURIComponent(legacy)}&w=160&q=75`);
  });

  it("as já reduzidas e as de fora do Storage ficam como estão", () => {
    const reduced =
      "https://abc123.supabase.co/storage/v1/object/sign/webinar-covers/w/1791-160.webp?token=x";
    expect(smallImage(reduced)).toBe(reduced);
    expect(smallImage("https://exemplo.com/foto.png")).toBe("https://exemplo.com/foto.png");
    expect(smallImage("")).toBe("");
  });
});
