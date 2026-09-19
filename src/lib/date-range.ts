/**
 * Intervalos de data usados nos filtros do analítico.
 * Tudo em hora local do utilizador; `to` é exclusivo.
 */

export type RangePreset = "todos" | "hoje" | "ontem" | "semana" | "30dias" | "personalizado";

export type DateRange = { from: string; to: string } | undefined;

export const RANGE_OPTIONS: { value: RangePreset; label: string }[] = [
  { value: "todos", label: "Todo o período" },
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "semana", label: "Esta semana" },
  { value: "30dias", label: "Últimos 30 dias" },
  { value: "personalizado", label: "Personalizado" },
];

const startOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

/** Converte "2026-09-17" em data local. */
const parseDay = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};

export function resolveRange(
  preset: RangePreset,
  customFrom?: string,
  customTo?: string,
): DateRange {
  const today = startOfDay(new Date());
  if (preset === "hoje") return { from: today.toISOString(), to: addDays(today, 1).toISOString() };
  if (preset === "ontem")
    return { from: addDays(today, -1).toISOString(), to: today.toISOString() };
  if (preset === "semana") {
    // Semana começa à segunda-feira.
    const weekday = (today.getDay() + 6) % 7;
    return { from: addDays(today, -weekday).toISOString(), to: addDays(today, 1).toISOString() };
  }
  if (preset === "30dias")
    return { from: addDays(today, -29).toISOString(), to: addDays(today, 1).toISOString() };
  if (preset === "personalizado") {
    const from = customFrom ? parseDay(customFrom) : null;
    const to = customTo ? parseDay(customTo) : null;
    if (!from && !to) return undefined;
    return {
      from: (from ?? new Date(0)).toISOString(),
      to: addDays(to ?? today, 1).toISOString(),
    };
  }
  return undefined;
}

export const rangeKey = (range: DateRange) => (range ? `${range.from}|${range.to}` : "sempre");
