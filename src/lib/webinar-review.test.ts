import { describe, expect, it } from "vitest";
import { reviewIssues, reviewSummary, type ReviewFacts } from "./webinar-review";

const ready: ReviewFacts = {
  title: "Vender no Instagram",
  hostName: "Edna Kiala",
  fields: 3,
  video: 2530,
  audience: { format: "fala", min: 200, max: 600, analysed: true },
  comments: 312,
  countries: 2,
  offer: { product: "Mentoria", pitch: 1930 },
  sales: { enabled: true, count: 15, crowded: false },
  automations: { workflow: true, total: 4, active: 4, incomplete: 0 },
  agent: { on: true, name: "Equipa Edna" },
  session: "seg., 12/10, 20:00",
};

describe("revisão do webinar", () => {
  it("tudo configurado: nada por corrigir e uma linha por etapa", () => {
    expect(reviewIssues(ready)).toEqual([]);
    const summary = reviewSummary(ready);
    expect(summary.oferta).toBe("Mentoria aos 32:10");
    expect(summary.audiencia).toBe("De 200 a 600 pessoas");
    expect(summary.automacoes).toBe("4 de 4 ligadas");
  });

  it("chat vazio: a IA corrige sozinha, e a audiência «Acompanha a fala» também", () => {
    const issues = reviewIssues({
      ...ready,
      comments: 0,
      audience: { ...ready.audience, analysed: false },
    });
    expect(issues.map((i) => [i.step, i.fix])).toEqual([
      ["audiencia", "comments"],
      ["chat", "comments"],
    ]);
  });

  it("com comentários já escritos, a transcrição em falta corrige-se à mão (criar de novo trocava-os)", () => {
    const [issue] = reviewIssues({ ...ready, audience: { ...ready.audience, analysed: false } });
    expect(issue?.step).toBe("audiencia");
    expect(issue?.fix).toBeUndefined();
  });

  it("sem vídeo não há correcção automática do chat", () => {
    const issues = reviewIssues({ ...ready, video: null, comments: 0 });
    expect(issues.find((i) => i.step === "chat")?.fix).toBeUndefined();
  });

  it("sem nacionalidades a IA não escreve: só «Corrigir eu», que leva ao Chat", () => {
    const issues = reviewIssues({
      ...ready,
      comments: 0,
      countries: 0,
      audience: { ...ready.audience, analysed: false },
    });
    expect(issues.map((i) => [i.step, i.fix])).toEqual([
      ["audiencia", undefined],
      ["chat", undefined],
    ]);
    expect(issues.find((i) => i.step === "chat")?.detail).toBe(
      "Escolha de onde são as pessoas do chat.",
    );
  });

  it("automações: fluxo vazio, mensagens por completar e nenhuma ligada", () => {
    expect(
      reviewIssues({
        ...ready,
        automations: { workflow: true, total: 0, active: 0, incomplete: 0 },
      }).map((i) => i.title),
    ).toEqual(["O fluxo está vazio"]);
    expect(
      reviewIssues({
        ...ready,
        automations: { workflow: true, total: 3, active: 0, incomplete: 1 },
      }).map((i) => i.title),
    ).toEqual(["1 automação por completar", "Nenhuma automação ligada"]);
    // Sem fluxo, o aviso já vem dos avisos de lançamento do editor.
    expect(
      reviewIssues({
        ...ready,
        automations: { workflow: false, total: 0, active: 0, incomplete: 0 },
      }),
    ).toEqual([]);
  });

  it("título e apresentador em falta; compras a mais", () => {
    const issues = reviewIssues({
      ...ready,
      title: " ",
      hostName: "",
      sales: { enabled: true, count: 400, crowded: true },
    });
    expect(issues.map((i) => i.step)).toEqual(["inicio", "inicio", "vendas"]);
  });

  it("agente desligado e sempre disponível não são problemas, só se dizem", () => {
    const summary = reviewSummary({
      ...ready,
      agent: { on: false, name: "" },
      session: null,
      offer: null,
      sales: { enabled: false, count: 0, crowded: false },
    });
    expect(summary.agente).toMatch(/^Desligado/);
    expect(summary.agenda).toBe("Sempre disponível");
    expect(summary.oferta).toBe("Sem oferta");
    expect(summary.vendas).toBe("Só as compras reais");
  });
});
