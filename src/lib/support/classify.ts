/**
 * Classificação de um pedido: o que a pessoa quer, para que departamento vai,
 * com que urgência. Por regras que o dono lê e edita — a IA ajuda a perceber a
 * intenção, mas quem decide o encaminhamento são as regras da organização.
 */
import { isIntent, type Category, type Intent, type Priority, type RuleRow } from "./model";

export const normalise = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Pela ordem em que decidem: reembolso e reclamação primeiro, porque uma frase
 * com "quero comprar" e "reembolso" é sobre o reembolso.
 */
const PATTERNS: [Intent, RegExp][] = [
  [
    "refund",
    /\b(reembols\w*|estorno|devolucao do (meu )?dinheiro|devolver o (meu )?dinheiro|devolvam o (meu )?dinheiro|(quero|queria) o meu dinheiro|dinheiro de volta|cancelar a (minha )?(compra|inscricao))\b/,
  ],
  [
    "complaint",
    /\b(reclama\w+|burla\w*|fraude|golpe|enganad\w+|vergonha|pessim\w+|horrivel|denunci\w+|processar|advogado|inadmissivel|inaceitavel|falta de respeito)\b/,
  ],
  [
    "human_request",
    /\b(falar com (uma |um |alguma |algum )?(pessoa|humano|atendente|responsavel|gerente|operador|alguem|comercial)|atendimento humano|pessoa (real|de verdade)|quero um humano|nao quero (falar com )?(um |o )?(robo|bot)|podem ligar|liguem-me|me liga\w*|quero que me liguem)\b/,
  ],
  [
    "post_purchase",
    /\b(ja (paguei|comprei|fiz o pagamento|efetuei o pagamento|efectuei o pagamento)|fiz o pagamento|paguei (mas|e) (ainda )?nao|comprei (mas|e) (ainda )?nao|nao recebi (o |a |os |as )?(acesso|produto|curso|material|comprovativo|email|credenciais))\b/,
  ],
  [
    "negotiation",
    /\b(desconto\w*|mais barato|baixar o preco|negoci\w+|preco especial|condicoes especiais|fazer (um |me um )?preco|cupao|cupom|cupoes)\b/,
  ],
  [
    "purchase",
    /\b((quero|queria|gostaria de|vou|posso|como) (comprar|adquirir|inscrever|me inscrever|garantir)|como (faco para|posso) (comprar|adquirir)|(ainda )?(tem|ha|existem) vagas|garantir a minha vaga|quero a minha vaga)\b/,
  ],
  [
    "checkout",
    /\b(checkout|link de pagamento|nao consigo pagar|erro (no|ao|de) pag\w+|pagamento (nao passou|nao passa|deu erro|falhou|recusado|foi recusado)|cartao (recusado|nao passa|foi recusado))\b/,
  ],
  [
    "payment",
    /\b(parcel\w+|prestac\w+|pagar em (\d+|duas|tres|quatro|varias) vezes|em (\d+|duas|tres|quatro) vezes|formas? de pagamento|como (posso |se )?pag\w+|multicaixa|referencia|transferencia|mb ?way|paypal|cartao|iban|pix|boleto)\b/,
  ],
  [
    "access",
    /\b(nao consigo (entrar|aceder|acessar|abrir|ver)|link de acesso|nao recebi o link|nao tenho acesso|perdi o acesso|senha|palavra-passe|password|login)\b/,
  ],
  [
    "technical",
    /\b(nao carrega|travou|trava|travando|sem som|sem audio|sem imagem|video parou|ecra preto|tela preta|erro|bug|nao funciona|nao abre|a falhar)\b/,
  ],
  [
    "offer_question",
    /\b(preco|quanto custa|qual (e )?o valor|valor d[oa]|bonus|garantia|o que (inclui|esta incluido)|incluido|certificado)\b/,
  ],
  [
    "information",
    /\b(horario|que horas|a que horas|quando (comeca|e|sera)|replay|gravacao|vai ficar gravado|duracao|quanto tempo dura)\b/,
  ],
];

/** Todas as intenções que a mensagem mostra, da que mais pesa para a que menos pesa. */
export function keywordIntents(text: string): Intent[] {
  const clean = normalise(text);
  return PATTERNS.filter(([, pattern]) => pattern.test(clean)).map(([intent]) => intent);
}

/** Estas palavras decidem sempre, diga a IA o que disser. */
const GUARDED: Intent[] = ["refund", "complaint", "human_request", "negotiation"];

const FROM_CLASSIFICATION: Record<string, Intent> = {
  PURCHASE_INTENT: "purchase",
  OBJECTION: "offer_question",
  SUPPORT: "technical",
  HUMAN_REQUEST: "human_request",
  QUESTION: "information",
};

const DEFAULT_CATEGORY: Record<Intent, Category> = {
  purchase: "offer",
  negotiation: "offer",
  offer_question: "offer",
  payment: "payment",
  checkout: "payment",
  refund: "payment",
  access: "access",
  technical: "technical",
  post_purchase: "post_purchase",
  complaint: "general",
  human_request: "general",
  information: "general",
  other: "general",
};

