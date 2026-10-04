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

/** Movimentos que não são gastos, para o histórico. */
export const KIND_LABEL: Record<string, string> = {
  grant: "Saldo incluído",
  purchase: "Recarga",
  usage: "Gasto",
  refund: "Devolução",
  adjustment: "Acerto",
  expire: "Saldo do plano expirado",
};

/** O que nunca gasta saldo: regras e dados, não IA. */
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
  return Math.ceil((inputTokens * p.inputPerMTok + outputTokens * p.outputPerMTok) * (1 + p.margin));
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
