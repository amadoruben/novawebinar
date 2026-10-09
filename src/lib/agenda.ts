/**
 * Agenda: os dias de cada webinar e as sugestões de dia e hora.
 *
 * As sugestões saem só de sessões reais já assentes: inscritos, presença ao vivo e
 * compras de cada sessão, agrupados por dia da semana e hora certa (no fuso do webinar).
 * Só se comparam horários do mesmo webinar: entre webinars ganhava a oferta, não a hora.
 * Com poucos dados diz-se quanto falta; nunca se inventa um número.
 */
import { parseTime, safeZone, zonedTimeToMs, zoneParts, type ScheduleInput } from "@/lib/schedule";

/** Inscritos que um horário precisa para entrar na comparação. */
export const MIN_PEOPLE_PER_SLOT = 30;
/** Horários diferentes precisos para haver o que comparar. */
export const MIN_SLOTS = 2;
/** Uma sessão só conta um dia depois de começar: as compras chegam depois do fim. */
const SETTLE_MS = 24 * 3_600_000;

export type AgendaSession = { id: string; webinar_id: string; starts_at: string };

export type AgendaFact = {
  person_id: string | null;
  webinar_session_id: string | null;
  attended: boolean | null;
  viewing_mode: string | null;
  purchased: boolean | null;
};

/** Um webinar num dia da semana a uma hora, com o que as sessões a essa hora deram. */
export type Slot = {
  key: string;
  webinarId: string;
  /** 0 = domingo … 6 = sábado. */
  weekday: number;
  hour: number;
  minute: number;
  sessions: number;
  people: number;
  /** Quem assistiu ao vivo (o replay não depende da hora). */
  attended: number;
  buyers: number;
  /** Assistiram ao vivo ÷ inscritos. */
  attendance: number;
  /** Compraram ÷ inscritos. */
  sales: number;
};

/** O que um webinar já permite sugerir, ou quanto lhe falta. */
export type Suggestions =
  | { webinarId: string; ready: true; best: Slot[]; bySales: boolean }
  | { webinarId: string; ready: false; slots: Slot[]; missingSlots: number };

const WEEKDAYS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];
const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const clock = (t: { hour: number; minute: number }) =>
  `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;

/** «Quinta-feira às 14:00», com a hora certa da sessão (20:30 não passa a 20h). */
export function slotLabel(slot: Pick<Slot, "weekday" | "hour" | "minute">) {
  const day = WEEKDAYS[slot.weekday]!;
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} às ${clock(slot)}`;
}

/** Os horários de um webinar, do melhor para o pior, ou quanto falta para os comparar. */
function rank(webinarId: string, all: Slot[]): Suggestions {
  // ponytail: média simples por horário; com muitas sessões, um intervalo de confiança
  // (Wilson) evita premiar um horário com sorte.
  const eligible = all.filter((s) => s.people >= MIN_PEOPLE_PER_SLOT);
  if (eligible.length < MIN_SLOTS) {
    return {
      webinarId,
      ready: false,
      slots: all.sort((a, b) => b.people - a.people),
      missingSlots: MIN_SLOTS - eligible.length,
    };
  }
  const bySales = eligible.some((s) => s.buyers > 0);
  const best = eligible.sort(
    (a, b) =>
      (bySales ? b.sales - a.sales : 0) || b.attendance - a.attendance || b.people - a.people,
  );
  return { webinarId, ready: true, best, bySales };
}

/**
 * Melhores dias e horas, um resultado por webinar (os horários só se comparam dentro do
 * mesmo webinar). Ordena pelas compras por inscrito; sem nenhuma compra ainda, pela
 * presença ao vivo. Um horário só entra com MIN_PEOPLE_PER_SLOT inscritos, e um webinar
 * só sugere com MIN_SLOTS horários assim; antes disso diz o que há e quanto falta.
 * Primeiro vêm os webinars que já sugerem, depois os que estão mais perto.
 */