export function resolveIntent(input: {
  text: string;
  modelIntent?: string | null | undefined;
  classification?: string | null | undefined;
}): { intent: Intent; category: Category; matched: Intent[] } {
  const matched = keywordIntents(input.text);
  const guarded = matched.find((intent) => GUARDED.includes(intent));
  const fromModel = isIntent(input.modelIntent) && input.modelIntent !== "other" ? input.modelIntent : null;
  const intent: Intent =
    guarded ??
    fromModel ??
    matched[0] ??
    FROM_CLASSIFICATION[String(input.classification ?? "").toUpperCase()] ??
    "other";

  // "Quero comprar, posso pagar em duas vezes?" é uma compra sobre pagamento.
  let category = DEFAULT_CATEGORY[intent];
  const rest = matched.filter((m) => m !== intent);
  if (intent === "purchase" && rest.some((m) => m === "payment" || m === "checkout")) category = "payment";
  if (intent === "post_purchase" && /\bacesso\b/.test(normalise(input.text))) category = "access";
  return { intent, category, matched };
}

/** Sem IA para decidir: uma pergunta ou um pedido reconhecido merece resposta de alguém. */
export function looksLikeRequest(text: string) {
  return text.includes("?") || keywordIntents(text).length > 0;
}

const FALLBACK_RULE = {
  department_id: null,
  required_skills: [] as string[],
  priority: "normal" as Priority,
  sla_minutes: 30,
  always_human: false,
  call_required: false,
};

export type Rule = Pick<
  RuleRow,
  "intent" | "department_id" | "required_skills" | "priority" | "sla_minutes" | "always_human" | "call_required"
>;

export function ruleFor(rules: Rule[], intent: Intent) {
  return (
    rules.find((r) => r.intent === intent) ?? rules.find((r) => r.intent === "other") ?? FALLBACK_RULE
  );
}

const ORDER: Priority[] = ["low", "normal", "high", "critical"];
const raise = (priority: Priority, to: Priority) =>
  ORDER.indexOf(to) > ORDER.indexOf(priority) ? to : priority;

/** Quem já é cliente e quer comprar, pagar ou entrar não espera na fila normal. */
const CUSTOMER_FIRST: Intent[] = ["purchase", "payment", "checkout", "negotiation", "post_purchase", "access"];

export function adjustPriority(
  base: string,
  input: { intent: Intent; isCustomer: boolean; sentiment?: string | null | undefined },
): Priority {
  let priority = (ORDER.includes(base as Priority) ? base : "normal") as Priority;
  if (input.isCustomer && CUSTOMER_FIRST.includes(input.intent)) priority = raise(priority, "high");
  if (input.isCustomer && input.sentiment === "negative") {
    priority = ORDER[Math.min(ORDER.length - 1, ORDER.indexOf(priority) + 1)] ?? priority;
  }
  return priority;
}

const RECOMMENDED: Record<Intent, string> = {
  purchase: "Contactar o cliente e fechar a venda.",
  payment: "Confirmar as condições de pagamento e enviar o link.",
  checkout: "Ajudar a concluir o pagamento.",
  negotiation: "Contactar o cliente e decidir as condições.",
  offer_question: "Responder à dúvida sobre a oferta.",
  access: "Confirmar a inscrição e enviar o link de acesso.",
  technical: "Perceber o problema e orientar o cliente.",
  post_purchase: "Confirmar o pagamento e libertar o acesso.",
  refund: "Verificar a compra e tratar o reembolso.",
  complaint: "Ligar ao cliente e ouvir a reclamação.",
  human_request: "Responder ao cliente.",
  information: "Responder ao pedido de informação.",
  other: "Ler a conversa e responder.",
};

const REASON: Partial<Record<Intent, string>> = {
  refund: "Reembolso",
  complaint: "Reclamação",
  human_request: "O cliente pediu uma pessoa da equipa",
  negotiation: "Negociação comercial",
};

export type CaseClassification = {
  intent: Intent;
  category: Category;
  priority: Priority;
  departmentId: string | null;
  requiredSkills: string[];
  slaMinutes: number;
  callRequired: boolean;
  alwaysHuman: boolean;
  purchaseIntent: boolean;
  recommendedAction: string;
  /** Motivo a usar quando quem escalou não deu outro. */
  defaultReason: string;
};

export function classifyCase(input: {
  text: string;
  rules: Rule[];
  modelIntent?: string | null | undefined;
  classification?: string | null | undefined;
  sentiment?: string | null | undefined;
  isCustomer: boolean;
  fallbackDepartmentId: string | null;
}): CaseClassification {
  const { intent, category, matched } = resolveIntent(input);
  const rule = ruleFor(input.rules, intent);
  return {
    intent,
    category,
    priority: adjustPriority(rule.priority, {
      intent,
      isCustomer: input.isCustomer,
      sentiment: input.sentiment,
    }),
    departmentId: rule.department_id ?? input.fallbackDepartmentId,
    requiredSkills: rule.required_skills,
    slaMinutes: rule.sla_minutes,
    callRequired: rule.call_required,
    alwaysHuman: rule.always_human,
    purchaseIntent:
      String(input.classification ?? "").toUpperCase() === "PURCHASE_INTENT" ||
      [intent, ...matched].some((i) => i === "purchase" || i === "checkout"),
    recommendedAction: RECOMMENDED[intent],
    defaultReason: REASON[intent] ?? "Precisa de uma pessoa da equipa",
  };
}
