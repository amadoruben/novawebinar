/**
 * Contas do Painel, sem base de dados: o webinar em destaque, o funil, o aparelho e o
 * país de quem assistiu, quem esteve na sala hoje e as sessões que vêm aí. Tudo sai de
 * linhas reais (participant_facts, sessões, webinars); o que não tem fonte não aparece.
 */
import type { DayEntry } from "@/lib/agenda";
import { countryCodeOf, countryLabel, groupByRegion } from "@/lib/analytics-geo";
import { funnelSummary, type FunnelFact } from "@/lib/participant-facts";
import { safeZone, zoneParts, type WebinarLifecycle } from "@/lib/schedule";

const DAY_MS = 86_400_000;

/* ---------- Período dos resultados ---------- */

export type Period = "7d" | "30d" | "all";

export const PERIODS: { id: Period; label: string; days: number | null }[] = [
  { id: "7d", label: "7 dias", days: 7 },
  { id: "30d", label: "30 dias", days: 30 },
  { id: "all", label: "Tudo", days: null },
];

/** Início do período (ISO), ou null para «Tudo». */
export function periodStart(period: Period, nowMs = Date.now()) {
  const days = PERIODS.find((p) => p.id === period)?.days ?? null;
  return days === null ? null : new Date(nowMs - days * DAY_MS).toISOString();
}

/* ---------- Webinar em destaque ---------- */

export type HeroKind = "live" | "next" | "open" | "latest" | "draft";

/**
 * O que vai em cima: a sessão a decorrer; senão a próxima marcada; senão um just in time
 * ou «sempre disponível» activo (está sempre a receber pessoas); senão o último criado que
 * não é rascunho; só sem nenhum activo, o rascunho (a sala dele ainda não abre a ninguém).
 */
export function pickHero<W>(
  items: { webinar: W; lifecycle: WebinarLifecycle }[],
): { webinar: W; lifecycle: WebinarLifecycle; kind: HeroKind } | null {
  const sessions = items.filter(
    (x): x is { webinar: W; lifecycle: Extract<WebinarLifecycle, { kind: "session" }> } =>
      x.lifecycle.kind === "session",
  );
  const live = sessions.find((s) => s.lifecycle.state === "live");
  if (live) return { ...live, kind: "live" };
  const next = sessions
    .filter((s) => s.lifecycle.state === "scheduled")
    .sort((a, b) => a.lifecycle.startMs - b.lifecycle.startMs)[0];
  if (next) return { ...next, kind: "next" };
  const open = items.find((x) => x.lifecycle.kind === "jit" || x.lifecycle.kind === "on_demand");
  if (open) return { ...open, kind: "open" };
  const last = items.find((x) => x.lifecycle.kind !== "draft") ?? items[0];
  return last ? { ...last, kind: last.lifecycle.kind === "draft" ? "draft" : "latest" } : null;
}

export type HeroIssue = { step: "video" | "automacoes" | "agenda"; title: string };

/**
 * O que falta para o webinar em destaque funcionar, com os mesmos avisos do editor (vídeo,
 * automações, horário). `workflows` é null enquanto carrega: aí não se avisa.
 */
export function heroIssues(x: { hasVideo: boolean; workflows: number | null; lifecycle: WebinarLifecycle }) {
  const issues: HeroIssue[] = [];
  if (!x.hasVideo) issues.push({ step: "video", title: "Falta o vídeo" });
  if (x.workflows === 0) issues.push({ step: "automacoes", title: "As automações não foram criadas" });
  // «Sempre disponível» não abre sessão: os lembretes e o seguimento não arrancam.
  if (x.lifecycle.kind === "on_demand" && x.workflows)
    issues.push({ step: "agenda", title: "Sem horário, os lembretes e o seguimento não arrancam" });
  return issues.slice(0, 3);
}

/** «daqui a 25 min», «daqui a 3 h», «daqui a 2 dias»; «há 10 min» no passado. */
export function fromNow(ms: number, nowMs = Date.now()) {
  const minutes = Math.round((ms - nowMs) / 60_000);
  const size = Math.abs(minutes);
  if (size < 1) return "agora";
  const hours = Math.round(size / 60);
  const days = Math.round(size / 1440);
  const span = size < 60 ? `${size} min` : hours < 24 ? `${hours} h` : `${days} ${days === 1 ? "dia" : "dias"}`;
  return minutes > 0 ? `daqui a ${span}` : `há ${span}`;
}

