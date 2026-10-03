import { describe, expect, it } from "vitest";

import { cleanRules, SEGMENT_PRESETS, segmentSentence } from "./segments";

describe("segmentos", () => {
  it("os modelos já vêm limpos (a base de dados aceita-os como estão)", () => {
    for (const p of SEGMENT_PRESETS) expect(cleanRules(p.rules)).toEqual(p.rules);
  });

  it("limpa a origem (minúsculas, sem vazios nem repetidos) e recusa valores em falta", () => {
    expect(
      cleanRules({ match: "any", conditions: [{ fact: "utm_source", op: "in", value: [" Facebook", "fb", "", "facebook"] }] }),
    ).toEqual({ match: "any", conditions: [{ fact: "utm_source", op: "in", value: ["facebook", "fb"] }] });
    expect(cleanRules({ match: "all", conditions: [{ fact: "utm_campaign", op: "contains", value: "  " }] })).toBeNull();
    expect(cleanRules({ match: "all", conditions: [{ fact: "webinar", value: "" }] })).toBeNull();
    expect(cleanRules({ match: "all", conditions: [] })).toBeNull();
  });

  it("diz as regras numa frase, com E ou OU", () => {
    const title = () => "Aula de IA";
    expect(
      segmentSentence(
        { match: "all", conditions: [{ fact: "attended", value: true }, { fact: "purchased", value: false }] },
        title,
      ),
    ).toBe("Assistiu e não comprou");
    expect(
      segmentSentence(
        {
          match: "any",
          conditions: [
            { fact: "utm_source", op: "in", value: ["facebook", "fb"] },
            { fact: "webinar", value: "w" },
          ],
        },
        title,
      ),
    ).toBe("Origem: facebook ou fb ou no webinar «Aula de IA»");
  });
});
