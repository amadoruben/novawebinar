/**
 * Deteção semântica de pedidos à audiência.
 *
 * As regras diretas apanham as formas óbvias ("escreve no chat"). Aqui
 * lê-se o sentido da frase, para reconhecer também "comenta aí de onde",
 * "quem é de Lisboa", "me diz aí quanto tempo", "levanta a mão quem já".
 * Nunca inventa frases: só classifica as que existem na transcrição.
 */
import { AIError, chatJson, isConfigured } from "@/lib/ai/provider";

import type { ClassifiedPrompt } from "./events";
import type { NormalizedSentence } from "./types";

const BATCH = 60;

export async function classifyAudiencePrompts(
  candidates: NormalizedSentence[],
): Promise<ClassifiedPrompt[]> {
  if (!isConfigured() || candidates.length === 0) return [];

  const out: ClassifiedPrompt[] = [];
  for (let index = 0; index < candidates.length; index += BATCH) {
    const chunk = candidates.slice(index, index + BATCH);
    try {
      out.push(...(await askBatch(chunk)));
    } catch {
      /* a camada de regras continua a valer */
    }
  }
  return out;
}

async function askBatch(chunk: NormalizedSentence[]): Promise<ClassifiedPrompt[]> {
  const lines = chunk.map((sentence) => `${sentence.id}: ${sentence.text}`).join("\n");
  const prompt = [
    "És um analista de webinars. Recebes frases ditas pelo apresentador e dizes, para cada uma, se é um PEDIDO DE PARTICIPAÇÃO à audiência (algo a que faz sentido as pessoas responderem no chat).",
    "",
    "Contam como pedido, em qualquer formulação: pedir a cidade/país ou de onde estão a ver; pedir para escrever, digitar, comentar ou mandar algo no chat; perguntar quem já fez/tem/trabalha com algo; perguntar quanto tempo, quanto faturam, qual a experiência; pedir confirmação (\"faz sentido?\", \"conseguem ver?\"); pedir para levantar a mão.",
    "NÃO contam: perguntas retóricas que o próprio apresentador responde a seguir, promessas, exemplos, histórias.",
    "",
    "Tipos possíveis: REQUEST_LOCATION (de onde são), REQUEST_TO_TYPE (escrever uma palavra/frase no chat), REQUEST_CONFIRMATION (sim/não, quem já), DIRECT_QUESTION (resposta aberta), AUDIENCE_PROMPT (outro pedido de participação).",
    "Resposta esperada: LOCATION, KEYWORD, CONFIRMATION, ANSWER ou NONE.",
    "",
    `Frases:\n${lines}`,
    "",
    'Responde só com JSON: {"prompts":[{"id":"<id da frase>","isAudiencePrompt":true|false,"promptType":"<tipo>","expectedResponseType":"<resposta>","confidence":<0 a 1>}]} — inclui todas as frases.',
  ].join("\n");

  const result = await chatJson({
    system: "Classificas frases de apresentadores. Devolves sempre JSON válido.",
    user: prompt,
  });
  if (!result.ok) throw new AIError(result);

  const parsed = result.json as {
    prompts?: {
      id?: unknown;
      isAudiencePrompt?: unknown;
      promptType?: unknown;
      expectedResponseType?: unknown;
      confidence?: unknown;
    }[];
  };

  const ids = new Set(chunk.map((sentence) => sentence.id));
  return (parsed.prompts ?? [])
    .map((item) => ({
      sentenceId: String(item.id ?? ""),
      isAudiencePrompt: Boolean(item.isAudiencePrompt),
      promptType: String(item.promptType ?? "AUDIENCE_PROMPT") as ClassifiedPrompt["promptType"],
      expectedResponseType: String(
        item.expectedResponseType ?? "ANSWER",
      ) as ClassifiedPrompt["expectedResponseType"],
      confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0)),
    }))
    .filter((item) => ids.has(item.sentenceId));
}