export const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const pad = (n: number) => String(n).padStart(2, "0");

/** «Hoje às 20:00», «Amanhã às 14:30», «Sex, 16 out às 20:00», no fuso do webinar. */
export function whenLabel(ms: number, timezone: string | null | undefined, nowMs = Date.now()) {
  const zone = safeZone(timezone);
  const p = zoneParts(ms, zone);
  const n = zoneParts(nowMs, zone);
  const time = `${pad(p.hour)}:${pad(p.minute)}`;
  const diff = Math.round((Date.UTC(p.year, p.month - 1, p.day) - Date.UTC(n.year, n.month - 1, n.day)) / DAY_MS);
  if (diff === 0) return `Hoje às ${time}`;
  if (diff === 1) return `Amanhã às ${time}`;
  if (diff === -1) return `Ontem às ${time}`;
  return `${WEEKDAYS_SHORT[p.weekday]}, ${p.day} ${MONTHS_SHORT[p.month - 1]} às ${time}`;
}

/* ---------- Funil ---------- */

export type FunnelStep = {
  label: string;
  value: number;
  /** Fracção dos inscritos (0–1): a escala única do gráfico. */
  share: number;
  /** Fracção do passo anterior, ou null no primeiro (ou sem anterior). */
  fromPrevious: number | null;
};

/** Inscritos → assistiram → pitch → clicaram → pagamento → compraram. */
export function funnelSteps(s: ReturnType<typeof funnelSummary>): FunnelStep[] {
  const rows: [string, number][] = [
    ["Inscritos", s.registered],
    ["Assistiram", s.attended],
    ["Chegaram ao pitch", s.reachedPitch],
    ["Clicaram na oferta", s.clicked],
    ["Iniciaram o pagamento", s.checkout],
    ["Compraram", s.buyers],
  ];
  return rows.map(([label, value], i) => {
    const previous = i > 0 ? rows[i - 1]![1] : 0;
    return {
      label,
      value,
      share: s.registered ? value / s.registered : 0,
      fromPrevious: i > 0 && previous > 0 ? value / previous : null,
    };
  });
}

/* ---------- Aparelho e país ---------- */

export type MixRow = { key: string; label: string; value: number; share: number; flag?: string };

type AudienceFact = Pick<FunnelFact, "person_id" | "webinar_id" | "attended"> & {
  device?: string | null;
  country?: string | null;
};

/** Quem assistiu, uma linha por pessoa e webinar (dois aparelhos: fica o primeiro com dados). */
function attendees(facts: AudienceFact[]) {
  const people = new Map<string, { device: string | null; country: string | null }>();
  for (const f of facts) {
    if (!f.attended) continue;
    const key = `${f.person_id}:${f.webinar_id}`;
    const seen = people.get(key);
    people.set(key, {
      device: seen?.device ?? f.device ?? null,
      country: seen?.country ?? (f.country?.trim() || null),
    });
  }
  return [...people.values()];
}

// A ordem é fixa: a cor segue o aparelho, não a posição.
const DEVICES = [
  { key: "desktop", label: "Computador" },
  { key: "mobile", label: "Telemóvel" },
  { key: "tablet", label: "Tablet" },
] as const;

/** Aparelhos de quem assistiu. Só os que aparecem; sem registo fica à parte. */
export function deviceMix(facts: AudienceFact[]) {
  const people = attendees(facts);
  const known = people.filter((p) => DEVICES.some((d) => d.key === p.device));
  const rows: MixRow[] = DEVICES.map((d) => {
    const value = known.filter((p) => p.device === d.key).length;
    return { key: d.key, label: d.label, value, share: known.length ? value / known.length : 0 };
  }).filter((r) => r.value > 0);
  return { rows, unknown: people.length - known.length, total: people.length };
}

/**
 * Países e regiões de quem assistiu, do maior para o menor; depois de `top`, «Outros».
 * O nome gravado vem em inglês (localização do browser) ou em português (servidor): agrupa
 * pelo código do país, como as Análises e a Vista ao vivo, para os números baterem.
 */
