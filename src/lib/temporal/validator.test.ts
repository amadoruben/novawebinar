import { describe, expect, it } from "vitest";

import { validateTimeline, type TimedComment, type ValidationContext } from "./validator";
import type { CommentCausality, PresenterEvent, TemporalSemanticMoment } from "./types";

const moment: TemporalSemanticMoment = {
  id: "m1",
  startMs: 60_000,
  endMs: 90_000,
  reactionWindowStartMs: 90_000,
  reactionWindowEndMs: 150_000,
  topic: "estratégia de leilão em tribunal",
  summary: "Explica a estratégia",
  novelty: 80,
  emotionalIntensity: 50,
  informationDensity: 70,
  momentType: "ensino",
  expectedReactions: ["surpresa"],
  sourceSentenceIds: ["s1"],
};

const question: PresenterEvent = {
  id: "e1",
  type: "REQUEST_LOCATION",
  startMs: 30_000,
  endMs: 34_000,
  triggerText: "De onde é que vocês estão a ver?",
  expectedResponseType: "LOCATION",
  responseWindowMs: 90_000,
  confidence: 0.9,
  semanticMomentId: null,
};

const chatRef: PresenterEvent = {
  id: "e2",
  type: "CHAT_REFERENCE",
  startMs: 300_000,
  endMs: 304_000,
  triggerText: "Vi aqui uma pergunta sobre garantias",
  expectedResponseType: "NONE",
  responseWindowMs: 0,
  confidence: 0.8,
  semanticMomentId: null,
};

const context: ValidationContext = {
  precision: "word",
  moments: [moment],
  events: [question, chatRef],
  offerStartMs: 600_000,
};

function comment(id: string, atMs: number, message: string, causality: Partial<CommentCausality>): TimedComment {
  return {
    id,
    atMs,
    author: "Ana",
    message,
    causality: {
      temporalRelation: "SPONTANEOUS",
      triggerType: "NONE",
      triggerId: null,
      triggerStartMs: null,
      triggerEndMs: null,
      reactionLatencyMs: 2000,
      generationReason: "teste",
      confidence: 0.9,
      ...causality,
    },
  };
}

describe("Temporal Validation Engine", () => {
  it("A — resposta antes da pergunta é reposicionada para depois", () => {
    const report = validateTimeline(
      [
        comment("c1", 20_000, "Lisboa!", {
          temporalRelation: "ANSWER_TO_PRESENTER",
          triggerType: "PRESENTER_EVENT",
          triggerId: "e1",
        }),
      ],
      context,
    );
    expect(report.removed).toHaveLength(0);
    expect(report.kept[0]!.atMs).toBeGreaterThan(question.endMs);
    expect(report.moved).toBe(1);
  });

  it("B — reação antes do fim da ideia é reposicionada", () => {
    const report = validateTimeline(
      [
        comment("c2", 70_000, "Isso muda tudo", {
          temporalRelation: "REACTION_TO_PRESENTER",
          triggerType: "SEMANTIC_MOMENT",
          triggerId: "m1",
        }),
      ],
      context,
    );
    expect(report.kept[0]!.atMs).toBeGreaterThanOrEqual(moment.endMs);
  });

  it("C — pretexto só é válido antes da fala que o cita", () => {
    const report = validateTimeline(
      [
        comment("c3", 305_000, "E isso funciona fora de Lisboa?", {
          temporalRelation: "CAUSE_OF_PRESENTER_SPEECH",
          triggerType: "PRESENTER_EVENT",
          triggerId: "e2",
        }),
      ],
      context,
    );
    expect(report.kept[0]!.atMs).toBeLessThan(chatRef.startMs);
  });

  it("D — conhecimento futuro da oferta é eliminado", () => {
    const report = validateTimeline(
      [comment("c4", 120_000, "Esse preço é acessível, dá para pagar em prestações?", {})],
      context,
    );
    expect(report.kept).toHaveLength(0);
    expect(report.removed).toHaveLength(1);
    expect(report.issues[0]!.rule).toBe("conhecimento-futuro");
  });

  it("E — reação fora da janela é eliminada", () => {
    const report = validateTimeline(
      [
        comment("c5", 400_000, "Muito bom", {
          temporalRelation: "REACTION_TO_PRESENTER",
          triggerType: "SEMANTIC_MOMENT",
          triggerId: "m1",
        }),
      ],
      context,
    );
    expect(report.removed).toHaveLength(1);
    expect(report.issues[0]!.rule).toBe("reacao-tardia");
  });

  it("F — reação curta depois de o assunto mudar é eliminada", () => {
    const topics = [
      { id: "t1", startMs: 60_000, endMs: 90_000, keywords: new Set<string>() },
      { id: "t2", startMs: 92_000, endMs: 200_000, keywords: new Set<string>() },
    ];
    const report = validateTimeline(
      [
        comment("c7", 135_000, "Muito bom", {
          temporalRelation: "REACTION_TO_PRESENTER",
          triggerType: "SEMANTIC_MOMENT",
          triggerId: "m1",
          topicId: "t1",
        }),
      ],
      { ...context, topics, moments: [{ ...moment, topicId: "t1" }] },
    );
    expect(report.removed).toHaveLength(1);
    expect(["reacao-tardia", "reacao-fora-de-topico"]).toContain(report.issues[0]!.rule);
  });

  it("G — resposta rápida passa e resposta muito tardia cai", () => {
    const quick = validateTimeline(
      [
        comment("c8", 40_000, "Braga", {
          temporalRelation: "ANSWER_TO_PRESENTER",
          triggerType: "PRESENTER_EVENT",
          triggerId: "e1",
        }),
      ],
      context,
    );
    expect(quick.kept).toHaveLength(1);

    const late = validateTimeline(
      [
        comment("c9", 120_000, "Braga", {
          temporalRelation: "ANSWER_TO_PRESENTER",
          triggerType: "PRESENTER_EVENT",
          triggerId: "e1",
        }),
      ],
      context,
    );
    expect(late.removed).toHaveLength(1);
    expect(late.issues[0]!.rule).toBe("resposta-tardia");
  });

  it("precisão por bloco aplica margem de segurança maior", () => {
    const report = validateTimeline(
      [
        comment("c6", 20_000, "Porto", {
          temporalRelation: "ANSWER_TO_PRESENTER",
          triggerType: "PRESENTER_EVENT",
          triggerId: "e1",
        }),
      ],
      { ...context, precision: "block" },
    );
    expect(report.kept[0]!.atMs).toBeGreaterThanOrEqual(question.endMs + 4000);
  });
});

