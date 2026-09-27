/**
 * AIModelGateway: a única entrada da IA no produto.
 *
 * O resto do código diz o que quer (`task`, prompts e o esquema da resposta)
 * e recebe o objeto já lido. Aqui decide-se o resto:
 *  - fornecedor: principal, reserva e segunda reserva (`./models.ts`);
 *  - modelo, limite de saída, esforço e tempo limite pela tarefa;
 *  - repetições com espera crescente nas falhas passageiras;
 *  - passagem ao fornecedor seguinte quando um falha;
 *  - disjuntor por fornecedor;
 *  - cobrança ao saldo e uma linha por chamada em `ai_calls`.
 *
 * Nenhum outro módulo chama um fornecedor directamente.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

import {
  currentOrganizationId,
  meterImage,
  meterTokens,
  providerCostMicros,
} from "./billing.server";
import { modelPrice, providerOrder, ROUTES } from "./models";
import { backoffMs, Breaker, PROVIDER_FAULTS, RETRYABLE, type BreakerState } from "./policy";
import { anthropicProvider } from "./providers/anthropic.server";
import { geminiProvider } from "./providers/gemini.server";
import { openAiProvider } from "./providers/openai.server";
import {
  failure,
  PROVIDER_IDS,
  type AIModelProvider,
  type ChatJsonFailure,
  type ChatJsonInput,
  type ChatJsonResult,
  type ImageInput,
  type ImageResult,
  type ProviderId,
  type Usage,
} from "./types";

export { AIError } from "./types";
export type { ChatJsonInput, ChatJsonResult } from "./types";

const PROVIDERS: Record<ProviderId, AIModelProvider> = {
  openai: openAiProvider,
  gemini: geminiProvider,
  anthropic: anthropicProvider,
};

const breakers = new Map<ProviderId, Breaker>();
const breakerFor = (id: ProviderId) => {
  let breaker = breakers.get(id);
  if (!breaker) breakers.set(id, (breaker = new Breaker()));
  return breaker;
};

/** Fornecedores configurados, pela ordem do ambiente. */
function candidates(): AIModelProvider[] {
  return providerOrder()
    .map((id) => PROVIDERS[id])
    .filter((provider) => provider.isConfigured());
}

export function isConfigured() {
  return candidates().length > 0;
}

/** Estado de cada fornecedor, para diagnóstico. */
export function providerStatus(): {
  id: ProviderId;
  configured: boolean;
  /** Posição na ordem (0 = principal), ou null se não estiver na ordem. */
  order: number | null;
  breaker: BreakerState;
}[] {
  const order = providerOrder();
  return PROVIDER_IDS.map((id) => ({
    id,
    configured: PROVIDERS[id].isConfigured(),
    order: order.includes(id) ? order.indexOf(id) : null,
    breaker: breakerFor(id).state(),
  }));
}

type CallLog = {
  task: string;
  provider: string;
  model: string;
  attempt: number;
  fallback: boolean;
  latencyMs: number;
  result: ChatJsonResult | ImageResult;
  usage?: Usage | undefined;
};

/**
 * Uma linha por chamada. Nunca atrasa nem estraga a resposta: corre em
 * paralelo e uma falha a gravar fica só no log do servidor.
 * ponytail: sem espera pela escrita; num alojamento que congela o processo no
 * fim do pedido, trocar por `waitUntil` do alojamento.
 */