export function countryMix(facts: AudienceFact[], top = 5) {
  const people = attendees(facts);
  const geo = groupByRegion(people.map((p) => ({ country: p.country })));
  const share = (n: number) => (geo.known ? n / geo.known : 0);
  const sorted = geo.regions
    .flatMap((r) => r.countries)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt"));
  const rows: MixRow[] = sorted.slice(0, top).map((c) => ({
    key: c.code ?? c.label,
    label: c.label,
    value: c.count,
    share: share(c.count),
    ...(c.flag ? { flag: c.flag } : {}),
  }));
  const rest = sorted.slice(top).reduce((sum, c) => sum + c.count, 0);
  if (rest) rows.push({ key: "outros", label: "Outros", value: rest, share: share(rest) });
  const regions: MixRow[] = geo.regions.map((r) => ({ key: r.key, label: r.label, value: r.count, share: share(r.count) }));
  return { rows, regions, unknown: geo.unknown.length, total: people.length };
}

/* ---------- Hoje ---------- */

export type TodayFact = {
  person_id: string | null;
  contact_id: string | null;
  webinar_id: string | null;
  webinar_title: string | null;
  name: string | null;
  device: string | null;
  country: string | null;
  city: string | null;
  joined_at: string | null;
  first_progress_at: string | null;
  last_progress_at: string | null;
};

export type TodayPerson = {
  key: string;
  contactId: string | null;
  name: string;
  webinar: string;
  device: string | null;
  place: string | null;
  /** Última vez que esteve na sala hoje. */
  at: string;
};

/**
 * Quem esteve na sala desde `startMs` (entrou ou ainda estava a ver) e quem se inscreveu.
 * Cada pessoa conta uma vez, mesmo em dois webinars ou dois aparelhos.
 */
export function todaySummary(rows: TodayFact[], startMs: number, limit = 5) {
  const after = (iso: string | null) => (iso && Date.parse(iso) >= startMs ? Date.parse(iso) : 0);
  const registered = new Set<string>();
  const inRoom = new Map<string, TodayPerson & { ms: number }>();
  for (const r of rows) {
    const person = r.person_id ?? "";
    if (after(r.joined_at)) registered.add(person);
    const ms = Math.max(after(r.first_progress_at), after(r.last_progress_at));
    if (!ms || (inRoom.get(person)?.ms ?? 0) >= ms) continue;
    inRoom.set(person, {
      key: person,
      contactId: r.contact_id,
      name: r.name?.trim() || "Participante",
      webinar: r.webinar_title?.trim() || "Webinar",
      device: r.device,
      place:
        [r.city, r.country?.trim() ? countryLabel(countryCodeOf(null, r.country), r.country) : null]
          .filter(Boolean)
          .join(", ") || null,
      at: new Date(ms).toISOString(),
      ms,
    });
  }
  const people = [...inRoom.values()].sort((a, b) => b.ms - a.ms);
  return {
    inRoom: people.length,
    registered: registered.size,
    people: people.slice(0, limit).map(({ ms: _ms, ...p }) => p),
  };
}

/* ---------- Agenda ---------- */

/** As sessões dos meses dados (monthEntries) entre `fromMs` e `toMs`, por ordem. */
export function entriesBetween(months: Map<number, DayEntry[]>[], fromMs: number, toMs: number) {
  const seen = new Set<string>();
  const out: DayEntry[] = [];
  for (const month of months)
    for (const list of month.values())
      for (const e of list) {
        const key = `${e.webinarId}:${e.startMs}`;
        if (e.startMs < fromMs || e.startMs >= toMs || seen.has(key)) continue;
        seen.add(key);
        out.push(e);
      }
  return out.sort((a, b) => a.startMs - b.startMs);
}

/* ---------- Números ---------- */

/** Valor em dinheiro curto para um mosaico: «1,2 M Kz» a partir de 100 mil; senão por inteiro. */
export function shortMoney(amount: number, currency: string) {
  const compact = Math.abs(amount) >= 100_000;
  try {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency,
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: compact ? 1 : 2,
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    const n = new Intl.NumberFormat("pt-PT", {
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: compact ? 1 : 2,
    }).format(amount);
    return `${n} ${currency}`;
  }
}

/** «12,5%», ou null sem base. */
export function percent(part: number, whole: number) {
  if (!whole) return null;
  return new Intl.NumberFormat("pt-PT", { style: "percent", maximumFractionDigits: 1 }).format(
    part / whole,
  );
}
