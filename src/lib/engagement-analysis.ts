/**
 * Tipos e apoio do motor de Engagement Intelligence.
 *
 * Este ficheiro é seguro para o navegador: só descreve o formato da análise
 * do webinar e alguns cálculos simples usados tanto no editor como no motor.
 */

export type EngagementObjective = "retention" | "engagement" | "conversion" | "balanced";

export const OBJECTIVE_LABEL: Record<EngagementObjective, string> = {
  retention: "Retenção",
  engagement: "Engajamento",
  conversion: "Conversão",
  balanced: "Equilibrado",
};

export type DropRisk = "baixo" | "moderado" | "alto" | "critico";

export const RISK_LABEL: Record<DropRisk, string> = {
  baixo: "Baixo",
  moderado: "Moderado",
  alto: "Alto",
  critico: "Crítico",
};

/** Um trecho do webinar com significado próprio e as suas notas internas. */
export type AnalysisSegment = {
  from: number;
  to: number;
  /** Tipo do trecho: abertura, historia, tecnico, prova-social, oferta, preco, cta... */
  kind: string;
  /** Resumo curto do que acontece, em linguagem simples. */
  summary: string;
  engagement: number;
  dropRisk: DropRisk;
  emotion: number;
  density: number;
  purchaseIntent: number;
  objection: number;
  ctaProximity: number;
  /** O apresentador lê ou cita o chat neste trecho. */
  readsChat: boolean;
  /** Pergunta direta feita ao público, quando existe. */
  hostQuestion: string;
};

export type PersonaKnowledge = "iniciante" | "intermedio" | "experiente";

export type PersonaRhythm = "observadora" | "moderada" | "participativa";

export type AnalysisPersona = {
  name: string;
  /** Traço dominante: entusiasta, racional, reservada, participativa. */
  style: string;
  /** Contexto fixo desta pessoa durante a sessão (experiência, situação, cidade). */
  profile: string;
  emojis: "poucos" | "alguns" | "muitos";
  /** Nível de conhecimento do tema: muda a forma como lê o conteúdo. */
  knowledge?: PersonaKnowledge;
  /** Ritmo próprio: observadora (fala pouco), moderada, participativa. */
  rhythm?: PersonaRhythm;
  /** Segundo em que entra na sala (0 = desde o início). Chegadas tardias. */
  arrivalAt?: number;
};

export type AnalysisInsight = {
  at: number;
  level: "bom" | "atencao" | "risco";
  title: string;
  note: string;
};

export type AnalysisRescue = {
  from: number;
  to: number;
  risk: DropRisk;
  reason: string;
  suggestions: string[];
};

export type AnalysisScore = {
  overall: number;
  retention: number;
  engagement: number;
  clarity: number;
  pace: number;
  offer: number;
  cta: number;
  summary: string;
};

/**
 * Chamada direta à audiência: o apresentador pergunta, pede uma palavra no
 * chat ou convida a levantar a mão. É o momento de maior prioridade de
 * engajamento — as respostas nascem sempre depois da fala.
 */
export type AudiencePrompt = {
  /** Segundo em que o apresentador termina o pedido. */
  at: number;
  /** O que ele pergunta, em palavras dele. */
  ask: string;
  /** Tipo de resposta esperada: cidade, sim-nao, palavra-chave, experiencia, duvida, interesse, numero, livre. */
  expects: string;
  /** Palavra exata a escrever, quando ele a pede ("EU", "SIM", "1"). */
  keyword: string;
  /** Quão explícito é o pedido de interação (0 a 100). */
  intensity: number;
};

/**
 * Momento semântico: uma ideia completa, do início à conclusão.
 * As reações nascem depois de `to`, espalhadas até `reactionUntil`.
 */
export type SemanticMoment = {
  id: string;
  from: number;
  /** Segundo em que a ideia fecha. */
  to: number;
  /** Tema da ideia, para a memória semântica das personas. */
  topic: string;
  /** Resumo curto do que foi explicado ou revelado. */
  summary: string;
  /** Quão novo/importante é (0-100): separa frases normais de "momentos aha". */
  novelty: number;
  /** Até quando faz sentido alguém reagir a este momento. */
  reactionUntil: number;
};

/**
 * Estado coletivo ESTIMADO da audiência naquele segundo.
 *
 * São estimativas do modelo, nunca factos: na Fase 3 serão calibradas com o
 * comportamento real. Representam uma tendência coletiva — não obrigam todas
 * as personas a reagir da mesma maneira.
 */
export type AudienceStatePoint = {
  at: number;
  estimatedAttention: number;
  estimatedConfusion: number;
  estimatedExcitement: number;
  estimatedTrust: number;
  estimatedPurchaseIntent: number;
  estimatedObjection: number;
  chatEnergy: number;
};

