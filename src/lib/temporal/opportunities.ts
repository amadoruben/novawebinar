/**
 * Oportunidades: o webinar é que cria as ocasiões para alguém escrever.
 *
 * Antes de qualquer chamada ao modelo, calculamos onde e quando é possível
 * existir uma mensagem: qual foi o pedido ou a ideia, quando é que ela
 * acabou de facto, entre que instantes é aceitável responder e quantas
 * pessoas é plausível responderem. A IA escolhe o conteúdo e a persona
 * dentro destas oportunidades; nunca o instante em bruto.
 */
import { baseAnswerWindow, baseReactionWindow } from "./windows";
import type { PresenterEvent, TemporalSemanticMoment } from "./types";

export type Opportunity = {
  id: string;
  kind: "resposta" | "reacao";
  triggerType: "PRESENTER_EVENT" | "SEMANTIC_MOMENT";
  triggerId: string;
  triggerStartMs: number;
  triggerEndMs: number;
  triggerText: string;
  expectedResponseType: PresenterEvent["expectedResponseType"];
  earliestMs: number;
  latestMs: number;
  maxMessages: number;
  topicId: string | null;
};

function labelOf(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Oportunidades de um trecho do webinar (segundos). */
export function buildOpportunities(input: {
  fromSeconds: number;
  toSeconds: number;
  events: PresenterEvent[];
  moments: TemporalSemanticMoment[];
  participants: number;
}): Opportunity[] {
  const fromMs = input.fromSeconds * 1000;
  const toMs = input.toSeconds * 1000;
  const out: Opportunity[] = [];

  for (const event of input.events) {
    if (event.expectedResponseType === "NONE") continue;
    if (event.endMs < fromMs - 30_000 || event.endMs > toMs) continue;
    if (event.confidence < 0.6) continue;
    const window = baseAnswerWindow(event);
    const crowd =
      event.expectedResponseType === "LOCATION" || event.expectedResponseType === "CONFIRMATION"
        ? 0.32
        : 0.18;
    out.push({
      id: `${event.type.toLowerCase()}_${labelOf(event.endMs / 1000).replace(":", "_")}_${event.id}`,
      kind: "resposta",
      triggerType: "PRESENTER_EVENT",
      triggerId: event.id,
      triggerStartMs: event.startMs,
      triggerEndMs: event.endMs,
      triggerText: event.triggerText,
      expectedResponseType: event.expectedResponseType,
      earliestMs: window.earliestMs,
      latestMs: window.latestMs,
      maxMessages: Math.max(2, Math.min(12, Math.round(input.participants * crowd))),
      topicId: null,
    });
  }

  for (const moment of input.moments) {
    if (moment.endMs < fromMs - 15_000 || moment.endMs > toMs) continue;
    const weight = (moment.novelty + moment.emotionalIntensity) / 2;
    if (weight < 45) continue;
    const kind = weight >= 75 ? "reflexiva" : "media";
    const window = baseReactionWindow(moment, kind);
    out.push({
      id: `reacao_${labelOf(moment.endMs / 1000).replace(":", "_")}_${moment.id}`,
      kind: "reacao",
      triggerType: "SEMANTIC_MOMENT",
      triggerId: moment.id,
      triggerStartMs: moment.startMs,
      triggerEndMs: moment.endMs,
      triggerText: moment.summary || moment.topic,
      expectedResponseType: "REACTION",
      earliestMs: window.earliestMs,
      latestMs: window.latestMs,
      maxMessages: Math.max(1, Math.min(8, Math.round((weight / 100) * input.participants * 0.22))),
      topicId: moment.topicId ?? null,
    });
  }

  out.sort((a, b) => a.earliestMs - b.earliestMs);
  return out;
}

/**
 * Momentos aproximados a partir das frases, quando o webinar ainda não tem
 * um mapa semântico. Junta frases seguidas em blocos com uma ideia inteira
 * e dá-lhes um peso pelo conteúdo (números, valores, ênfase, histórias).
 */
export function momentsFromSentences(
  sentences: { id: string; startMs: number; endMs: number; text: string }[],
  blockMs = 22_000,
): TemporalSemanticMoment[] {
  const out: TemporalSemanticMoment[] = [];
  let group: typeof sentences = [];

  const flush = () => {
    if (group.length === 0) return;
    const first = group[0]!;
    const last = group[group.length - 1]!;
    const text = group.map((item) => item.text).join(" ");
    const hasNumbers = /\d/.test(text);
    const emphasis =
      /(nunca|sempre|segredo|erro|milh|mil |euros|€|reais|garant|impressionante|incr[íi]vel|olha|atenção|repara|verdade)/i.test(
        text,
      );
    const novelty = Math.min(100, 35 + (hasNumbers ? 25 : 0) + Math.min(25, text.length / 40));
    const emotionalIntensity = Math.min(100, 30 + (emphasis ? 35 : 0) + (hasNumbers ? 10 : 0));
    out.push({
      id: `sm_${first.id}`,
      startMs: first.startMs,
      endMs: last.endMs,
      reactionWindowStartMs: last.endMs,
      reactionWindowEndMs: last.endMs + 55_000,
      topic: text.slice(0, 60),
      summary: text.slice(0, 400),
      novelty,
      emotionalIntensity,
      informationDensity: novelty,
      momentType: "outro",
      expectedReactions: [],
      sourceSentenceIds: group.map((item) => item.id),
    });
    group = [];
  };

  for (const sentence of sentences) {
    if (group.length > 0 && sentence.endMs - group[0]!.startMs > blockMs) flush();
    group.push(sentence);
  }
  flush();
  return out;
}


/** Resumo legível das oportunidades, para instruir o modelo. */
export function describeOpportunities(list: Opportunity[]): string {
  return list
    .map((slot) => {
      const from = (slot.earliestMs / 1000).toFixed(1);
      const to = (slot.latestMs / 1000).toFixed(1);
      const what =
        slot.kind === "resposta"
          ? `pedido do apresentador (${slot.expectedResponseType}) que terminou aos ${(slot.triggerEndMs / 1000).toFixed(1)}s: "${slot.triggerText.slice(0, 160)}"`
          : `ideia que terminou aos ${(slot.triggerEndMs / 1000).toFixed(1)}s: "${slot.triggerText.slice(0, 160)}"`;
      return `- ${slot.id} | ${slot.kind} | janela ${from}s–${to}s | até ${slot.maxMessages} mensagens | ${what}`;
    })
    .join("\n");
}