export function suggestSlots(
  sessions: AgendaSession[],
  facts: AgendaFact[],
  timezoneOf: (webinarId: string) => string | null | undefined,
  nowMs = Date.now(),
): Suggestions[] {
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  // Cada pessoa conta uma vez por sessão (dois aparelhos = uma pessoa).
  const people = new Map<string, Map<string, { attended: boolean; bought: boolean }>>();
  const buyers = new Set<string>();
  for (const f of facts) {
    const s = f.webinar_session_id ? sessionById.get(f.webinar_session_id) : undefined;
    if (!s || !f.person_id) continue;
    const bySession = people.get(s.id) ?? new Map();
    bySession.set(f.person_id, {
      attended:
        Boolean(bySession.get(f.person_id)?.attended) ||
        (Boolean(f.attended) && f.viewing_mode !== "replay"),
      bought: false,
    });
    people.set(s.id, bySession);
    if (f.purchased) buyers.add(`${s.webinar_id}:${f.person_id}`);
  }

  // A compra vem por pessoa e webinar, não por sessão: conta só numa, a última a que a
  // pessoa assistiu ao vivo ou, sem nenhuma, a última em que se inscreveu.
  const chosen = new Map<
    string,
    { sessionId: string; personId: string; attended: boolean; startMs: number }
  >();
  for (const [sessionId, group] of people) {
    const s = sessionById.get(sessionId)!;
    const startMs = Date.parse(s.starts_at);
    for (const [personId, p] of group) {
      const key = `${s.webinar_id}:${personId}`;
      if (!buyers.has(key)) continue;
      const cur = chosen.get(key);
      if (
        !cur ||
        (p.attended && !cur.attended) ||
        (p.attended === cur.attended && startMs > cur.startMs)
      ) {
        chosen.set(key, { sessionId, personId, attended: p.attended, startMs });
      }
    }
  }
  for (const c of chosen.values()) people.get(c.sessionId)!.get(c.personId)!.bought = true;

  const slots = new Map<string, Slot>();
  for (const s of sessions) {
    const startMs = Date.parse(s.starts_at);
    const group = people.get(s.id);
    if (Number.isNaN(startMs) || startMs > nowMs - SETTLE_MS || !group?.size) continue;
    const { weekday, hour, minute } = zoneParts(startMs, safeZone(timezoneOf(s.webinar_id)));
    const key = `${s.webinar_id}:${weekday}:${clock({ hour, minute })}`;
    const slot = slots.get(key) ?? {
      key,
      webinarId: s.webinar_id,
      weekday,
      hour,
      minute,
      sessions: 0,
      people: 0,
      attended: 0,
      buyers: 0,
      attendance: 0,
      sales: 0,
    };
    slot.sessions += 1;
    for (const p of group.values()) {
      slot.people += 1;
      if (p.attended) slot.attended += 1;
      if (p.bought) slot.buyers += 1;
    }
    slots.set(key, slot);
  }

  const byWebinar = new Map<string, Slot[]>();
  for (const s of slots.values()) {
    const slot = { ...s, attendance: s.attended / s.people, sales: s.buyers / s.people };
    byWebinar.set(s.webinarId, [...(byWebinar.get(s.webinarId) ?? []), slot]);
  }
  const missing = (r: Suggestions) => (r.ready ? 0 : r.missingSlots);
  const total = (r: Suggestions) =>
    (r.ready ? r.best : r.slots).reduce((sum, s) => sum + s.people, 0);
  return [...byWebinar]
    .map(([webinarId, all]) => rank(webinarId, all))
    .sort((a, b) => missing(a) - missing(b) || total(b) - total(a));
}

/* ---------- Os dias de cada webinar ---------- */

export type AgendaWebinar = ScheduleInput & {
  id: string;
  title: string;
  status?: string | null;
};

export type DayEntry = { webinarId: string; title: string; startMs: number; timezone: string };

