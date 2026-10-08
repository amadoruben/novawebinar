/**
 * Valores base do Agente IA (módulo de atendimento a participantes reais).
 *
 * Nada aqui toca no Engagement Intelligence: comentários simulados continuam
 * a viver em `scheduled_comments` e nunca se misturam com estas respostas.
 */

export type AgentMode = "desativado" | "copiloto" | "hibrido" | "automatico";

export const TONES = [
  { id: "profissional", label: "Profissional" },
  { id: "proximo", label: "Próximo" },
  { id: "descontraido", label: "Descontraído" },
  { id: "energetico", label: "Energético" },
  { id: "consultivo", label: "Consultivo" },
  { id: "personalizado", label: "Personalizado" },
];

export const LENGTHS = [
  { id: "curto", label: "Curto" },
  { id: "equilibrado", label: "Equilibrado" },
  { id: "detalhado", label: "Detalhado" },
];

export const EMOJI_LEVELS = [
  { id: "nenhum", label: "Nenhum" },
  { id: "poucos", label: "Poucos" },
  { id: "normal", label: "Normal" },
];

export const LANGUAGES = [
  { id: "pt-PT", label: "Português (Portugal)" },
  { id: "pt-BR", label: "Português (Brasil)" },
  { id: "auto", label: "Adaptar ao participante" },
];

export const SPEEDS = [
  { id: "rapida", label: "Rápida" },
  { id: "natural", label: "Natural" },
  { id: "personalizada", label: "Personalizada" },
];

/** Ações permitidas por defeito e ações de risco, desligadas à partida. */
export const PERMISSIONS: { id: string; label: string; risky: boolean }[] = [
  { id: "conteudo", label: "Responder dúvidas sobre o conteúdo", risky: false },
  { id: "produto", label: "Responder sobre o produto", risky: false },
  { id: "preco", label: "Responder preço", risky: false },
  { id: "pagamento", label: "Responder formas de pagamento", risky: false },
  { id: "link", label: "Enviar link da oferta", risky: false },
  { id: "objecoes", label: "Responder objeções", risky: false },
  { id: "garantia", label: "Explicar garantia", risky: false },
  { id: "bonus", label: "Falar sobre bónus", risky: false },
  { id: "negociar", label: "Negociar preço", risky: true },
  { id: "descontos", label: "Criar descontos", risky: true },
  { id: "resultados", label: "Prometer resultados", risky: true },
  { id: "juridico", label: "Responder questões jurídicas", risky: true },
  { id: "medico", label: "Responder questões médicas", risky: true },
  { id: "financeiro", label: "Responder questões financeiras sensíveis", risky: true },
];

export function defaultPermissions(): Record<string, boolean> {
  return Object.fromEntries(PERMISSIONS.map((p) => [p.id, !p.risky]));
}

export const ESCALATION_REASONS = [
  "Pergunta não coberta pela base de conhecimento",
  "Participante pediu uma pessoa da equipa",
  "Questão sensível",
  "Negociação",
  "Reclamação",
  "Reembolso",
  "Informação contraditória",
  "Baixa confiança",
  "Possível problema técnico",
  "Lead de elevada intenção",
];

/** Campos do assistente de configuração, por etapa. */
export const KNOWLEDGE_FIELDS: {
  section: "negocio" | "produto" | "oferta";
  field: string;
  label: string;
}[] = [
  { section: "negocio", field: "negocio", label: "Qual é o seu negócio?" },
  { section: "negocio", field: "vende", label: "O que vende?" },
  { section: "negocio", field: "publico", label: "Para quem vende?" },
  { section: "negocio", field: "problema", label: "Que problema resolve?" },
  { section: "negocio", field: "transformacao", label: "Que transformação proporciona?" },
  { section: "produto", field: "nome", label: "Nome do produto ou oferta" },
  { section: "produto", field: "incluido", label: "O que está incluído?" },
  { section: "produto", field: "funcionamento", label: "Como funciona?" },
  { section: "produto", field: "para_quem", label: "Para quem é?" },
  { section: "produto", field: "nao_e_para", label: "Para quem não é?" },
  { section: "produto", field: "requisitos", label: "Existem requisitos?" },
  { section: "produto", field: "entrega", label: "Como é entregue?" },
  { section: "produto", field: "acesso", label: "Durante quanto tempo há acesso?" },
  { section: "oferta", field: "preco", label: "Preço" },
  { section: "oferta", field: "pagamento", label: "Formas de pagamento" },
  { section: "oferta", field: "parcelamento", label: "Parcelamento" },
  { section: "oferta", field: "bonus", label: "Bónus" },
  { section: "oferta", field: "garantia", label: "Garantia" },
  { section: "oferta", field: "urgencia", label: "Prazo ou urgência" },
  { section: "oferta", field: "link", label: "Link de compra" },
  { section: "oferta", field: "cupoes", label: "Cupões" },
];

export const DEFAULT_OBJECTIONS = [
  "Está caro.",
  "Não tenho dinheiro agora.",
  "Será que funciona para mim?",
  "Não tenho experiência.",
  "Não tenho tempo.",
  "Preciso falar com a minha esposa.",
  "Tenho medo de comprar.",
  "Já tentei algo parecido.",
];

export const CLASSIFICATIONS = [
  "QUESTION",
  "OBJECTION",
  "PURCHASE_INTENT",
  "SUPPORT",
  "COMMENT",
  "PRAISE",
  "SMALL_TALK",
  "HUMAN_REQUEST",
  "UNKNOWN",
] as const;

export type AgentSource = {
  kind: "produto" | "oferta" | "negocio" | "faq" | "objecao" | "webinar" | "regra";
  label: string;
  transcriptVersionId?: string | null;
  semanticMomentId?: string | null;
  startMs?: number | null;
  endMs?: number | null;
  quote?: string | null;
};
