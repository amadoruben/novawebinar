import { describe, expect, it } from "vitest";
import { activityItems, peoplePerDay, revenueLabel } from "./model";

describe("activityItems", () => {
  const names = new Map([
    ["c1", "Carlos"],
    ["c2", "Paulo"],
  ]);

  it("junta acontecimentos seguidos iguais e mantém os contactos uma vez", () => {
    const items = activityItems(
      [
        { name: "automation_executed", occurred_at: "2026-09-28T17:54:00Z", contact_id: "c1", data: { automation: "A" } },
        { name: "automation_executed", occurred_at: "2026-09-28T17:53:00Z", contact_id: "c2", data: { automation: "A" } },
        { name: "automation_executed", occurred_at: "2026-09-28T17:52:00Z", contact_id: "c2", data: { automation: "A" } },
        { name: "automation_executed", occurred_at: "2026-09-28T17:51:00Z", contact_id: "c1", data: { automation: "B" } },
        { name: "purchase_approved", occurred_at: "2026-09-28T17:45:00Z", contact_id: "c2", data: { product: "Curso", amount: 97, currency: "EUR" } },
        { name: "webinar_session_ended", occurred_at: "2026-09-28T17:40:00Z", contact_id: null, data: {} },
      ],
      names,
    );
    expect(items.map((i) => [i.name, i.detail?.replace(/\s/g, " ") ?? null, i.contacts.map((c) => c.name)])).toEqual([
      ["automation_executed", "A", ["Carlos", "Paulo"]],
      ["automation_executed", "B", ["Carlos"]],
      ["purchase_approved", "Curso · 97,00 €", ["Paulo"]],
      ["webinar_session_ended", null, []],
    ]);
    expect(items[0]!.system).toBe(true);
    expect(items[2]!.system).toBe(false);
  });

  it("pára no limite", () => {
    const rows = ["registered", "offer_viewed", "offer_clicked"].map((name) => ({
      name,
      occurred_at: "2026-09-28T17:00:00Z",
      contact_id: "c1",
      data: null,
    }));
    expect(activityItems(rows, names, 2)).toHaveLength(2);
  });
});

describe("peoplePerDay", () => {
  it("conta cada pessoa uma vez por webinar e por dia", () => {
    const now = new Date(2026, 8, 28, 20);
    const today = new Date(2026, 8, 28, 18).toISOString();
    const days = peoplePerDay(
      [
        { person_id: "p1", webinar_id: "w", joined_at: today },
        { person_id: "p1", webinar_id: "w", joined_at: today },
        { person_id: "p2", webinar_id: "w", joined_at: today },
        { person_id: "p3", webinar_id: "w", joined_at: new Date(2026, 8, 27, 10).toISOString() },
      ],
      3,
      now,
    );
    expect(days).toEqual([
      { label: "26/09", value: 0 },
      { label: "27/09", value: 1 },
      { label: "28/09", value: 2 },
    ]);
  });
});

describe("revenueLabel", () => {
  it("soma por moeda", () => {
    expect(
      revenueLabel([
        { amount_value: 97, currency: "EUR" },
        { amount_value: 200, currency: "EUR" },
        { amount_value: null, currency: "EUR" },
      ]).replace(/\s/g, " "),
    ).toBe("297,00 €");
  });
});
