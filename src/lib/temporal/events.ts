/**
 * Deteção determinística de eventos do apresentador a partir das frases.
 *
 * Só se marca um evento quando a frase o justifica: nada é inventado.
 */
import type { NormalizedSentence, PresenterEvent, PresenterEventType, ExpectedResponseType } from "./types";

type Rule = {
  type: PresenterEventType;
  expected: ExpectedResponseType;
  windowMs: number;
  test: RegExp;
  confidence: number;
};

const RULES: Rule[] = [
  {
    type: "REQUEST_LOCATION",
    expected: "LOCATION",
    windowMs: 60_000,
    test: /\b((de|d[ao]s) onde (é que )?(vocês|voc[eê]s|est[ãa]o|me (est[ãa]o a )?ver|tu est|é que est)|(comenta|comente|comentem|escrev[ea]|escrevam|digit[ea]|digitem|manda|mandem|fala|falem|diz|digam|põe|poe|coloca|coloque|coloquem|me diz|me dig)[a-z]*\s*(a[ií]|l[áa]|aqui|no chat|a[ií] no chat)?\s*(de|d[ao])\s*onde|quero saber de onde|quem (é|e) (de|da|do)\s|escrev[ea] (a[ií] )?(a )?(tua |sua )?cidade|diz[- ]?me (a )?(tua |sua )?cidade|de que (pa[íi]s|cidade))\b/i,
    confidence: 0.9,
  },
  {
    type: "REQUEST_TO_TYPE",
    expected: "KEYWORD",
    windowMs: 60_000,
    test: /\b(escrev[ea]|escrevam|digit[ea]|digitem|comenta|comentem|manda|mandem|põe|poe|coloca|coloque|coloquem|fala|falem|me diz|me dig[a-z]+)\b[^.?!]{0,50}\b(no chat|a[ií]|aqui|abaixo|ali|l[áa])\b/i,
    confidence: 0.85,
  },
  {
    type: "REQUEST_CONFIRMATION",
    expected: "CONFIRMATION",
    windowMs: 35_000,
    test: /\b(quem (aqui )?(est[áa]|j[áa]|trabalha|tem|quer|nunca)[^.?!]{0,50}\?|levanta a m[ãa]o quem|faz sentido\?|conseguem ver\?|est[ãa]o a ouvir\?|d[áa] para ver\?|d[áa] para ouvir\?)/i,
    confidence: 0.8,
  },
  {
    type: "DIRECT_QUESTION",
    expected: "ANSWER",
    windowMs: 60_000,
    test: /\b(o que (é que )?(vocês|voc[eê]s|tu)|qual (é )?(a tua|o teu|a vossa|o vosso)|quantos (de )?(voc[eê]s|j[áa])|quantos j[áa]|j[áa] alguma vez|me diz a[ií]|quero saber)\b[^?]{0,140}\?/i,
    confidence: 0.75,
  },

  {
    type: "CHAT_REFERENCE",
    expected: "NONE",
    windowMs: 0,
    test: /\b(vi (aqui )?(uma|um) (pergunta|coment[áa]rio)|est[ãa]o a perguntar|algu[ée]m (perguntou|escreveu)|aqui no chat|vejo (aqui )?no chat|boa pergunta)\b/i,
    confidence: 0.8,
  },
  {
    type: "PRICE_REVEAL",
    expected: "REACTION",
    windowMs: 60_000,
    test: /\b(custa|investimento (é|de)|pre[çc]o (é|de)|fica por|s[ãa]o apenas)\b[^.?!]{0,30}(€|euros?|\d)/i,
    confidence: 0.7,
  },
  {
    type: "OFFER_TRANSITION",
    expected: "REACTION",
    windowMs: 60_000,
    test: /\b(vou (agora )?(te )?(falar|apresentar) (da|do|sobre)[^.?!]{0,20}(oferta|programa|forma[çc][ãa]o)|deixa[- ]me mostrar[- ]te o que|a oferta (de hoje|é))\b/i,
    confidence: 0.7,
  },
  {
    type: "CTA",
    expected: "REACTION",
    windowMs: 90_000,
    test: /\b(clica (no|em)|carrega no bot[ãa]o|inscreve[- ]te|garante (j[áa] )?(o teu|a tua)|link (aqui )?(em ?baixo|abaixo))\b/i,
    confidence: 0.75,
  },
  {
    type: "URGENCY",
    expected: "REACTION",
    windowMs: 60_000,
    test: /\b(só até|apenas hoje|últimas vagas|[úu]ltimas vagas|termina (hoje|em)|encerra (hoje|em))\b/i,
    confidence: 0.7,
  },
  {
    type: "RHETORICAL_QUESTION",
    expected: "NONE",
    windowMs: 0,
    test: /\?\s*$/,
    confidence: 0.4,
  },
];

