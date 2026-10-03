/**
 * Smart lists (segmentos): uma lista com regras em vez de membros. Quem entra é calculado
 * pela base de dados em cada leitura (0064: contact_list_member_ids sobre os factos do Core),
 * por participação — pessoa × webinar. As condições são as das automações, mais o webinar,
 * o reembolso e a origem da inscrição. Aqui ficam os tipos, os modelos e as frases.
 */
import { BOOLEAN_FACTS, conditionLabel, type Condition } from "@/lib/automations";

export type UtmFact = "utm_source" | "utm_medium" | "utm_campaign";

export type SegmentCondition =
  | Condition
  | { fact: "refunded"; value: boolean }
  | { fact: "webinar"; value: string }
  | { fact: UtmFact; op: "in"; value: string[] }
  | { fact: UtmFact; op: "contains"; value: string }
  | { fact: UtmFact; op: "empty" };

export type SegmentRules = { match: "all" | "any"; conditions: SegmentCondition[] };

export const MAX_SEGMENT_CONDITIONS = 12;

export const UTM_LABEL: Record<UtmFact, string> = {
  utm_source: "Origem",
  utm_medium: "Meio",
  utm_campaign: "Campanha",
};

/** Os factos sim/não que um segmento pode usar: os das automações e o reembolso. */
export const SEGMENT_BOOLEAN_FACTS = [
  ...BOOLEAN_FACTS,
  { fact: "refunded" as const, question: "Reembolso", yes: "Foi reembolsado", no: "Sem reembolso" },
];

export type SegmentPreset = { name: string; rules: SegmentRules };

/** Os segmentos que quase todos os webinars precisam; o dono pode ajustar depois. */
export const SEGMENT_PRESETS: SegmentPreset[] = [
  { name: "Não assistiram", rules: { match: "all", conditions: [{ fact: "attended", value: false }] } },
  {
    name: "Assistiram e não compraram",
    rules: { match: "all", conditions: [{ fact: "attended", value: true }, { fact: "purchased", value: false }] },
  },
  {
    name: "Chegaram ao pitch e não compraram",
    rules: { match: "all", conditions: [{ fact: "reached_pitch", value: true }, { fact: "purchased", value: false }] },
  },
  { name: "Checkout abandonado", rules: { match: "all", conditions: [{ fact: "checkout_abandoned", value: true }] } },
  { name: "Pagamento falhou", rules: { match: "all", conditions: [{ fact: "payment_failed", value: true }] } },
  { name: "Compradores", rules: { match: "all", conditions: [{ fact: "purchased", value: true }] } },
  {
    name: "Facebook",
    rules: { match: "all", conditions: [{ fact: "utm_source", op: "in", value: ["facebook", "fb", "meta"] }] },
  },
  {
    name: "Instagram",
    rules: { match: "all", conditions: [{ fact: "utm_source", op: "in", value: ["instagram", "ig"] }] },
  },
];

export function segmentConditionLabel(c: SegmentCondition, webinarTitle: (id: string) => string | undefined) {
  switch (c.fact) {
    case "refunded":
      return c.value ? "Foi reembolsado" : "Sem reembolso";
    case "webinar":
      return `No webinar «${webinarTitle(c.value) ?? "removido"}»`;
    case "utm_source":
    case "utm_medium":
    case "utm_campaign": {
      const label = UTM_LABEL[c.fact];
      if (c.op === "empty") return `${label} vazia`;
      if (c.op === "contains") return `${label} contém «${c.value}»`;
      return `${label}: ${c.value.join(" ou ")}`;
    }
    default:
      return conditionLabel(c);
  }
}

/** "Assistiu e não comprou" / "Facebook ou Instagram". */
export function segmentSentence(rules: SegmentRules, webinarTitle: (id: string) => string | undefined) {
  const joiner = rules.match === "any" ? " ou " : " e ";
  return rules.conditions
    .map((c, i) => {
      const label = segmentConditionLabel(c, webinarTitle);
      return i === 0 ? label : label.charAt(0).toLowerCase() + label.slice(1);
    })
    .join(joiner);
}

/** As regras como a base de dados as aceita (0064: segment_rules_valid); null quando falta algo. */
export function cleanRules(rules: SegmentRules): SegmentRules | null {
  const conditions: SegmentCondition[] = [];
  for (const c of rules.conditions) {
    if (c.fact === "webinar" && !c.value) return null;
    if ((c.fact === "utm_source" || c.fact === "utm_medium" || c.fact === "utm_campaign") && c.op !== "empty") {
      if (c.op === "in") {
        const value = [...new Set(c.value.map((v) => v.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
        if (!value.length) return null;
        conditions.push({ ...c, value });
        continue;
      }
      if (!c.value.trim()) return null;
      conditions.push({ ...c, value: c.value.trim().toLowerCase() });
      continue;
    }
    if (c.fact === "actual_watch_seconds" && !(c.value >= 0 && c.value <= 86_400)) return null;
    conditions.push(c);
  }
  if (!conditions.length || conditions.length > MAX_SEGMENT_CONDITIONS) return null;
  return { match: rules.match, conditions };
}

export function isSegmentRules(value: unknown): value is SegmentRules {
  const v = value as SegmentRules | null;
  return Boolean(v && (v.match === "all" || v.match === "any") && Array.isArray(v.conditions));
}
