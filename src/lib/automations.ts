/**
 * Automações: QUANDO acontece um evento → SE a pessoa cumpre as condições → ESPERAR →
 * ENTÃO a acção.
 *
 * Quem decide quem entra, quando fica pronta e se ainda cumpre as condições é a base
 * de dados (0059–0062: automation_dispatch e automation_runs_tick, sobre participant_facts);
 * quem executa é o servidor (automations.server.ts). Aqui ficam as opções, os modelos, a
 * tradução para a interface e a conversão do formulário.
 */

/** Factos sim/não: os nomes são as colunas de participant_facts (Blocos 1 e 2). */
export type BooleanFact =
  | "entered"
  | "attended"
  | "no_show"
  | "replay"
  | "reached_pitch"
  | "reached_offer"
  | "left_early"
  | "saw_offer"
  | "clicked"
  | "checkout_started"
  | "purchased"
  | "payment_failed"
  | "checkout_abandoned";

/** Factos numéricos (segundos): tempo efectivamente visto e o ponto do conteúdo em que entrou. */
export type NumericFact = "actual_watch_seconds" | "entry_seconds";

export type Condition =
  | { fact: BooleanFact; value: boolean }
  | { fact: NumericFact; op: "gte" | "lt"; value: number };

export const BOOLEAN_FACTS: { fact: BooleanFact; question: string; yes: string; no: string }[] = [
  { fact: "entered", question: "Entrada na sala", yes: "Entrou", no: "Não entrou" },
  { fact: "attended", question: "Presença", yes: "Assistiu", no: "Não assistiu" },
  { fact: "no_show", question: "Falta (sessão terminada)", yes: "Não compareceu", no: "Não faltou" },
  { fact: "replay", question: "Replay", yes: "Veio pelo replay", no: "Não veio pelo replay" },
  { fact: "reached_pitch", question: "Pitch", yes: "Viu o pitch", no: "Não chegou ao pitch" },
  { fact: "reached_offer", question: "Momento da oferta", yes: "Chegou à oferta", no: "Não chegou à oferta" },
  { fact: "left_early", question: "Saída (sessão terminada)", yes: "Saiu cedo (antes da oferta)", no: "Não saiu cedo" },
  { fact: "saw_offer", question: "Oferta", yes: "Viu a oferta", no: "Não viu a oferta" },
  { fact: "clicked", question: "Clique na oferta", yes: "Clicou na oferta", no: "Não clicou" },
  { fact: "checkout_started", question: "Checkout", yes: "Iniciou o checkout", no: "Não iniciou o checkout" },
  { fact: "purchased", question: "Compra", yes: "Comprou", no: "Não comprou" },
  {
    fact: "payment_failed",
    question: "Pagamento falhado",
    yes: "Teve um pagamento falhado",
    no: "Sem pagamento falhado",
  },
  {
    fact: "checkout_abandoned",
    question: "Checkout abandonado",
    yes: "Abandonou o checkout",
    no: "Não abandonou o checkout",
  },
];

export const WAIT_OPTIONS = [
  { minutes: 0, label: "Imediatamente" },
  { minutes: 30, label: "30 minutos" },
  { minutes: 60, label: "1 hora" },
  { minutes: 120, label: "2 horas" },
  { minutes: 1440, label: "1 dia" },
  { minutes: 4320, label: "3 dias" },
] as const;

/** Os gatilhos com executor real: cada um tem o seu evento canónico gravado uma vez. */
export const TRIGGER_LABEL = {
  webinar_registered: "Inscreveu-se",
  webinar_session_started: "A sessão começou",
  webinar_session_ended: "A sessão terminou",
  webinar_attended: "Assistiu ao webinar",
  offer_viewed: "Viu a oferta",
  offer_clicked: "Clicou na oferta",
  checkout_started: "Iniciou o pagamento",
  purchase_approved: "Compra aprovada",
  payment_failed: "Pagamento falhou",
  checkout_abandoned: "Checkout abandonado",
  purchase_refunded: "Compra reembolsada",
} as const;
export type TriggerEvent = keyof typeof TRIGGER_LABEL;
export const TRIGGERS = Object.keys(TRIGGER_LABEL) as TriggerEvent[];

