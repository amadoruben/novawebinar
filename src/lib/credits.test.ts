import { describe, expect, it } from "vitest";

import {
  blockedReason,
  formatUsd,
  LEDGER_LIMIT,
  ledgerCutInMonth,
  planLabel,
  publicPrices,
  runwayDays,
  spendByAction,
  tokenCostMicros,
  usdCostMicros,
  type CreditState,
} from "./credits";

const p = {
  inputPerMTok: 0.4,
  outputPerMTok: 1.6,
  imageUsd: 0.04,
  transcriptionPerHourUsd: 0.37,
  margin: 0.4,
};

describe("custo real + margem", () => {
  it("tokens × preço por milhão dá micro-dólares, com a margem", () => {
    // 2000 × 0,4 + 300 × 1,6 = 1280 µ$ de custo; +40 % = 1792 µ$ ($0,0018)
    expect(tokenCostMicros(2000, 300, p)).toBe(1792);
    expect(tokenCostMicros(0, 0, p)).toBe(0);
  });
  it("custos fixos em dólares", () => {
    expect(usdCostMicros(0.04, 0.4)).toBe(56000);
    expect(usdCostMicros((60 / 60) * 0.37, 0.4)).toBe(518000);
  });
});

describe("formatUsd", () => {
  it("mostra 4 casas só para fracções de cêntimo", () => {
    // O Intl separa o valor da moeda com um espaço não separável.
    const f = (micros: number) => formatUsd(micros).replace(/\s/g, " ");
    expect(f(12_400_000)).toBe("12,40 US$");
    expect(f(1792)).toBe("0,0018 US$");
    expect(f(0)).toBe("0,00 US$");
  });
});

describe("blockedReason", () => {
  const state = (over: Partial<CreditState>): CreditState => ({
    balance_micros: 5_000_000,
    month_spent_micros: 0,
    plan: "creator",
    plan_allowance_micros: 10_000_000,
    plan_remaining_micros: 0,
    cap_micros: null,
    ...over,
  });
  it("sem saldo ou acima do limite mensal bloqueia; com saldo deixa correr", () => {
    expect(blockedReason(state({}))).toBeNull();
    expect(blockedReason(state({ balance_micros: 0 }))).toContain("créditos acabaram");
    expect(
      blockedReason(state({ cap_micros: 3_000_000, month_spent_micros: 3_000_000 })),
    ).toContain("limite mensal");
  });
});

describe("publicPrices", () => {
  it("dá o preço ao cliente com a margem; sem preço no .env fica null («a definir»)", () => {
    expect(publicPrices({ ...p, configured: true })).toEqual({
      margin: 0.4,
      text: true,
      imageMicros: 56000,
      transcriptionHourMicros: 518000,
    });
    const none = publicPrices({ ...p, imageUsd: 0, transcriptionPerHourUsd: 0, configured: false });
    expect(none).toMatchObject({ text: false, imageMicros: null, transcriptionHourMicros: null });
  });
});

describe("spendByAction", () => {
  const row = (action: string, amount: number, at: string, kind = "usage") => ({
    kind,
    action,
    amount_micros: amount,
    created_at: at,
  });
  const rows = [
    row("agent_reply", -3_000, "2026-10-05T10:00:00Z"),
    row("agent_reply", -5_000, "2026-10-06T10:00:00Z"),
    row("chat_generation", -1_200_000, "2026-10-02T10:00:00Z"),
    row("chat_generation", -900_000, "2026-09-20T10:00:00Z"),
    row("topup", 10_000_000, "2026-10-03T10:00:00Z", "purchase"),
  ];
  it("soma só gastos, desde a data, do maior para o menor", () => {
    expect(spendByAction(rows, Date.parse("2026-10-01T00:00:00Z"))).toEqual([
      { action: "chat_generation", runs: 1, micros: 1_200_000 },
      { action: "agent_reply", runs: 2, micros: 8_000 },
    ]);
    expect(spendByAction(rows)[0]).toEqual({
      action: "chat_generation",
      runs: 2,
      micros: 2_100_000,
    });
  });
});

describe("runwayDays", () => {
  const now = Date.parse("2026-10-11T00:00:00Z"); // 10 dias de mês
  it("saldo ÷ ritmo diário deste mês", () => {
    expect(runwayDays(10_000_000, 2_000_000, now)).toBe(50);
  });
  it("sem gasto ou sem saldo não há previsão", () => {
    expect(runwayDays(10_000_000, 0, now)).toBeNull();
    expect(runwayDays(0, 2_000_000, now)).toBeNull();
  });
  it("nas primeiras horas do mês conta um dia inteiro", () => {
    expect(runwayDays(10_000_000, 1_000_000, Date.parse("2026-10-01T02:00:00Z"))).toBe(10);
  });
});

describe("planLabel", () => {
  it("nomes dos planos; o plano por omissão é o Profissional", () => {
    expect(planLabel("business")).toBe("Negócio");
    expect(planLabel("professional")).toBe("Profissional");
  });
});

describe("ledgerCutInMonth", () => {
  const now = Date.parse("2026-10-11T00:00:00Z");
  const rows = (oldest: string, n = LEDGER_LIMIT) =>
    Array.from({ length: n }, (_, i) => ({ created_at: i === n - 1 ? oldest : "2026-10-10T00:00:00Z" }));
  it("o livro lido cheio e sem chegar ao dia 1: as contas do mês ficam incompletas", () => {
    expect(ledgerCutInMonth(rows("2026-10-05T00:00:00Z"), now)).toBe(true);
  });
  it("chega ao mês anterior, ou não está cheio: está completo", () => {
    expect(ledgerCutInMonth(rows("2026-09-30T23:00:00Z"), now)).toBe(false);
    expect(ledgerCutInMonth(rows("2026-10-05T00:00:00Z", 20), now)).toBe(false);
    expect(ledgerCutInMonth([], now)).toBe(false);
  });
});
