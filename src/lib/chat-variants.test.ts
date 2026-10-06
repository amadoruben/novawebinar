import { describe, expect, it } from "vitest";

import { CHAT_COUNTRIES, chatVariant, isChatVariant, variantCountries, variantText } from "./chat-variants";

describe("variantes do chat", () => {
  it("dos países à variante: nenhum, um ou vários (pela ordem do ecrã, sem repetidos)", () => {
    expect(chatVariant([])).toBe("pt-PT");
    expect(chatVariant(["ao"])).toBe("pt-AO");
    expect(chatVariant(["mz", "mz"])).toBe("pt-MZ");
    expect(chatVariant(["br"])).toBe("pt-BR");
    expect(chatVariant(["pt"])).toBe("pt-PT");
    expect(chatVariant(["pt", "ao", "br", "ao"])).toBe("mix:ao,br,pt");
  });

  it("da variante aos países, também nas antigas", () => {
    expect(variantCountries("pt-PT")).toEqual(["pt"]);
    expect(variantCountries("pt-BR")).toEqual(["br"]);
    expect(variantCountries("mixed")).toEqual(["br", "pt"]);
    expect(variantCountries("pt-AO")).toEqual(["ao"]);
    expect(variantCountries("pt-MZ")).toEqual(["mz"]);
    expect(variantCountries("mix:ao,mz,pt")).toEqual(["ao", "mz", "pt"]);
    expect(variantCountries("en-US")).toEqual(["pt"]);
    expect(variantCountries("mix:xx")).toEqual(["pt"]);
  });

  it("a validação aceita as antigas e as novas e recusa o resto", () => {
    for (const v of ["pt-PT", "pt-BR", "mixed", "pt-AO", "pt-MZ", "mix:ao,mz"]) expect(isChatVariant(v)).toBe(true);
    for (const v of ["en-US", "mix:", "mix:xx"]) expect(isChatVariant(v)).toBe(false);
  });

  it("a frase de uma mistura fala de todos os países", () => {
    const text = variantText(chatVariant(CHAT_COUNTRIES.map((c) => c.code)));
    for (const c of CHAT_COUNTRIES) expect(text).toContain(c.name);
  });
});
