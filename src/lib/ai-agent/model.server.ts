/**
 * Ligação ao modelo usado pelo Agente IA.
 *
 * O modelo é configurável no servidor (AI_AGENT_MODEL). Nada na interface
 * depende do nome do modelo. Se a chamada falhar, devolvemos um resultado
 * explícito de indisponibilidade — nunca uma resposta inventada.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const DEFAULT_MODEL = "openai/gpt-6-astra";
/** Sem bytes durante este tempo, damos a chamada como perdida. */
const INACTIVITY_MS = 60_000;
const MAX_ATTEMPTS = 2;

export function agentModel(): string {
  return process.env["AI_AGENT_MODEL"]?.trim() || DEFAULT_MODEL;
}

export type ModelResult =
  | { ok: true; text: string; model: string }
  | { ok: false; reason: string; status: number | null; model: string };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Lê a resposta em streaming e junta o texto; aborta se o fluxo parar. */
async function readStream(response: Response, isResponsesApi: boolean): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  for (;;) {
    const chunk = await Promise.race([
      reader.read(),
      sleep(INACTIVITY_MS).then(() => "timeout" as const),
    ]);
    if (chunk === "timeout") {
      await reader.cancel().catch(() => {});
      throw new Error("timeout");
    }
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload) as Record<string, unknown>;
        if (isResponsesApi) {
          if (event["type"] === "response.output_text.delta") {
            text += String(event["delta"] ?? "");
          }
        } else {
          const choices = event["choices"] as { delta?: { content?: string } }[] | undefined;
          text += choices?.[0]?.delta?.content ?? "";
        }
      } catch {
        /* fragmento incompleto: ignora-se */
      }
    }
  }
  return text;
}

/**
 * Pede ao modelo uma resposta em JSON. Timeout de inatividade, tentativa
 * extra apenas em falhas transitórias (429/5xx) e erro explícito no resto.
 */
export async function askModelJson(input: {
  system: string;
  user: string;
}): Promise<ModelResult> {
  const key = process.env["LOVABLE_API_KEY"];
  const model = agentModel();
  if (!key) return { ok: false, reason: "Serviço de IA não configurado.", status: null, model };

  const responsesApi = model.startsWith("openai/");
  const url = responsesApi ? `${GATEWAY}/responses` : `${GATEWAY}/chat/completions`;
  const body = responsesApi
    ? {
        model,
        stream: true,
        reasoning: { effort: "low" },
        input: [
          { role: "system", content: [{ type: "input_text", text: input.system }] },
          { role: "user", content: [{ type: "input_text", text: input.user }] },
        ],
      }
    : {
        model,
        stream: true,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      };

  let lastStatus: number | null = null;
  let lastReason = "O serviço de IA não respondeu.";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": key,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        lastStatus = response.status;
        lastReason =
          response.status === 402
            ? "Créditos de IA esgotados."
            : `O serviço de IA respondeu ${response.status}.`;
        const transient = response.status === 429 || response.status >= 500;
        await response.body?.cancel().catch(() => {});
        if (!transient) break;
        await sleep(attempt * 1500);
        continue;
      }

      const text = await readStream(response, responsesApi);
      if (!text.trim()) {
        lastReason = "O serviço de IA devolveu uma resposta vazia.";
        await sleep(attempt * 1000);
        continue;
      }
      return { ok: true, text, model };
    } catch (error) {
      lastReason =
        (error as Error)?.message === "timeout"
          ? "O serviço de IA demorou demasiado a responder."
          : "Não foi possível contactar o serviço de IA.";
      await sleep(attempt * 1000);
    }
  }

  return { ok: false, reason: lastReason, status: lastStatus, model };
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