/** Horas de uma repetição, como a sala as lê (sessionWindow). */
function recurrenceTimes(w: ScheduleInput) {
  return (w.recurrence_times?.length ? w.recurrence_times : [w.recurrence_start_time])
    .map((value) => parseTime(value))
    .filter((value): value is { hour: number; minute: number } => value !== null)
    .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
}

function recurrenceDays(w: ScheduleInput): number[] {
  if (w.recurrence_days?.length) return [...w.recurrence_days].sort((a, b) => a - b);
  if (w.recurrence_pattern === "weekly")
    return [Math.min(6, Math.max(0, w.recurrence_weekday ?? 1))];
  return [0, 1, 2, 3, 4, 5, 6];
}

/**
 * As sessões de cada webinar num mês (1–12), por dia, no fuso de cada webinar: as que já
 * existiram (sessões reais), a data única e, da repetição, só as que ainda vêm (as que
 * passaram sem ninguém inscrito nunca chegaram a existir). Just in time e sem horário
 * não têm dia: ficam na lista dos webinars.
 */
export function monthEntries(
  webinars: AgendaWebinar[],
  sessions: AgendaSession[],
  year: number,
  month: number,
  nowMs = Date.now(),
) {
  const byDay = new Map<number, DayEntry[]>();
  const seen = new Set<string>();
  const add = (w: AgendaWebinar, startMs: number) => {
    const timezone = safeZone(w.timezone);
    const p = zoneParts(startMs, timezone);
    const key = `${w.id}:${startMs}`;
    if (p.year !== year || p.month !== month || seen.has(key)) return;
    seen.add(key);
    byDay.set(p.day, [
      ...(byDay.get(p.day) ?? []),
      { webinarId: w.id, title: w.title, startMs, timezone },
    ]);
  };

  const byId = new Map(webinars.map((w) => [w.id, w]));
  for (const s of sessions) {
    const w = byId.get(s.webinar_id);
    const ms = Date.parse(s.starts_at);
    if (w && !Number.isNaN(ms)) add(w, ms);
  }

  const today = new Date(nowMs);
  today.setHours(0, 0, 0, 0);
  for (const w of webinars) {
    if (w.status === "draft" || w.schedule_mode === "jit") continue;
    const times = recurrenceTimes(w);
    if (w.recurrence_enabled && times.length) {
      const days = new Set(recurrenceDays(w));
      const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
      for (let day = 1; day <= last; day += 1) {
        if (!days.has(new Date(Date.UTC(year, month - 1, day)).getUTCDay())) continue;
        for (const t of times) {
          const ms = zonedTimeToMs(year, month, day, t.hour, t.minute, safeZone(w.timezone));
          if (ms >= today.getTime()) add(w, ms);
        }
      }
    } else if (w.scheduled_at) {
      const ms = Date.parse(w.scheduled_at);
      if (!Number.isNaN(ms)) add(w, ms);
    }
  }
  for (const list of byDay.values()) list.sort((a, b) => a.startMs - b.startMs);
  return byDay;
}

const join = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(", ")} e ${items.at(-1)}` : (items[0] ?? "");

/** Quando um webinar acontece, numa linha: «Seg, Qua e Sex às 20:00», «A cada 15 min»… */
export function scheduleSummary(w: ScheduleInput) {
  if (w.schedule_mode === "jit") return `A cada ${Math.max(5, w.jit_interval_minutes ?? 15)} min`;
  const times = recurrenceTimes(w);
  if (w.recurrence_enabled && times.length) {
    const days = recurrenceDays(w);
    const when = days.length === 7 ? "Todos os dias" : join(days.map((d) => WEEKDAYS_SHORT[d]!));
    return `${when} às ${join(times.map(clock))}`;
  }
  if (w.scheduled_at) {
    const ms = Date.parse(w.scheduled_at);
    if (!Number.isNaN(ms)) {
      return new Intl.DateTimeFormat("pt-PT", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: safeZone(w.timezone),
      }).format(new Date(ms));
    }
  }
  return "Sem horário";
}
