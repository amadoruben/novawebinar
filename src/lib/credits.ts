/**
 * Carteira de IA em dólares. Cada acção paga o custo real que a IA teve
 * (tokens, imagens, minutos de transcrição) mais uma margem fixa e visível.
 * Valores guardados em micro-dólares: 1 USD = 1 000 000.
 */

export const MICROS_PER_USD = 1_000_000;

export type BilledAction =
  | "agent_reply"
  | "chat_generation"
  | "webinar_analysis"
  | "agent_content"
  | "sale_notifications"
  | "image"
  | "transcription";

export const ACTION_LABEL: Record<BilledAction, string> = {
  agent_reply: "Agente IA no chat",
  chat_generation: "Chat inteligente",
  webinar_analysis: "Análise da audiência",
  agent_content: "FAQs e objeções com IA",
  sale_notifications: "Notificações de venda",
  image: "Imagens com IA",
  transcription: "Transcrição do vídeo",
};

/** O que cada acção conta como uma vez, para a tabela de preços. */
export const ACTION_UNIT: Record<BilledAction, string> = {
  agent_reply: "por resposta",
  chat_generation: "por geração",
  webinar_analysis: "por análise",
  agent_content: "por geração",
  sale_notifications: "por geração",
  image: "por imagem",
  transcription: "por hora de vídeo",
};

/**
 * Planos com créditos de IA incluídos todos os meses. Os valores são os de
 * plan_monthly_allowance_micros (migração 0048): mudar um é mudar os dois.
 * Qualquer outro plano (o «professional» por omissão) não inclui créditos.
 */
export const PLANS = [
  { id: "creator", label: "Criador", allowanceMicros: 10 * MICROS_PER_USD },
  { id: "business", label: "Negócio", allowanceMicros: 25 * MICROS_PER_USD },
  { id: "agency", label: "Agência", allowanceMicros: 50 * MICROS_PER_USD },
] as const;

export function planLabel(plan: string) {
  return (
    PLANS.find((p) => p.id === plan)?.label ?? (plan === "professional" ? "Profissional" : plan)
  );
}

/** Movimentos que não são gastos, para o histórico. */
export const KIND_LABEL: Record<string, string> = {
  grant: "Créditos incluídos",
  purchase: "Recarga",
  usage: "Gasto",
  refund: "Devolução",
  adjustment: "Acerto",
  expire: "Créditos do plano expirados",
};

/** O que nunca gasta créditos: regras e dados, não IA. */
export const ALWAYS_FREE = [
  "Contactos, jornada e temperatura de cada lead",
  "Origem dos leads e conversão por origem",
  "Kambafy, outras plataformas de venda, pixels e webhooks",
  "Métricas, retenção e exportações",
];

export type Pricing = {
  /** USD por milhão de tokens enviados / gerados, do fornecedor de IA. */
  inputPerMTok: number;
  outputPerMTok: number;
  /** USD por imagem gerada. */
  imageUsd: number;
  /** USD por hora de áudio transcrito. */
  transcriptionPerHourUsd: number;
  /** Margem sobre o custo real (0,4 = 40 %). */
  margin: number;
};

/** tokens × USD/milhão dá directamente micro-dólares; depois a margem. */
export function tokenCostMicros(inputTokens: number, outputTokens: number, p: Pricing) {
  return Math.ceil(
    (inputTokens * p.inputPerMTok + outputTokens * p.outputPerMTok) * (1 + p.margin),
  );
}

export function usdCostMicros(usd: number, margin: number) {
  return Math.ceil(usd * MICROS_PER_USD * (1 + margin));
}

export function formatUsd(micros: number) {
  const usd = micros / MICROS_PER_USD;
  // Gastos de fracções de cêntimo (uma resposta do agente) mostram 4 casas.
  const digits = usd !== 0 && Math.abs(usd) < 0.01 ? 4 : 2;
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(usd);
}

/** Preços ao cliente (já com a margem); null = o fornecedor ainda não tem preço no .env. */
export type PublicPrices = {
  margin: number;
  /** Há preço para o texto (respostas, gerações, análises). */
  text: boolean;
  imageMicros: number | null;
  transcriptionHourMicros: number | null;
};

export function publicPrices(p: Pricing & { configured: boolean }): PublicPrices {
  return {
    margin: p.margin,
    text: p.configured,
    imageMicros: p.imageUsd > 0 ? usdCostMicros(p.imageUsd, p.margin) : null,
    transcriptionHourMicros:
      p.transcriptionPerHourUsd > 0 ? usdCostMicros(p.transcriptionPerHourUsd, p.margin) : null,
  };
}

const DAY_MS = 86_400_000;

export function monthStartUtc(now = Date.now()) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

/** Movimentos do livro que o painel lê de uma vez (os mais recentes). */
export const LEDGER_LIMIT = 500;

/** O livro lido não chega ao início do mês: as contas do mês por acção ficam incompletas. */
export function ledgerCutInMonth(rows: { created_at: string }[], now = Date.now()) {
  const oldest = rows.at(-1);
  return rows.length >= LEDGER_LIMIT && !!oldest && Date.parse(oldest.created_at) > monthStartUtc(now);
}

type LedgerLike = { kind: string; action: string; amount_micros: number; created_at: string };
export type ActionSpend = { action: string; runs: number; micros: number };

/** Gastos por acção desde `sinceMs`, do maior para o menor. */
export function spendByAction(rows: LedgerLike[], sinceMs = 0): ActionSpend[] {
  const by = new Map<string, ActionSpend>();
  for (const r of rows) {
    if (r.kind !== "usage" || Date.parse(r.created_at) < sinceMs) continue;
    const cur = by.get(r.action) ?? { action: r.action, runs: 0, micros: 0 };
    cur.runs += 1;
    cur.micros += -r.amount_micros;
    by.set(r.action, cur);
  }
  return [...by.values()].sort((a, b) => b.micros - a.micros);
}

/** Dias que o saldo dura ao ritmo de gasto deste mês; null sem gasto ou sem saldo. */
export function runwayDays(balanceMicros: number, monthSpentMicros: number, now = Date.now()) {
  if (balanceMicros <= 0 || monthSpentMicros <= 0) return null;
  // Conta pelo menos um dia: nas primeiras horas do mês o ritmo sairia exagerado.
  const elapsed = Math.max(1, (now - monthStartUtc(now)) / DAY_MS);
  return Math.floor(balanceMicros / (monthSpentMicros / elapsed));
}

export type CreditState = {
  balance_micros: number;
  month_spent_micros: number;
  plan: string;
  plan_allowance_micros: number;
  plan_remaining_micros: number;
  cap_micros: number | null;
};

/** Porque é que uma acção não pode correr agora, ou null se pode. */
export function blockedReason(state: CreditState): string | null {
  if (state.balance_micros <= 0) return "Os créditos acabaram. Carregue créditos para continuar.";
  if (state.cap_micros && state.month_spent_micros >= state.cap_micros) {
    return "Atingiu o limite mensal de gasto com IA definido em Créditos.";
  }
  return null;
}
