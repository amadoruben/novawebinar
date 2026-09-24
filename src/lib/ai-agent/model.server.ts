/**
 * Ligação ao modelo usado pelo Agente IA.
 *
 * Passa pela camada própria de IA (`chatJson`): o fornecedor e a chave vivem
 * em `src/lib/ai`. O modelo pode ser afinado no servidor (AI_AGENT_MODEL);
 * sem valor, usa-se o modelo por omissão do fornecedor. Nada na interface
 * depende do nome do modelo. Se a chamada falhar, devolvemos um resultado
 * explícito de indisponibilidade — nunca uma resposta inventada.
 */
import { chatJson } from "@/lib/ai/provider";

const MAX_ATTEMPTS = 2;

/** Modelo pedido para o agente; vazio deixa o fornecedor escolher. */
export function agentModel(): string {
  return process.env["AI_AGENT_MODEL"]?.trim() || "";
}

export type ModelResult =
  | { ok: true; text: string; model: string }
  | { ok: false; reason: string; status: number | null; model: string };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pede ao modelo uma resposta em JSON. Tentativa extra apenas em falhas
 * transitórias (limite de pedidos, serviço indisponível, resposta vazia)
 * e erro explícito no resto.
 */
export async function askModelJson(input: {
  system: string;
  user: string;
}): Promise<ModelResult> {
  const model = agentModel();
  let last: ModelResult = { ok: false, reason: "O serviço de IA não respondeu.", status: null, model };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const result = await chatJson({
      system: input.system,
      user: input.user,
      ...(model ? { model } : {}),
    });

    if (result.ok) return { ok: true, text: result.text, model: result.model };

    last = { ok: false, reason: result.reason, status: result.status, model: result.model };
    const transient =
      result.code === "rate_limited" ||
      result.code === "unavailable" ||
      result.code === "timeout" ||
      result.code === "invalid_json";
    if (!transient) break;
    await sleep(attempt * 1500);
  }

  return last;
}

/** Extrai o primeiro objeto JSON de um texto do modelo. */
export function parseJsonObject<T>(text: string): T | null {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
