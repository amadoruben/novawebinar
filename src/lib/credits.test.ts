import { describe, expect, it } from "vitest";

import { blockedReason, formatUsd, tokenCostMicros, usdCostMicros, type CreditState } from "./credits";

const p = { inputPerMTok: 0.4, outputPerMTok: 1.6, imageUsd: 0.04, transcriptionPerHourUsd: 0.37, margin: 0.4 };

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
    expect(blockedReason(state({ cap_micros: 3_000_000, month_spent_micros: 3_000_000 }))).toContain("limite mensal");
  });
});
