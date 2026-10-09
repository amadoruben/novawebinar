/**
 * Regras do rascunho do webinar, sem ecrã: o minuto do pitch, o que impede gravar, o estado
 * que se grava e a data única no fuso do webinar. O editor usa isto para não divergir da sala
 * nem dos segmentos.
 */
import { safeZone, zonedTimeToMs, zoneParts } from "@/lib/schedule";
import { offerUrl } from "@/lib/utils";

/** Os campos do formulário do editor de que estas regras precisam (os valores são texto). */
export type DraftFields = {
  cta_url: string;
  cta_text: string;
  cta_start_seconds: string;
  cta_end_seconds: string;
  schedule_mode: string;
  recurrence_enabled: boolean;
  recurrence_start_time: string;
  scheduled_at: string;
};

/**
 * As etapas do editor, pela ordem do menu: antes da sala, na sala, depois da sala e lançar (com a Revisão no fim).
 * Cada etapa faz uma só coisa; o vídeo dá o tempo às da sala.
 */
export const EDITOR_STEPS = [
  { id: "inicio", label: "Início", group: "antes" },
  { id: "entrada", label: "Página", group: "antes" },
  { id: "video", label: "Vídeo", group: "sala" },
  // A audiência vem antes do chat: o volume de comentários segue o número de pessoas.
  { id: "audiencia", label: "Audiência", group: "sala" },
  { id: "chat", label: "Chat", group: "sala" },
  { id: "oferta", label: "Oferta", group: "sala" },
  { id: "vendas", label: "Vendas", group: "sala" },
  { id: "automacoes", label: "Automações", group: "depois" },
  { id: "agente", label: "Agente IA", group: "depois" },
  { id: "agenda", label: "Agenda", group: "lancar" },
  // No fim: rever etapa a etapa e publicar.
  { id: "revisao", label: "Revisão", group: "lancar" },
] as const;

export type EditorStep = (typeof EDITOR_STEPS)[number]["id"];

/** Depois do vídeo, a oferta (e a sala) pode ficar aberta até um dia. */
export const MAX_OPEN_AFTER_SECONDS = 24 * 3600;

/** Etapas antigas que deixaram de existir e a etapa onde ficou o que tinham. */
const MOVED_STEPS: Record<string, EditorStep> = {
  login: "entrada",
  design: "entrada",
  webinar: "agenda",
  integracoes: "inicio",
  timeline: "video",
};

/** A etapa do endereço (`?step=`): as antigas abrem onde o conteúdo ficou; o resto abre o Início. */
export function stepFromSearch(value: string | undefined): EditorStep {
  if (!value) return "inicio";
  const known = EDITOR_STEPS.find((s) => s.id === value);
  return known ? known.id : (MOVED_STEPS[value] ?? "inicio");
}

/**
 * O editor só desenha a etapa quando já leu o que ela mostra. O webinar sozinho não chega: o vídeo escolhido e
 * a duração vêm dos vídeos da conta (lidos depois da conta) e os comentários vêm à parte. Sem esta espera, o
 * Chat abria a pedir «Primeiro, o vídeo» e sem comentários num webinar que tem os dois.
 */
export function editorLoading(pending: {
  webinar: boolean;
  /** O formulário já recebeu o webinar lido (ou não há webinar). */
  hydrated: boolean;
  workspace: boolean;
  /** Há conta: só com ela se pedem os vídeos. */
  organization: boolean;
  videos: boolean;
  comments: boolean;
}): boolean {
  if (pending.webinar || pending.workspace || pending.comments) return true;
  // Sem conta (a leitura falhou), os vídeos nunca se pedem: não se espera por eles para sempre.
  if (pending.organization && pending.videos) return true;
  return !pending.hydrated;
}

/**
 * Um chat gerado, pronto e ainda por mostrar: o editor leva ao Chat e abre a revisão uma única vez. Depois
 * fica marcado como visto; rever continua à mão no Chat e na Revisão.
 */
