import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cenários do /code-review (2026-10-01). Duplicar uma automação de workflow mantém-na no
 * workflow, com os passos. As estatísticas das automações não descarregam a
 * tabela automation_runs inteira de 15 em 15 segundos. A primeira leitura (e uma a cada
 * 5 min) é completa e paginada por id; as seguintes trazem só o que mudou (updated_at).
 */
type Row = { id: string; automation_id: string; contact_id: string; status: string; scheduled_for: string; finished_at: string | null; updated_at: string };
let table: Row[];
let reads: { since: string | null; order: string | null }[];
let inserted: Record<string, unknown> | null = null;

vi.mock("@/integrations/supabase/client", () => {
  const from = () => {
    let since: string | null = null;
    let order: string | null = null;
    let range: [number, number] = [0, 999];
    const chain = {
      select: () => chain,
      single: () => chain,
      insert: (row: Record<string, unknown>) => ((inserted = row), chain),
      eq: () => chain,
      gte: (_: string, value: string) => ((since = value), chain),
      order: (column: string) => ((order = column), chain),
      range: (a: number, b: number) => ((range = [a, b]), chain),
      then: (ok: (value: unknown) => unknown) => {
        if (inserted) return Promise.resolve({ data: { id: "copia-1" }, error: null }).then(ok);
        reads.push({ since, order });
        const rows = table.filter((r) => !since || r.updated_at >= since).sort((a, b) => a.id.localeCompare(b.id));
        return Promise.resolve({ data: rows.slice(range[0], range[1] + 1), error: null, count: rows.length }).then(ok);
      },
    };
    return chain;
  };
  return { supabase: { from } };
});

const { duplicateAutomation, statsRows } = await import("./data");

const row = (id: string, status: string, updated: string): Row => ({
  id,
  automation_id: "a-1",
  contact_id: `c-${id}`,
  status,
  scheduled_for: "2026-10-01T10:00:00Z",
  finished_at: null,
  updated_at: updated,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
  reads = [];
  table = [row("1", "waiting", "2026-10-01T11:00:00Z"), row("2", "waiting", "2026-10-01T11:30:00Z")];
});
afterEach(() => vi.useRealTimers());

describe("estatísticas das automações", () => {
  it("1.ª leitura completa, ordenada por id; as seguintes só o que mudou, juntando por id", async () => {
    const org = "org-incremental";
    expect((await statsRows(org)).map((r) => r.id)).toEqual(["1", "2"]);
    expect(reads.at(-1)).toEqual({ since: null, order: "id" });

    // 15 s depois: a execução 2 terminou e entrou a 3.
    vi.advanceTimersByTime(15_000);
    table = [table[0]!, row("2", "done", "2026-10-01T12:00:10Z"), row("3", "ready", "2026-10-01T12:00:12Z")];
    const rows = await statsRows(org);
    expect(reads.at(-1)!.since).toBe("2026-10-01T11:28:00.000Z"); // última alteração vista − 2 min
    expect(reads.at(-1)!.order).toBe("id");
    expect(rows.map((r) => `${r.id}:${r.status}`).sort()).toEqual(["1:waiting", "2:done", "3:ready"]);
  });

  it("de 5 em 5 minutos relê tudo: uma execução apagada deixa de contar", async () => {
    const org = "org-releitura";
    await statsRows(org);
    vi.advanceTimersByTime(5 * 60_000 + 1);
    table = [table[1]!];
    expect((await statsRows(org)).map((r) => r.id)).toEqual(["2"]);
    expect(reads.at(-1)!.since).toBeNull();
  });
});

describe("duplicar uma automação", () => {
  it("a cópia de uma automação de workflow continua no workflow, com os passos, e nasce desligada", async () => {
    inserted = null;
    const steps = { start: "p1", nodes: [{ id: "p1", kind: "action", sends: [{ channel: "webhook", target: "webhook" }], next: null }] };
    const original = {
      id: "a-1",
      organization_id: "org-1",
      name: "Pós-webinar",
      active: true,
      archived_at: null,
      trigger_event: "webinar_session_ended",
      webinar_id: "web-1",
      workflow_id: "wf-1",
      action: "outgoing_webhook",
      conditions: [],
      wait_minutes: 0,
      steps,
      created_at: "",
      created_by: null,
      updated_at: "",
    };
    expect(await duplicateAutomation(original)).toBe("copia-1");
    expect(inserted).toMatchObject({
      name: "Pós-webinar (cópia)",
      active: false,
      workflow_id: "wf-1",
      webinar_id: "web-1",
      trigger_event: "webinar_session_ended",
      steps,
    });
    inserted = null;
  });
});