export const TRIGGER_GROUPS: { title: string; triggers: TriggerEvent[] }[] = [
  { title: "Antes do webinar", triggers: ["webinar_registered"] },
  {
    title: "No webinar",
    triggers: ["webinar_session_started", "webinar_attended", "offer_viewed", "offer_clicked", "webinar_session_ended"],
  },
  {
    title: "No pagamento",
    triggers: ["checkout_started", "purchase_approved", "payment_failed", "checkout_abandoned", "purchase_refunded"],
  },
];

/** Quando cada gatilho acontece e quem entra. */
export const TRIGGER_HELP: Record<TriggerEvent, string> = {
  webinar_registered:
    "Quando a pessoa se inscreve (formulário na sua página, API ou entrada na sala). Uma vez por pessoa e sessão, mesmo que se inscreva duas vezes.",
  webinar_session_started:
    "À hora de início de uma sessão com hora marcada. Entra cada pessoa inscrita nessa sessão.",
  webinar_session_ended:
    "À hora de fim prevista de uma sessão com hora marcada. Entra cada pessoa inscrita nessa sessão. Replay e sob demanda não têm um fim para todos.",
  webinar_attended:
    "No momento em que a pessoa passa o tempo mínimo para contar como \"assistiu\". Uma vez por pessoa e webinar.",
  offer_viewed: "Quando a oferta aparece à pessoa na sala. Uma vez por pessoa e webinar, mesmo que recarregue a página.",
  offer_clicked: "Quando a pessoa clica na oferta. Uma vez por pessoa e webinar.",
  checkout_started: "Quando a plataforma de venda regista o início do pagamento. Uma vez por pagamento.",
  purchase_approved: "Quando a plataforma de venda confirma o pagamento.",
  payment_failed: "Quando a plataforma de venda diz que o pagamento falhou.",
  checkout_abandoned:
    "Quando a plataforma diz que o pagamento foi abandonado, ou quando fica pendente mais horas do que o limite definido.",
  purchase_refunded:
    "Quando a plataforma de venda regista o reembolso. As automações de pós-compra deixam de avançar para essa pessoa.",
};

/** Os gatilhos que dependem de uma sessão com hora marcada (os outros são por pessoa). */
export const isSessionTrigger = (trigger: string) =>
  trigger === "webinar_session_ended" || trigger === "webinar_session_started";

/** O gatilho de uma execução, pela sua ocorrência ("purchase_approved:<id>"). */
export function triggerOfOccurrence(occurrenceKey: string): TriggerEvent | null {
  const name = occurrenceKey.split(":")[0] as TriggerEvent;
  return name in TRIGGER_LABEL ? name : null;
}

/* ---------- Modelos: automações reais, prontas a usar ---------- */

export type AutomationTemplate = {
  key: string;
  name: string;
  description: string;
  trigger_event: TriggerEvent;
  conditions: Condition[];
  wait_minutes: number;
};

export const TEMPLATES: AutomationTemplate[] = [
  {
    key: "recuperacao",
    name: "Recuperação pós-webinar",
    description: "Quem assistiu e não comprou recebe a mensagem de recuperação 2 horas depois do fim.",
    trigger_event: "webinar_session_ended",
    conditions: [
      { fact: "attended", value: true },
      { fact: "purchased", value: false },
    ],
    wait_minutes: 120,
  },
  {
    key: "abandono",
    name: "Checkout abandonado",
    description: "Quem não concluiu o pagamento recebe logo a ajuda para terminar.",
    trigger_event: "checkout_abandoned",
    conditions: [],
    wait_minutes: 0,
  },
  {
    key: "falha",
    name: "Pagamento falhou",
    description: "Quem teve o pagamento recusado recebe logo outra forma de pagar.",
    trigger_event: "payment_failed",
    conditions: [],
    wait_minutes: 0,
  },
  {
    key: "pos-compra",
    name: "Pós-compra",
    description: "Quem comprou recebe as boas-vindas e o acesso.",
    trigger_event: "purchase_approved",
    conditions: [],
    wait_minutes: 0,
  },
];

