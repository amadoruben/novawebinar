import { describe, expect, it } from "vitest";
import { fetchAll } from "./fetch-all";

/** Um servidor que nunca devolve mais do que `cap` linhas por pedido. */
function server(total: number, cap: number, withCount = true) {
  const all = Array.from({ length: total }, (_, id) => ({ id }));
  let requests = 0;
  const page = async (from: number, to: number) => {
    requests += 1;
    return {
      data: all.slice(from, Math.min(to + 1, from + cap)),
      error: null,
      count: withCount ? total : null,
    };
  };
  return { page, requests: () => requests };
}

describe("fetchAll", () => {
  it("lê tudo quando há mais linhas do que o corte do servidor", async () => {
    const s = server(2500, 1000);
    const rows = await fetchAll(s.page);
    expect(rows).toHaveLength(2500);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2500);
    expect(s.requests()).toBe(3);
  });

  it("faz um só pedido quando cabe numa página", async () => {
    const s = server(120, 1000);
    expect(await fetchAll(s.page)).toHaveLength(120);
    expect(s.requests()).toBe(1);
  });

  it("não perde linhas quando o servidor corta abaixo das 1000", async () => {
    const s = server(1200, 500);
    const rows = await fetchAll(s.page);
    expect(new Set(rows.map((r) => r.id)).size).toBe(1200);
  });

  it("acaba num total que é múltiplo exacto da página", async () => {
    const s = server(2000, 1000);
    expect(await fetchAll(s.page)).toHaveLength(2000);
    expect(s.requests()).toBe(2);
  });

  it("sem total, pára na primeira página incompleta", async () => {
    const s = server(1500, 1000, false);
    expect(await fetchAll(s.page)).toHaveLength(1500);
  });

  it("devolve vazio sem linhas", async () => {
    expect(await fetchAll(server(0, 1000).page)).toEqual([]);
  });

  it("falha em vez de devolver números parciais", async () => {
    let calls = 0;
    const page = async () => {
      calls += 1;
      return calls === 1
        ? { data: Array.from({ length: 1000 }, (_, id) => ({ id })), error: null, count: 3000 }
        : { data: null, error: { message: "rede" }, count: null };
    };
    await expect(fetchAll(page)).rejects.toThrow("rede");
  });
});
