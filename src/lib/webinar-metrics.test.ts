import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { metricsPeople, sumByCurrency, type MetricsParticipant } from "./webinar-metrics";

const row = (over: Partial<MetricsParticipant>): MetricsParticipant => ({
  participant_id: "p1",
  person_id: "ana",
  contact_id: "ana",
  webinar_id: "w1",
  name: "Ana",
  email: "ana@x.pt",
  phone: "+244900000000",
  joined_at: "2026-09-27T10:00:00Z",
  viewing_mode: "live",
  attended: true,
  actual_watch_seconds: 600,
  watch_measured: true,
  entry_seconds: 0,
  peak_seconds: 600,
  reached_pitch: false,
  reached_offer: false,
  duration_seconds: 3600,
  saw_offer: false,
  clicked: false,
  checkout_started: false,
  purchased: false,
  payment_failed: false,
  checkout_abandoned: false,
  refunded: false,
  webinar_session_id: null,
  ...over,
});

describe("pessoas do webinar", () => {
  it("junta as entradas da mesma pessoa, com o maior tempo e o passo mais avançado", () => {
    const people = metricsPeople([
      row({ participant_id: "p1", actual_watch_seconds: 180, peak_seconds: 180 }),
      row({ participant_id: "p2", actual_watch_seconds: 1800, peak_seconds: 3000, checkout_started: true, payment_failed: true }),
    ]);
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({ visits: 2, watchSeconds: 1800, peakSeconds: 3000, status: "failed" });
  });

  it("comprou vence falhou; ordena do mais avançado para quem não assistiu", () => {
    const people = metricsPeople([
      row({ participant_id: "a", person_id: "rui", attended: false, actual_watch_seconds: 0 }),
      row({ participant_id: "b", person_id: "eva", checkout_started: true, payment_failed: true, purchased: true }),
      row({ participant_id: "c", person_id: "ivo", saw_offer: true }),
    ]);
    expect(people.map((p) => [p.personId, p.status])).toEqual([
      ["eva", "bought"],
      ["ivo", "offer"],
      ["rui", "absent"],
    ]);
  });
});

describe("receita", () => {
  it("soma por moeda e ignora pagamentos sem valor", () => {
    expect(
      sumByCurrency([
        { amount_value: 25000, currency: "AOA" },
        { amount_value: 25000, currency: "AOA" },
        { amount_value: null, currency: "AOA" },
        { amount_value: 10, currency: "EUR" },
      ]),
    ).toEqual([
      { currency: "AOA", amount: 50000 },
      { currency: "EUR", amount: 10 },
    ]);
  });
});

describe("reembolso", () => {
  it("quem foi reembolsado não conta como comprador", () => {
    const [person] = metricsPeople([row({ checkout_started: true, refunded: true })]);
    expect(person?.status).toBe("refunded");
  });
});

describe("moneyLabel com moedas que não são ISO", () => {
  it("'R$' ou 'EURO' vindos da plataforma não rebentam a página", async () => {
    const { moneyLabel } = await import("./webinar-metrics");
    expect(moneyLabel({ currency: "R$", amount: 1500.5 })).toBe("1500,5 R$");
    expect(() => moneyLabel({ currency: "EURO", amount: 10 })).not.toThrow();
    expect(moneyLabel({ currency: "EUR", amount: 10 })).toContain("€");
  });
});