function record(entry: CallLog) {
  void (async () => {
    try {
      const inputTokens = entry.usage?.inputTokens ?? 0;
      const outputTokens = entry.usage?.outputTokens ?? 0;
      const { error } = await supabaseAdmin.from("ai_calls").insert({
        organization_id: await currentOrganizationId(),
        task: entry.task,
        provider: entry.provider,
        model: entry.model,
        outcome: entry.result.ok ? "ok" : "error",
        error_code: entry.result.ok ? null : entry.result.code,
        attempt: entry.attempt,
        fallback: entry.fallback,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        // Sem preço configurado, ou sem tokens contados, o custo fica por saber (nunca zero).
        cost_micros: entry.usage
          ? providerCostMicros(entry.model, inputTokens, outputTokens)
          : null,
        pricing_status: modelPrice(entry.model) ? "known" : "unknown",
        // Testes contra o fornecedor real: registados, mas fora de uso, análise e cobrança.
        is_test: process.env["AI_TEST_RUN"] === "1",
        latency_ms: entry.latencyMs,
      });
      if (error) console.error(`[ai] registo da chamada por gravar: ${error.message}`);
    } catch (error) {
      console.error("[ai] registo da chamada por gravar", error);
    }
  })();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const noProvider = (): ChatJsonFailure =>
  failure(
    providerOrder()[0] ?? "nenhum",
    "",
    "not_configured",
    null,
    "nenhum fornecedor com chave",
  );

/**
 * Pede à IA o objeto descrito em `schema`. Nunca lança: devolve sempre um
 * resultado tipado. Quem precisar de exceções usa `AIError`.
 */
export async function chatJson(input: ChatJsonInput): Promise<ChatJsonResult> {
  const route = ROUTES[input.task];
  const providers = candidates();
  if (providers.length === 0) return noProvider();

  let last: ChatJsonFailure | null = null;
  for (const [index, provider] of providers.entries()) {
    const breaker = breakerFor(provider.id);
    const model = provider.model(route.tier);
    if (!breaker.allow()) {
      last = failure(provider.id, model, "unavailable", null, "disjuntor aberto");
      continue;
    }

    for (let attempt = 1; attempt <= route.attempts; attempt += 1) {
      const started = Date.now();
      const result = await provider.complete({
        system: input.system,
        user: input.user,
        schema: input.schema,
        model,
        maxOutputTokens: route.maxOutputTokens,
        effort: route.effort,
        timeoutMs: route.timeoutMs,
      });
      const usage = result.ok
        ? (result.usage ?? {
            // Sem contagem do fornecedor, estima-se ~4 caracteres por token.
            inputTokens: Math.ceil((input.system.length + input.user.length) / 4),
            outputTokens: Math.ceil(JSON.stringify(result.json).length / 4),
          })
        : undefined;
      record({
        task: input.task,
        provider: provider.id,
        model: result.model || model,
        attempt,
        fallback: index > 0,
        latencyMs: Date.now() - started,
        result,
        usage,
      });

      if (result.ok) {
        breaker.success();
        await meterTokens(result.model, usage!.inputTokens, usage!.outputTokens);
        return result;
      }

      last = result;
      if (PROVIDER_FAULTS.includes(result.code)) breaker.failure();
      console.warn(
        `[ai] ${provider.id}/${model} ${input.task} tentativa ${attempt}: ${result.code} ${result.detail ?? ""}`,
      );
      const again = RETRYABLE.includes(result.code) && attempt < route.attempts && breaker.allow();
      if (!again) break;
      await sleep(backoffMs(attempt));
    }
  }
  return last ?? noProvider();
}

/** Ponto único de entrada para imagens. Nunca lança. */
export async function generateImage(input: ImageInput): Promise<ImageResult> {
  const providers = candidates().filter((provider) => provider.generateImage);
  if (providers.length === 0) {
    return failure(
      providerOrder()[0] ?? "nenhum",
      "",
      "not_configured",
      null,
      "nenhum fornecedor gera imagens",
    );
  }

  let last: ImageResult | null = null;
  for (const [index, provider] of providers.entries()) {
    const breaker = breakerFor(provider.id);
    if (!breaker.allow()) continue;
    const started = Date.now();
    const result = await provider.generateImage!({ ...input, timeoutMs: 120_000 });
    record({
      task: "image",
      provider: provider.id,
      model: result.model,
      attempt: 1,
      fallback: index > 0,
      latencyMs: Date.now() - started,
      result,
    });
    if (result.ok) {
      breaker.success();
      await meterImage();
      return result;
    }
    if (PROVIDER_FAULTS.includes(result.code)) breaker.failure();
    last = result;
  }
  return last ?? failure(providers[0]!.id, "", "unavailable", null, "disjuntor aberto");
}
