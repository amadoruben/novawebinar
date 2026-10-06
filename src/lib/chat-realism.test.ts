import { describe, expect, it } from "vitest";
import {
  applyChatRealism,
  chatTagLabel,
  DEFAULT_CHAT_RULES,
  hostQuestions,
  mobileText,
  namePool,
  parseCommentSheet,
  stripEmoji,
  type ChatDraft,
} from "@/lib/chat-realism";

const drafts: ChatDraft[] = Array.from({ length: 40 }, (_, i) => ({
  at: 10 + i * 7,
  author: "Gerado",
  message: `Comentário número ${i} sobre o upsell 🔥`,
}));
const ctx = { durationSeconds: 329, pitchSeconds: 311, questions: [69, 168] };

describe("regras do chat simulado", () => {
  it("nomes do país e nunca o mesmo nome antes de dois minutos", () => {
    const out = applyChatRealism(drafts, DEFAULT_CHAT_RULES, ctx);
    const pool = new Set(namePool("ao"));
    const last = new Map<string, number>();
    for (const c of out) {
      expect(pool.has(c.author)).toBe(true);
      const prev = last.get(c.author);
      if (prev !== undefined) expect(c.at - prev).toBeGreaterThanOrEqual(120);
      last.set(c.author, c.at);
    }
  });

  it("escrevem uns segundos depois e nunca depois do fim do vídeo", () => {
    const out = applyChatRealism(drafts, { ...DEFAULT_CHAT_RULES, late: false, answersOn: false }, ctx);
    for (const c of out) expect(c.at).toBeLessThanOrEqual(329);
    const firstOut = out.find((c) => c.message.includes("número 0"));
    expect(firstOut!.at - 10).toBeGreaterThanOrEqual(3);
  });

  it("há quem chegue atrasado e quem responda às perguntas do apresentador", () => {
    const out = applyChatRealism(drafts, DEFAULT_CHAT_RULES, ctx);
    expect(out.filter((c) => c.tag === "late")).toHaveLength(3);
    const answers = out.filter((c) => c.tag === "answer");
    expect(answers).toHaveLength(6);
    expect(answers.every((c) => c.at > 69)).toBe(true);
  });

  it("no máximo duas pessoas dizem que são alunas, perto da oferta", () => {
    const out = applyChatRealism(drafts, DEFAULT_CHAT_RULES, ctx);
    const alunos = out.filter((c) => c.tag === "aluno");
    expect(alunos.length).toBeLessThanOrEqual(2);
    expect(alunos.every((c) => c.at > 311 - 30)).toBe(true);
  });

  it("sem emojis ou no tom formal, as mensagens saem sem emojis", () => {
    for (const rules of [{ ...DEFAULT_CHAT_RULES, emoji: false }, { ...DEFAULT_CHAT_RULES, tone: "formal" as const }]) {
      const out = applyChatRealism(drafts, rules, ctx);
      expect(out.every((c) => stripEmoji(c.message) === c.message)).toBe(true);
    }
  });

  it("nenhuma mensagem se repete", () => {
    const twins = [...drafts, ...drafts.map((c) => ({ ...c, at: c.at + 1 }))];
    const out = applyChatRealism(twins, DEFAULT_CHAT_RULES, ctx);
    const keys = out.map((c) => stripEmoji(c.message).toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("o que foi escrito à mão fica como está", () => {
    const manual: ChatDraft = { at: 50, author: "", message: "Escrito por mim!", tag: "manual" };
    const out = applyChatRealism([manual], DEFAULT_CHAT_RULES, ctx);
    expect(out.find((c) => c.tag === "manual")).toMatchObject({ at: 50, message: "Escrito por mim!" });
  });

  it("com pouca gente a ver, há menos mensagens", () => {
    const quiet = applyChatRealism(drafts, { ...DEFAULT_CHAT_RULES, late: false, answersOn: false, talk: false }, {
      ...ctx,
      audienceAt: () => 0.1,
    });
    expect(quiet.length).toBeLessThan(drafts.length);
  });
});

describe("textos", () => {
  it("escrita de telemóvel", () => {
    expect(mobileText("Você também percebeu.")).toBe("vc tb percebeu");
  });

  it("perguntas do apresentador à audiência", () => {
    const qs = hostQuestions([
      { at: 69, text: "Quando você comprou uma nova oferta, certo?" },
      { at: 100, text: "O que é o upsell?" },
      { at: 168, text: "Ficou claro isso aqui, gente?" },
    ]);
    expect(qs.map((q) => q.at)).toEqual([69, 168]);
  });

  it("folha com minuto, nome e mensagem", () => {
    const sheet = 'minuto,nome,mensagem\n1:05,Ana,"Boa noite, cheguei"\n00:40;Rui;Olá\n\nxx,Sem,minuto\n90\tInês\tVerdade';
    expect(parseCommentSheet(sheet)).toEqual([
      { at: 40, author: "Rui", message: "Olá", tag: "manual" },
      { at: 65, author: "Ana", message: "Boa noite, cheguei", tag: "manual" },
      { at: 90, author: "Inês", message: "Verdade", tag: "manual" },
    ]);
  });

  it("o porquê de cada comentário", () => {
    expect(chatTagLabel("reply", "@Edson verdade")).toBe("Responde a Edson");
    expect(chatTagLabel("late")).toBe("Chegou atrasado");
    expect(chatTagLabel(null)).toBeNull();
  });
});
