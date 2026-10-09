import { describe, expect, it } from "vitest";
import { chatEcho, placeOf } from "@/lib/chat-reactions";

const crowd = [{ name: "Edson" }, { name: "Kátia", avatarUrl: "https://x/k.jpg" }, { name: "Nelson" }, { name: "Yola" }];

describe("o chat simulado responde a quem escreve", () => {
  it("o mesmo id dá a mesma reacção e as mesmas respostas, em qualquer browser", () => {
    const msg = { id: "9f1c-real-1", text: "Boa noite! A ver de Luanda", author: "Rúben Amado" };
    expect(chatEcho(msg, crowd)).toEqual(chatEcho({ ...msg }, [...crowd]));
  });

  it("ids diferentes dão pessoas e frases diferentes", () => {
    const echoes = Array.from({ length: 30 }, (_, i) => chatEcho({ id: `m-${i}`, text: "Boa noite!", author: "Marta" }, crowd));
    const authors = new Set(echoes.flatMap((e) => e.replies.map((r) => r.author)));
    expect(authors.size).toBeGreaterThan(1);
  });

  it("primeiro a reacção, depois a resposta", () => {
    for (let i = 0; i < 40; i += 1) {
      const echo = chatEcho({ id: `ordem-${i}`, text: "Boa tarde, pessoal", author: "Marta" }, crowd);
      for (const reply of echo.replies) expect(reply.after).toBeGreaterThan(echo.reaction?.after ?? 0);
    }
  });

  it("a saudação responde com a mesma saudação e o nome; o sítio é repetido", () => {
    const texts = Array.from({ length: 40 }, (_, i) => chatEcho({ id: `s-${i}`, text: "Bom dia a todos", author: "Marta Silva" }, crowd))
      .flatMap((e) => e.replies.map((r) => r.text));
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t).toMatch(/Bom dia|Olá|Boas-vindas/);
    expect(texts.some((t) => t.includes("Marta"))).toBe(true);
    expect(texts.every((t) => !t.includes("Silva"))).toBe(true);

    const places = Array.from({ length: 40 }, (_, i) => chatEcho({ id: `p-${i}`, text: "Boa noite, a ver de Maputo", author: "Ana" }, crowd))
      .flatMap((e) => e.replies.map((r) => r.text));
    expect(places.some((t) => t.includes("Maputo"))).toBe(true);
  });

  it("«gostei de Python» não é um sítio", () => {
    const texts = Array.from({ length: 40 }, (_, i) => chatEcho({ id: `x-${i}`, text: "gostei de Python", author: "Ana" }, crowd))
      .flatMap((e) => e.replies.map((r) => r.text));
    expect(texts.every((t) => !t.includes("Python"))).toBe(true);
  });

  it("ninguém responde a si próprio, e sem chat simulado só há reacção", () => {
    for (let i = 0; i < 40; i += 1) {
      const echo = chatEcho({ id: `eu-${i}`, text: "Olá!", author: "Edson" }, crowd);
      expect(echo.replies.every((r) => r.author !== "Edson")).toBe(true);
    }
    expect(chatEcho({ id: "vazio", text: "Olá!", author: "Ana" }, []).replies).toEqual([]);
  });

  it("a uma pergunta ninguém inventa a resposta", () => {
    const texts = Array.from({ length: 60 }, (_, i) => chatEcho({ id: `q-${i}`, text: "Quanto custa a mentoria?", author: "Ana" }, crowd))
      .flatMap((e) => e.replies.map((r) => r.text));
    for (const t of texts) expect(t).toMatch(/quero saber|Boa pergunta|essa dúvida/);
  });

  it("a equipa recebe mais reacções e, numa pergunta, duas pessoas diferentes respondem", () => {
    const echo = chatEcho({ id: "equipa-1", text: "Quem quer o bónus?", author: "Amado Ruben", team: true }, crowd);
    expect(echo.reaction?.count).toBeGreaterThanOrEqual(6);
    expect(echo.replies).toHaveLength(2);
    expect(echo.replies[0]!.author).not.toBe(echo.replies[1]!.author);
    expect(echo.replies[0]!.text).not.toBe(echo.replies[1]!.text);
  });

  const places = [{ name: "Edson", place: "Luanda" }, { name: "Kátia", place: "Benguela" }, { name: "Nelson" }, { name: "Yola", place: "Huambo" }];
  const teamTexts = (text: string, people = places) =>
    Array.from({ length: 40 }, (_, i) => chatEcho({ id: `t-${text}-${i}`, text, author: "Amado Ruben", team: true }, people)).flatMap((e) => e.replies);

  it("«De onde estão a ver?» da equipa: cada um diz o seu sítio, ninguém diz «Eu quero»", () => {
    const replies = teamTexts("Boa noite a todos! De onde estão a ver?");
    expect(replies.length).toBeGreaterThan(0);
    for (const r of replies) {
      const own = places.find((p) => p.name === r.author)!.place!;
      expect(r.text).toContain(own);
      expect(r.text).not.toMatch(/Eu|Sim/);
    }
    // Sem ninguém que tenha dito de onde está, fica só a reacção.
    expect(teamTexts("De onde estão a ver?", [{ name: "Nelson" }, { name: "Ana" }])).toEqual([]);
  });

  it("a equipa: «Quem quer…?» → «Eu quero», «Estão a ouvir?» → «Sim», pergunta aberta → só a reacção", () => {
    for (const r of teamTexts("Quem quer o bónus?")) expect(r.text).toMatch(/^(Eu quero|Eu|Quero)!/);
    for (const r of teamTexts("Alguém já comprou?")) expect(r.text).toMatch(/^(Eu|Aqui)!/);
    for (const r of teamTexts("Estão a ouvir bem?")) expect(r.text).toMatch(/^Sim/);
    expect(teamTexts("Qual é a vossa maior dificuldade?")).toEqual([]);
    expect(teamTexts("Como se sentem hoje?")).toEqual([]);
    expect(chatEcho({ id: "aberta", text: "Qual é a vossa maior dificuldade?", author: "Amado", team: true }, places).reaction).not.toBeNull();
  });

  it("«Boa noite, tudo bem?» é uma saudação; «Alguém me ouve?» fica só com a reacção", () => {
    const greet = Array.from({ length: 40 }, (_, i) => chatEcho({ id: `tb-${i}`, text: "Boa noite, tudo bem?", author: "Ana" }, crowd)).flatMap((e) => e.replies);
    expect(greet.length).toBeGreaterThan(0);
    for (const r of greet) expect(r.text).toMatch(/Boa noite|Olá|Boas-vindas/);
    for (const text of ["Alguém me ouve?", "Tem replay?", "Estão a ouvir?"]) {
      const echoes = Array.from({ length: 40 }, (_, i) => chatEcho({ id: `yn-${text}-${i}`, text, author: "Ana" }, crowd));
      expect(echoes.flatMap((e) => e.replies)).toEqual([]);
      expect(echoes.every((e) => e.reaction)).toBe(true);
    }
  });

  it("«Olá» é uma saudação (com acento e em minúsculas)", () => {
    for (const text of ["Olá", "Olá a todos", "olá pessoal"]) {
      const replies = Array.from({ length: 40 }, (_, i) => chatEcho({ id: `ola-${text}-${i}`, text, author: "Ana" }, crowd)).flatMap((e) => e.replies);
      expect(replies.length).toBeGreaterThan(0);
      for (const r of replies) expect(r.text).toMatch(/Olá|Boas-vindas/);
    }
  });

  it("o sítio sai do comentário", () => {
    expect(placeOf("Boa noite! A ver de Luanda")).toBe("Luanda");
    expect(placeOf("aqui de São Paulo")).toBe("São Paulo");
    expect(placeOf("gostei de Python")).toBe("");
  });

  it("sem nome, a frase fica limpa", () => {
    const texts = Array.from({ length: 40 }, (_, i) => chatEcho({ id: `n-${i}`, text: "Olá", author: "" }, crowd)).flatMap((e) =>
      e.replies.map((r) => r.text),
    );
    for (const t of texts) expect(t).not.toMatch(/,\s*[!]|,\s*$|\{/);
  });
});