export const ACTION_LABEL = { outgoing_webhook: "Enviar para o webhook de saída" } as const;
/** Nome do evento que o webhook de saída recebe em cada execução. */
export const AUTOMATION_EVENT = "automation.run";

export function waitLabel(minutes: number) {
  const preset = WAIT_OPTIONS.find((o) => o.minutes === minutes);
  if (preset) return preset.label;
  if (minutes % 1440 === 0) return `${minutes / 1440} dias`;
  if (minutes % 60 === 0) return `${minutes / 60} horas`;
  return `${minutes} minutos`;
}

export function conditionLabel(condition: Condition) {
  if ("op" in condition) {
    const minutes = Math.round(condition.value / 60);
    if (condition.fact === "entry_seconds")
      return condition.op === "gte" ? `Entrou depois do minuto ${minutes}` : `Entrou antes do minuto ${minutes}`;
    return condition.op === "gte" ? `Viu pelo menos ${minutes} min` : `Viu menos de ${minutes} min`;
  }
  const info = BOOLEAN_FACTS.find((f) => f.fact === condition.fact)!;
  return condition.value ? info.yes : info.no;
}

/** "Assistiu e não comprou": a lista de condições numa frase. */
export function conditionsSentence(conditions: Condition[]) {
  return conditions.map((c, i) => (i === 0 ? conditionLabel(c) : conditionLabel(c).toLowerCase())).join(" e ");
}

/* ---------- Formulário ↔ condições ---------- */

export type Choice = "any" | "yes" | "no";
type NumericChoice = { op: "any" | "gte" | "lt"; minutes: number };
export type ConditionsForm = Record<BooleanFact, Choice> & { watch: NumericChoice; entry: NumericChoice };

export const EMPTY_CONDITIONS: ConditionsForm = {
  entered: "any",
  attended: "any",
  no_show: "any",
  replay: "any",
  reached_pitch: "any",
  reached_offer: "any",
  left_early: "any",
  saw_offer: "any",
  clicked: "any",
  checkout_started: "any",
  purchased: "any",
  payment_failed: "any",
  checkout_abandoned: "any",
  watch: { op: "any", minutes: 10 },
  entry: { op: "any", minutes: 10 },
};

export function conditionsFromForm(form: ConditionsForm): Condition[] {
  const conditions: Condition[] = BOOLEAN_FACTS.filter((f) => form[f.fact] !== "any").map((f) => ({
    fact: f.fact,
    value: form[f.fact] === "yes",
  }));
  for (const [fact, choice] of [["actual_watch_seconds", form.watch], ["entry_seconds", form.entry]] as const) {
    if (choice.op !== "any") conditions.push({ fact, op: choice.op, value: Math.max(0, Math.round(choice.minutes)) * 60 });
  }
  return conditions;
}

export function formFromConditions(conditions: Condition[]): ConditionsForm {
  const form: ConditionsForm = { ...EMPTY_CONDITIONS, watch: { ...EMPTY_CONDITIONS.watch }, entry: { ...EMPTY_CONDITIONS.entry } };
  for (const c of conditions) {
    if ("op" in c) form[c.fact === "entry_seconds" ? "entry" : "watch"] = { op: c.op, minutes: Math.round(c.value / 60) };
    else form[c.fact] = c.value ? "yes" : "no";
  }
  return form;
}

/* ---------- Execuções ---------- */

export type RunStatus = "waiting" | "ready" | "running" | "done" | "failed" | "cancelled";

export const RUN_STATUS: Record<
  RunStatus,
  { label: string; variant: "secondary" | "info" | "warning" | "success" | "destructive" | "outline" }
