/**
 * Factos das participações (`participant_facts`) do lado da aplicação: a regra com
 * que a sala mede o tempo visto e as contas que as páginas fazem sobre os factos.
 * As definições (assistiu, viu a oferta, clicou, iniciou o pagamento, comprou) vêm
 * da base de dados; aqui só se agrega.
 *
 * Tempo, três medidas que não se misturam:
 * - posição (entrada e pico): "chegou ao pitch", "chegou ao minuto N", curva;
 * - intervalo (pico − entrada): inclui o tempo em que a pessoa não estava;
 * - tempo visto: "assistiu", tempo médio, percentagem vista.
 *
 * Oferta e compra: cada pessoa conta uma vez por webinar e cada passo do funil só
 * conta quem assistiu. Clicar não é iniciar o pagamento; iniciar não é comprar.
 */
import type { Database } from "@/integrations/supabase/types";
import { clockLabel } from "@/lib/engagement-analysis";

export type ParticipantFact = Database["public"]["Views"]["participant_facts"]["Row"];

/** Acima disto por segundo é um salto (reposicionamento, regresso à sala), não é ver. */
const NATURAL_STEP_SECONDS = 3;

/** Segundos vistos entre duas leituras do relógio de conteúdo feitas com um segundo de intervalo. */
export function watchedStep(previous: number | null, current: number, present: boolean) {
  if (previous === null || !present) return 0;
  const step = current - previous;
  return step > 0 && step <= NATURAL_STEP_SECONDS ? step : 0;
}

/** As colunas dos factos de que as contas de audiência e do funil precisam. */
export const FACT_COLUMNS =
  "person_id, webinar_id, viewing_mode, attended, actual_watch_seconds, entry_seconds, peak_seconds, reached_pitch, duration_seconds, saw_offer, clicked, checkout_started, purchased, payment_failed, checkout_abandoned, refunded";

export type FunnelFact = Pick<
  ParticipantFact,
  | "person_id"
  | "webinar_id"
  | "viewing_mode"
  | "attended"
  | "actual_watch_seconds"
  | "entry_seconds"
  | "peak_seconds"
  | "reached_pitch"
  | "duration_seconds"
  | "saw_offer"
  | "clicked"
  | "checkout_started"
  | "purchased"
  | "payment_failed"
  | "checkout_abandoned"
  | "refunded"
>;

/** Uma pessoa num webinar. Quem entrou em dois aparelhos conta uma vez. */
export type Presence = {
  attended: boolean;
  attendedLive: boolean;
  attendedReplay: boolean;
  reachedPitch: boolean;
  watchSeconds: number;
  entrySeconds: number;
  peakSeconds: number;
  sawOffer: boolean;
  clicked: boolean;
  checkout: boolean;
  purchased: boolean;
  paymentFailed: boolean;
  abandoned: boolean;
  /** Comprou e foi reembolsado (sem outra compra aprovada): não conta como compra. */
  refunded: boolean;
};

export function presences(facts: FunnelFact[]): Presence[] {
  const byPerson = new Map<string, Presence>();
  for (const f of facts) {
    const key = `${f.person_id}:${f.webinar_id}`;
    const seen = byPerson.get(key);
    const attended = Boolean(f.attended);
    const replay = f.viewing_mode === "replay";
    byPerson.set(key, {
      attended: attended || Boolean(seen?.attended),
      attendedLive: (attended && !replay) || Boolean(seen?.attendedLive),
      attendedReplay: (attended && replay) || Boolean(seen?.attendedReplay),
      reachedPitch: Boolean(f.reached_pitch) || Boolean(seen?.reachedPitch),
      watchSeconds: Math.max(f.actual_watch_seconds ?? 0, seen?.watchSeconds ?? 0),
      entrySeconds: Math.min(f.entry_seconds ?? 0, seen?.entrySeconds ?? Number.POSITIVE_INFINITY),
      peakSeconds: Math.max(f.peak_seconds ?? 0, seen?.peakSeconds ?? 0),
      sawOffer: Boolean(f.saw_offer) || Boolean(seen?.sawOffer),
      clicked: Boolean(f.clicked) || Boolean(seen?.clicked),
      checkout: Boolean(f.checkout_started) || Boolean(seen?.checkout),
      purchased: Boolean(f.purchased) || Boolean(seen?.purchased),
      paymentFailed: Boolean(f.payment_failed) || Boolean(seen?.paymentFailed),
      abandoned: Boolean(f.checkout_abandoned) || Boolean(seen?.abandoned),
      refunded: Boolean(f.refunded) || Boolean(seen?.refunded),
    });
  }
  return [...byPerson.values()];
}