export function reviewToAnnounce(
  job: { status: string; drafts: readonly unknown[] | null; seen?: boolean | undefined } | undefined,
): boolean {
  return job?.status === "ready" && Boolean(job.drafts?.length) && !job.seen;
}

export type DraftIssue = {
  step: "agenda" | "oferta";
  field: string;
  message: string;
  /** Erros que impedem gravar; os outros são avisos. */
  blocking: boolean;
};

const seconds = (value: string) => (value.trim() === "" ? null : Number(value) || 0);

/**
 * O minuto do pitch é o minuto em que a oferta aparece (mapa de automação). Com oferta e sem
 * minuto, a oferta abre no início: grava-se 0 para que os segmentos digam o mesmo que a sala.
 */
export function offerTiming(draft: DraftFields): { start: number | null; end: number | null } {
  const hasOffer = Boolean(draft.cta_url.trim() || draft.cta_text.trim());
  const start = seconds(draft.cta_start_seconds);
  return { start: start ?? (hasOffer ? 0 : null), end: seconds(draft.cta_end_seconds) };
}

export function webinarIssues(
  draft: DraftFields,
  context: { durationSeconds: number },
): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const offer = (field: string, message: string) =>
    issues.push({ step: "oferta", field, message, blocking: true });

  if (draft.cta_url.trim() && !offerUrl(draft.cta_url)) {
    offer("cta_url", "O link da oferta tem de ser um endereço válido, começado por https://.");
  }
  const { start, end } = offerTiming(draft);
  const duration = context.durationSeconds;
  if (duration > 0 && start !== null && start > duration) {
    offer("cta_start_seconds", "O minuto do pitch fica depois do fim do vídeo.");
  }
  if (end !== null && end <= (start ?? 0)) {
    offer("cta_end_seconds", "A oferta tem de desaparecer depois de aparecer.");
  } else if (duration > 0 && end !== null && end > duration + MAX_OPEN_AFTER_SECONDS) {
    offer("cta_end_seconds", "A sala só fica aberta até 24 horas depois do fim do vídeo.");
  }

  if (draft.recurrence_enabled && !draft.recurrence_start_time) {
    issues.push({
      step: "agenda",
      field: "recurrence_start_time",
      message: "Defina a hora de início da repetição automática.",
      blocking: false,
    });
  } else if (draft.schedule_mode === "single" && !draft.recurrence_enabled && !draft.scheduled_at) {
    issues.push({
      step: "agenda",
      field: "scheduled_at",
      message: "Escolha a data e a hora da sessão.",
      blocking: false,
    });
  }
  return issues;
}

/**
 * O estado que o editor grava. Desligado («draft») só se liga no interruptor da lista; a
 * excepção é o webinar novo, ainda sem sessão gravada, que se liga ao receber a primeira data.
 */
export function statusOnSave<S extends string>(
  saved: {
    status: string;
    scheduled_at: string | null;
    recurrence_enabled: boolean | null;
    schedule_mode: string | null;
  },
  derived: S,
): S | "draft" {
  const hadSession = Boolean(
    saved.scheduled_at || saved.recurrence_enabled || saved.schedule_mode === "jit",
  );
  return saved.status === "draft" && hadSession ? "draft" : derived;
}

/** «2026-10-20T20:00» no fuso do webinar → instante ISO. */
export function isoFromLocalInput(value: string, timezone: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number) as [number, number, number, number, number, number];
  return new Date(zonedTimeToMs(y, mo, d, h, mi, safeZone(timezone))).toISOString();
}

/** Instante gravado → «2026-10-20T20:00» no fuso do webinar, para o campo de data. */
export function localInputFromIso(iso: string | null, timezone: string): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  const p = zoneParts(ms, safeZone(timezone));
  const two = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${two(p.month)}-${two(p.day)}T${two(p.hour)}:${two(p.minute)}`;
}
