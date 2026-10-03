/**
 * Contas do painel que não dependem da base de dados: a lista de actividade a partir
 * do event_log, as entradas por dia e o valor das vendas. Tudo sai de linhas reais.
 */

export type Tone = "success" | "destructive" | "warning" | "info" | "muted";

/** Singular, plural e cor de cada acontecimento do event_log. */
const EVENTS: Record<string, [one: string, many: string, tone: Tone]> = {
  registered: ["inscreveu-se", "inscreveram-se", "muted"],
  started_watching: ["começou a ver o webinar", "começaram a ver o webinar", "info"],
  offer_viewed: ["viu a oferta", "viram a oferta", "info"],
  offer_clicked: ["clicou na oferta", "clicaram na oferta", "info"],
  message_sent: ["escreveu no chat", "escreveram no chat", "muted"],
  checkout_started: ["iniciou o pagamento", "iniciaram o pagamento", "warning"],
  purchase_approved: ["comprou", "compraram", "success"],
  payment_failed: ["o pagamento falhou", "os pagamentos falharam", "destructive"],
  checkout_abandoned: ["não concluiu o pagamento", "não concluíram o pagamento", "warning"],
  purchase_refunded: ["foi reembolsado", "foram reembolsados", "warning"],
  webinar_session_ended: ["a sessão terminou", "a sessão terminou", "muted"],
  automation_entered: ["entrou na automação", "entraram na automação", "info"],
  automation_executed: ["automação executada", "automação executada", "success"],
  automation_failed: ["a automação falhou", "a automação falhou", "destructive"],
  automation_cancelled: ["automação cancelada", "automação cancelada", "muted"],
};

/** Quem faz estes é o sistema; o contacto, quando há, é a quem se destinam. */
const SYSTEM_EVENTS = new Set([
  "automation_executed",
  "automation_failed",
  "automation_cancelled",
  "webinar_session_ended",
]);

export type ActivityRow = {
  name: string | null;
  occurred_at: string | null;
  contact_id: string | null;
  data: unknown;
};

export type ActivityItem = {
  name: string;
  one: string;
  many: string;
  tone: Tone;
  at: string;
  system: boolean;
  /** O produto (e valor) de um pagamento, ou o nome da automação. */
  detail: string | null;
  contacts: { id: string; name: string }[];
};

export function moneyLabel(value: number, currency: string | null | undefined) {
  if (!currency) return new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2 }).format(value);
  try {
    return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(value);
  } catch {
    return `${new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2 }).format(value)} ${currency}`;
  }
}

function detailOf(row: ActivityRow) {
  const data = (row.data ?? {}) as {
    automation?: unknown;
    product?: unknown;
    amount?: unknown;
    currency?: unknown;
  };
  if (typeof data.automation === "string" && data.automation) return data.automation;
  const product = typeof data.product === "string" && data.product ? data.product : null;
  const amount =
    row.name === "purchase_approved" && typeof data.amount === "number"
      ? moneyLabel(data.amount, typeof data.currency === "string" ? data.currency : null)
      : null;
  return [product, amount].filter(Boolean).join(" · ") || null;
}

/**
 * As linhas vêm da mais recente para a mais antiga. Acontecimentos seguidos iguais
 * (o mesmo nome e o mesmo detalhe) ficam numa linha com todos os contactos.
 */
export function activityItems(rows: ActivityRow[], names: Map<string, string>, limit = 10) {
  const items: ActivityItem[] = [];
  for (const row of rows) {
    if (!row.name || !row.occurred_at) continue;
    const detail = detailOf(row);
    const contact = row.contact_id
      ? { id: row.contact_id, name: names.get(row.contact_id) || "Contacto sem nome" }
      : null;
    const last = items.at(-1);
    if (last && last.name === row.name && last.detail === detail && row.name !== "webinar_session_ended") {
      if (contact && !last.contacts.some((c) => c.id === contact.id)) last.contacts.push(contact);
      continue;
    }
    if (items.length === limit) break;
    const [one, many, tone] = EVENTS[row.name] ?? [row.name, row.name, "muted" as const];
    items.push({
      name: row.name,
      one,
      many,
      tone,
      at: row.occurred_at,
      system: SYSTEM_EVENTS.has(row.name),
      detail,
      contacts: contact ? [contact] : [],
    });
  }
  return items;
}

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** Pessoas por dia (hora local), uma vez por webinar em cada dia: dois aparelhos contam uma vez. */
export function peoplePerDay(
  facts: { person_id: string | null; webinar_id: string | null; joined_at: string | null }[],
  days = 15,
  now = new Date(),
) {
  const people = new Map<string, Set<string>>();
  for (const f of facts) {
    if (!f.joined_at) continue;
    const key = dayKey(new Date(f.joined_at));
    const set = people.get(key) ?? new Set<string>();
    set.add(`${f.person_id}:${f.webinar_id}`);
    people.set(key, set);
  }
  const out: { label: string; value: number }[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - i);
    out.push({
      label: `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`,
      value: people.get(dayKey(date))?.size ?? 0,
    });
  }
  return out;
}

/** Soma por moeda: "297,00 €" ou "297,00 € + 50,00 US$". */
export function revenueLabel(rows: { amount_value: number | null; currency: string | null }[]) {
  const totals = new Map<string, number>();
  for (const r of rows) {
    if (r.amount_value == null) continue;
    const currency = r.currency ?? "";
    totals.set(currency, (totals.get(currency) ?? 0) + r.amount_value);
  }
  return [...totals].map(([currency, value]) => moneyLabel(value, currency || null)).join(" + ");
}

const relative = new Intl.RelativeTimeFormat("pt-PT", { numeric: "auto" });

/** "há 5 minutos", "há 3 horas"; a partir de um dia, a data. */
export function agoLabel(iso: string, now = Date.now()) {
  const seconds = (Date.parse(iso) - now) / 1000;
  if (seconds > -60) return "agora mesmo";
  if (seconds > -3600) return relative.format(Math.round(seconds / 60), "minute");
  if (seconds > -86_400) return relative.format(Math.round(seconds / 3600), "hour");
  return new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