export const MILESTONE_MINUTES = [15, 30, 45, 60] as const;

/** Inscritos e assistiram contam pessoas; o resto conta só quem assistiu. */
export function funnelSummary(facts: FunnelFact[]) {
  const people = presences(facts);
  const attended = people.filter((p) => p.attended);
  const count = (step: (p: Presence) => boolean) => attended.filter(step).length;
  const total = attended.reduce((sum, p) => sum + p.watchSeconds, 0);
  const buyers = count((p) => p.purchased);
  return {
    registered: people.length,
    attended: attended.length,
    attendedLive: count((p) => p.attendedLive),
    attendedReplay: count((p) => p.attendedReplay),
    reachedPitch: count((p) => p.reachedPitch),
    averageWatchSeconds: attended.length ? Math.round(total / attended.length) : 0,
    /** Chegou ao minuto N: posição, não tempo visto. */
    milestones: MILESTONE_MINUTES.map((minutes) => ({
      minutes,
      value: count((p) => p.peakSeconds >= minutes * 60),
    })),
    sawOffer: count((p) => p.sawOffer),
    clicked: count((p) => p.clicked),
    checkout: count((p) => p.checkout),
    buyers,
    paymentFailed: count((p) => p.paymentFailed),
    abandoned: count((p) => p.abandoned),
    refunded: count((p) => p.refunded && !p.purchased),
    /** Pessoas que assistiram e compraram ÷ pessoas que assistiram, em percentagem. */
    conversion: attended.length ? (buyers / attended.length) * 100 : 0,
    attendedPeople: attended,
  };
}

/** Duração do conteúdo nos factos (a do vídeo, senão a do webinar); 0 quando desconhecida. */
export function factsDuration(facts: Pick<ParticipantFact, "duration_seconds">[]) {
  return facts.reduce((max, f) => Math.max(max, f.duration_seconds ?? 0), 0);
}

const strideFor = (total: number, steps: number) =>
  Math.max(30, Math.round(total / steps / 30) * 30 || 30);

type Span = Pick<Presence, "entrySeconds" | "peakSeconds">;

/** Quantas pessoas tinham cada momento do conteúdo entre a entrada e o pico. */
export function buildRetention(people: Span[], durationSeconds: number, steps = 40) {
  const total = Math.max(durationSeconds, 60);
  const stride = strideFor(total, steps);
  const points: { second: number; label: string; viewers: number }[] = [];
  for (let second = 0; second <= total; second += stride) {
    points.push({
      second,
      label: clockLabel(second),
      viewers: people.filter((p) => p.entrySeconds <= second && p.peakSeconds >= second).length,
    });
  }
  return points;
}

export type DropOffPoint = {
  second: number;
  endSecond: number;
  label: string;
  range: string;
  exits: number;
  watching: number;
  /** Percentagem de quem ainda estava na sala e saiu neste intervalo. */
  rate: number;
};

/** Quantas pessoas saíram em cada intervalo do conteúdo (o pico ficou nesse intervalo). */
export function buildDropOff(people: Span[], durationSeconds: number, steps = 40) {
  const total = Math.max(durationSeconds, 60);
  const stride = strideFor(total, steps);
  const points: DropOffPoint[] = [];
  for (let second = 0; second < total; second += stride) {
    const end = Math.min(second + stride, total);
    const watching = people.filter((p) => p.entrySeconds < end && p.peakSeconds >= second).length;
    const exits = people.filter((p) => p.peakSeconds >= second && p.peakSeconds < end).length;
    points.push({
      second,
      endSecond: end,
      label: clockLabel(second),
      range: `${clockLabel(second)} – ${clockLabel(end)}`,
      exits,
      watching,
      rate: watching ? (exits / watching) * 100 : 0,
    });
  }
  return points;
}