> = {
  waiting: { label: "A aguardar", variant: "secondary" },
  ready: { label: "Pronta a executar", variant: "info" },
  running: { label: "A executar", variant: "warning" },
  done: { label: "Executada", variant: "success" },
  failed: { label: "Falhou", variant: "destructive" },
  cancelled: { label: "Cancelada", variant: "outline" },
};

export const MAX_ATTEMPTS = 3;

export type RunFacts = {
  entered?: boolean;
  attended?: boolean;
  no_show?: boolean;
  replay?: boolean;
  reached_pitch?: boolean;
  reached_offer?: boolean;
  left_early?: boolean;
  actual_watch_seconds?: number;
  entry_seconds?: number | null;
  refunded?: boolean;
  saw_offer?: boolean;
  clicked?: boolean;
  checkout_started?: boolean;
  purchased?: boolean;
  payment_failed?: boolean;
  checkout_abandoned?: boolean;
  participations?: number;
};

/**
 * Se uma condição se verificava nos factos gravados quando a pessoa entrou. Só para mostrar
 * a prova: quem decide é a base de dados (automation_conditions_met), com a mesma regra.
 */
export function conditionHeld(condition: Condition, facts: RunFacts | null | undefined): boolean {
  if (!facts) return false;
  if ("op" in condition) {
    const seconds = facts[condition.fact];
    if (typeof seconds !== "number") return false;
    return condition.op === "gte" ? seconds >= condition.value : seconds < condition.value;
  }
  return facts[condition.fact] === condition.value;
}

/** Os factos de uma pessoa, em palavras: a prova de porque entrou (ou saiu). */
export function factsLabel(facts: RunFacts | null | undefined) {
  if (!facts) return "Sem factos desta pessoa na sessão.";
  const parts = BOOLEAN_FACTS.filter((f) => typeof facts[f.fact] === "boolean").map((f) =>
    facts[f.fact] ? f.yes : f.no,
  );
  if (typeof facts.actual_watch_seconds === "number") {
    parts.splice(1, 0, `${Math.round(facts.actual_watch_seconds / 60)} min vistos`);
  }
  if (typeof facts.entry_seconds === "number" && facts.entry_seconds >= 60) {
    parts.splice(1, 0, `entrou ao minuto ${Math.round(facts.entry_seconds / 60)}`);
  }
  if ((facts.participations ?? 1) > 1) parts.push(`${facts.participations} entradas na sessão`);
  return parts.join(" · ");
}

type RunLike = {
  status: string;
  attempts: number;
  error: string | null;
  result: unknown;
  scheduled_for: string;
};

/** O que aconteceu a uma execução, numa frase. */
export function runOutcome(run: RunLike, formatDate: (iso: string) => string) {
  const result = (run.result ?? {}) as {
    http_status?: number | null;
    cancelled?: string;
    facts?: RunFacts;
    sandbox?: boolean;
  };
  switch (run.status as RunStatus) {
    case "done":
      return result.sandbox
        ? "Entregue ao destino de teste (simulado: nada saiu da plataforma)."
        : `Entregue ao webhook de saída${result.http_status ? ` (HTTP ${result.http_status})` : ""}.`;
    case "failed":
      return `${run.error ?? "Falhou."}${run.attempts > 1 ? ` Tentativas: ${run.attempts}.` : ""}`;
    case "cancelled":
      return result.cancelled === "inactive"
        ? "Cancelada: a automação foi desligada antes da hora."
        : `Cancelada: deixou de cumprir as condições durante a espera (${factsLabel(result.facts)}).`;
    case "waiting":
      return run.attempts > 0
        ? `A tentativa ${run.attempts} falhou (${run.error ?? "sem resposta"}). Nova tentativa a partir de ${formatDate(run.scheduled_for)}.`
        : `Executa a partir de ${formatDate(run.scheduled_for)}, se continuar a cumprir as condições.`;
    case "ready":
      return "A hora chegou e as condições confirmaram-se: vai ser executada pelo servidor.";
    case "running":
      return `A executar (tentativa ${run.attempts} de ${MAX_ATTEMPTS}).`;
    default:
      return run.status;
  }
}