export type WebinarAnalysis = {
  objective: EngagementObjective;
  durationSeconds: number;
  segments: AnalysisSegment[];
  personas: AnalysisPersona[];
  insights: AnalysisInsight[];
  rescue: AnalysisRescue[];
  score: AnalysisScore;
  /** Chamadas diretas à audiência detetadas ao longo do webinar. */
  prompts: AudiencePrompt[];
  /** Ideias completas com início, fim e janela de reação. */
  moments?: SemanticMoment[];
  /** Curva estimada do estado coletivo da audiência. */
  audienceState?: AudienceStatePoint[];
};

/** Estado coletivo estimado mais recente até este segundo. */
export function audienceStateAt(
  state: AudienceStatePoint[] | undefined,
  seconds: number,
): AudienceStatePoint | null {
  if (!state || state.length === 0) return null;
  let current: AudienceStatePoint | null = null;
  for (const point of state) {
    if (point.at <= seconds) current = point;
    else break;
  }
  return current ?? state[0] ?? null;
}

/** O momento semântico que contém (ou acaba perto) deste segundo. */
export function momentAt(moments: SemanticMoment[] | undefined, seconds: number) {
  if (!moments) return null;
  return (
    moments.find((m) => seconds >= m.from && seconds <= m.to) ??
    moments.find((m) => Math.abs(m.to - seconds) <= 20) ??
    null
  );
}

/** Quantas respostas faz sentido criar para uma chamada direta. */
export function answersForPrompt(prompt: AudiencePrompt, participants: number): number {
  const intensity = Math.max(0, Math.min(100, prompt.intensity)) / 100;
  const crowd = Math.max(3, Math.min(60, Math.round(participants / 4)));
  return Math.max(3, Math.min(crowd, Math.round(3 + intensity * 9)));
}

/** Chamadas diretas que caem dentro (ou muito perto) de um intervalo. */
export function promptsBetween(prompts: AudiencePrompt[], from: number, to: number) {
  return prompts.filter((p) => p.at >= from - 45 && p.at <= to);
}

export function clockLabel(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const RISK_WEIGHT: Record<DropRisk, number> = {
  baixo: 0.85,
  moderado: 1,
  alto: 1.35,
  critico: 1.6,
};

/**
 * Densidade adaptativa: quantas mensagens por minuto fazem sentido neste
 * trecho, dado o que lá acontece e o objetivo escolhido. Um trecho técnico e
 * calmo fica quase em silêncio; uma pergunta direta ou o CTA enchem o chat.
 */
export function densityForSegment(
  segment: AnalysisSegment,
  objective: EngagementObjective,
  basePerMinute: number,
): number {
  // O potencial de engajamento manda; a densidade de informação trava.
  const engagement = clamp01(segment.engagement / 100);
  const density = clamp01(segment.density / 100);
  let factor = 0.25 + engagement * 1.9 - density * 0.5;

  factor *= RISK_WEIGHT[segment.dropRisk];
  if (segment.hostQuestion) factor += 0.9;
  if (segment.readsChat) factor += 0.5;

  if (objective === "retention") factor += clamp01(segment.dropRisk === "baixo" ? 0 : 0.4);
  if (objective === "conversion")
    factor += clamp01(segment.purchaseIntent / 100) + clamp01(segment.ctaProximity / 100) * 0.6;
  if (objective === "engagement") factor += 0.35;

  return Math.max(0, Math.min(14, basePerMinute * factor));
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * Arranque da sala: os primeiros minutos nunca podem começar fracos.
 * Toda a gente entra ao mesmo tempo, cumprimenta e mostra presença — o chat
 * está no seu ponto mais cheio. O reforço desce até ao ritmo normal aos 6 min.
 */
export const OPENING_SURGE_SECONDS = 360;

/** Multiplicador de densidade num segundo do arranque. */
export function openingSurgeAt(seconds: number): number {
  if (seconds >= OPENING_SURGE_SECONDS) return 1;
  if (seconds <= 60) return 3;
  const progress = (seconds - 60) / (OPENING_SURGE_SECONDS - 60);
  return 3 - progress * 2;
}

/** Multiplicador médio do arranque para uma janela de tempo. */
export function openingSurgeFactor(from: number, to: number): number {
  if (from >= OPENING_SURGE_SECONDS) return 1;
  const end = Math.max(from + 1, to);
  let total = 0;
  let steps = 0;
  for (let second = from; second <= end; second += 10) {
    total += openingSurgeAt(second);
    steps += 1;
  }
  return steps > 0 ? total / steps : 1;
}

export function segmentAt(analysis: WebinarAnalysis | null, seconds: number) {
  if (!analysis) return null;
  return analysis.segments.find((s) => seconds >= s.from && seconds <= s.to) ?? null;
}
