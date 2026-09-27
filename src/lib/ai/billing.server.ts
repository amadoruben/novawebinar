/**
 * Cobrança da IA pelo custo real. Cada acção paga (responder no chat, gerar o
 * chat, uma imagem…) corre dentro de `runBilled`; todas as chamadas de IA feitas
 * lá dentro somam-se sozinhas e, se a acção terminar bem, fica um único
 * movimento no livro. Se falhar, não se cobra.
 *
 * Os módulos de Node e a chave de serviço só se carregam quando são usados:
 * este ficheiro é importado por módulos que o browser também carrega em dev.
 */
import type { AsyncLocalStorage } from "node:async_hooks";

import {
  ACTION_LABEL,
  blockedReason,
  tokenCostMicros,
  usdCostMicros,
  type BilledAction,
  type CreditState,
  type Pricing,
} from "@/lib/credits";

type Meter = {
  organizationId: string;
  action: BilledAction;
  costMicros: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  images: number;
  transcribedMinutes: number;
};

let storePromise: Promise<AsyncLocalStorage<Meter>> | null = null;
const store = () =>
  (storePromise ??= import("node:async_hooks").then((m) => new m.AsyncLocalStorage<Meter>()));

/** Preços do fornecedor, definidos no .env (nunca inventados aqui). */
export function pricing(): Pricing & { configured: boolean } {
  const num = (key: string, fallback: number) => {
    const raw = process.env[key]?.trim();
    const value = raw ? Number(raw) : NaN;
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  };
  const p = {
    inputPerMTok: num("AI_PRICE_INPUT_PER_MTOK", 0),
    outputPerMTok: num("AI_PRICE_OUTPUT_PER_MTOK", 0),
    imageUsd: num("AI_PRICE_PER_IMAGE", 0),
    transcriptionPerHourUsd: num("TRANSCRIPTION_PRICE_PER_HOUR", 0),
    margin: num("AI_MARGIN", 0.4),
  };
  return { ...p, configured: p.inputPerMTok > 0 && p.outputPerMTok > 0 };
}

let warnedUnmetered = false;
async function meter(kind: string): Promise<Meter | undefined> {
  const current = (await store()).getStore();
  if (!current && !warnedUnmetered) {
    warnedUnmetered = true;
    console.warn(`[billing] ${kind} fora de uma acção cobrada: envolva a entrada com runBilled().`);
  }
  return current;
}

export async function meterTokens(inputTokens: number, outputTokens: number) {
  const m = await meter("chamada de texto");
  if (!m) return;
  m.calls += 1;
  m.inputTokens += inputTokens;
  m.outputTokens += outputTokens;
  m.costMicros += tokenCostMicros(inputTokens, outputTokens, pricing());
}

export async function meterImage() {
  const m = await meter("imagem");
  if (!m) return;
  const p = pricing();
  m.calls += 1;
  m.images += 1;
  m.costMicros += usdCostMicros(p.imageUsd, p.margin);
}

export async function meterTranscription(seconds: number) {
  const m = await meter("transcrição");
  if (!m) return;
  const p = pricing();
  const minutes = Math.max(0, seconds) / 60;
  m.transcribedMinutes += minutes;
  m.costMicros += usdCostMicros((minutes / 60) * p.transcriptionPerHourUsd, p.margin);
}

export class NoCreditsError extends Error {}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export async function creditState(organizationId: string): Promise<CreditState> {
  const { data, error } = await (await admin()).rpc("credit_state", { _organization_id: organizationId });
  if (error) throw new Error(error.message);
  return data as unknown as CreditState;
}

/**
 * Corre uma acção paga. Antes: confirma saldo e limite mensal. Depois: regista
 * o custo real somado de todas as chamadas de IA que a acção fez.
 * `ref` evita cobrar duas vezes a mesma acção repetida.
 */
export async function runBilled<T>(
  ctx: {
    organizationId: string;
    action: BilledAction;
    ref?: string;
    units?: number;
    /** O custo já aconteceu no fornecedor (ex.: fim da transcrição): regista sem bloquear. */
    alreadyIncurred?: boolean;
  },
  fn: () => Promise<T>,
): Promise<T> {
  const als = await store();
  // Já dentro de uma acção cobrada (ex.: a transcrição chama o classificador): soma-se a ela.
  if (als.getStore()) return fn();

  if (!ctx.alreadyIncurred) {
    const blocked = blockedReason(await creditState(ctx.organizationId));
    if (blocked) throw new NoCreditsError(blocked);
  }

  const m: Meter = {
    organizationId: ctx.organizationId,
    action: ctx.action,
    costMicros: 0,
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    images: 0,
    transcribedMinutes: 0,
  };
  const result = await als.run(m, fn);
  if (m.costMicros > 0) {
    const { error } = await (await admin()).rpc("record_credit_usage", {
      _organization_id: ctx.organizationId,
      _action: ctx.action,
      _amount_micros: m.costMicros,
      _units: ctx.units ?? m.calls,
      _description: ACTION_LABEL[ctx.action],
      _ref: ctx.ref ?? null,
      _meta: {
        calls: m.calls,
        input_tokens: m.inputTokens,
        output_tokens: m.outputTokens,
        images: m.images,
        transcribed_minutes: Math.round(m.transcribedMinutes * 10) / 10,
      },
    });
    // Não se perde o resultado que o cliente já recebeu por uma falha a registar.
    if (error) console.error(`[billing] não foi possível registar ${ctx.action}: ${error.message}`);
  }
  return result;
}