export function detectPresenterEvents(sentences: NormalizedSentence[]): PresenterEvent[] {
  const events: PresenterEvent[] = [];
  sentences.forEach((sentence, index) => {
    const rule = RULES.find((candidate) => candidate.test.test(sentence.text));
    if (!rule) return;
    events.push({
      id: `e${index + 1}`,
      type: rule.type,
      startMs: sentence.startMs,
      endMs: sentence.endMs,
      triggerText: sentence.text,
      expectedResponseType: rule.expected,
      responseWindowMs: rule.windowMs,
      confidence: rule.confidence,
      semanticMomentId: null,
    });
  });
  return events;
}

/** Eventos que esperam resposta escrita da audiência. */
export function respondableEvents(events: PresenterEvent[]) {
  return events.filter((event) => event.expectedResponseType !== "NONE");
}

/**
 * Frases que podem ser pedidos à audiência mas que as regras diretas não
 * apanharam. Servem de entrada para a classificação semântica.
 */
export function promptCandidates(
  sentences: NormalizedSentence[],
  events: PresenterEvent[],
): NormalizedSentence[] {
  const covered = new Set(
    events
      .filter((event) => event.expectedResponseType !== "NONE")
      .map((event) => `${event.startMs}`),
  );
  const hint =
    /(\?|a[ií]\b|no chat|quem\b|onde\b|quantos\b|quanto tempo|me diz|me dig|comenta|escrev|digit|manda|fala|levanta a m[ãa]o|quero saber|responde)/i;
  return sentences.filter(
    (sentence) =>
      !covered.has(`${sentence.startMs}`) &&
      sentence.text.length >= 12 &&
      sentence.text.length <= 240 &&
      hint.test(sentence.text),
  );
}

export type ClassifiedPrompt = {
  sentenceId: string;
  isAudiencePrompt: boolean;
  promptType: PresenterEventType;
  expectedResponseType: ExpectedResponseType;
  confidence: number;
};

const PROMPT_TYPES: PresenterEventType[] = [
  "REQUEST_LOCATION",
  "REQUEST_TO_TYPE",
  "REQUEST_CONFIRMATION",
  "DIRECT_QUESTION",
  "AUDIENCE_PROMPT",
];

const WINDOW_BY_EXPECTED: Record<ExpectedResponseType, number> = {
  LOCATION: 60_000,
  KEYWORD: 60_000,
  CONFIRMATION: 35_000,
  ANSWER: 60_000,
  REACTION: 45_000,
  NONE: 0,
};

/** Junta os pedidos reconhecidos pelo sentido aos eventos já detetados. */
export function mergeClassifiedPrompts(
  events: PresenterEvent[],
  classified: ClassifiedPrompt[],
  sentences: NormalizedSentence[],
): PresenterEvent[] {
  const byId = new Map(sentences.map((sentence) => [sentence.id, sentence] as const));
  const out = [...events];
  let extra = 0;
  for (const item of classified) {
    if (!item.isAudiencePrompt || item.confidence < 0.6) continue;
    const sentence = byId.get(item.sentenceId);
    if (!sentence) continue;
    if (out.some((event) => event.startMs === sentence.startMs)) continue;
    const type = PROMPT_TYPES.includes(item.promptType) ? item.promptType : "AUDIENCE_PROMPT";
    extra += 1;
    out.push({
      id: `p${extra}`,
      type,
      startMs: sentence.startMs,
      endMs: sentence.endMs,
      triggerText: sentence.text,
      expectedResponseType: item.expectedResponseType,
      responseWindowMs: WINDOW_BY_EXPECTED[item.expectedResponseType] ?? 45_000,
      confidence: item.confidence,
      semanticMomentId: null,
    });
  }
  out.sort((a, b) => a.startMs - b.startMs);
  return out;
}

