import { describe, expect, it } from "vitest";
import {
  MIN_PEOPLE_PER_SLOT,
  monthEntries,
  scheduleSummary,
  slotLabel,
  suggestSlots,
  type AgendaFact,
} from "./agenda";

const NOW = Date.parse("2026-10-20T12:00:00Z");
const tz = () => "Africa/Luanda"; // UTC+1

/** n pessoas numa sessão: as primeiras `attended` assistiram ao vivo, as primeiras `buyers` compraram. */
function people(session: string, n: number, attended: number, buyers: number): AgendaFact[] {
  return Array.from({ length: n }, (_, i) => ({
    person_id: `${session}-p${i}`,
    webinar_session_id: session,
    attended: i < attended,
    viewing_mode: "live",
    purchased: i < buyers,
  }));
}

describe("suggestSlots", () => {
  // Quinta 8/10 13:00 UTC = 14h em Luanda; terça 6/10 19:00 UTC = 20h.
  const sessions = [
    { id: "qui", webinar_id: "w", starts_at: "2026-10-08T13:00:00Z" },
    { id: "ter", webinar_id: "w", starts_at: "2026-10-06T19:00:00Z" },
  ];

  it("ordena pelas compras por inscrito, no fuso do webinar", () => {
    const [result, ...rest] = suggestSlots(
      sessions,
      [...people("qui", 40, 20, 4), ...people("ter", 60, 40, 3)],
      tz,
      NOW,
    );
    expect(rest).toHaveLength(0);
    expect(result).toMatchObject({ webinarId: "w", ready: true, bySales: true });
    if (!result?.ready) return;
    expect(result.best.map(slotLabel)).toEqual([
      "Quinta-feira às 14:00",
      "Terça-feira às 20:00",
    ]);
    expect(result.best[0]).toMatchObject({
      people: 40,
      attended: 20,
      buyers: 4,
      sales: 0.1,
      attendance: 0.5,
    });
  });

  it("sem vendas ainda, ordena pela presença ao vivo e não conta o replay", () => {
    const replay = people("qui", 40, 40, 0).map((f) => ({ ...f, viewing_mode: "replay" }));
    const [result] = suggestSlots(sessions, [...replay, ...people("ter", 40, 10, 0)], tz, NOW);
    expect(result).toMatchObject({ ready: true, bySales: false });
    if (!result?.ready) return;
    expect(result.best[0]).toMatchObject({ weekday: 2, hour: 20, attended: 10 });
    expect(result.best[1]).toMatchObject({ weekday: 4, attended: 0 });
  });

  it("com poucos inscritos diz quantos horários faltam em vez de sugerir", () => {
    const [result] = suggestSlots(
      sessions,
      [...people("qui", MIN_PEOPLE_PER_SLOT, 10, 1), ...people("ter", 12, 5, 0)],
      tz,
      NOW,
    );
    expect(result).toMatchObject({ ready: false, missingSlots: 1 });
    if (!result || result.ready) return;
    expect(result.slots.map((s) => s.people)).toEqual([MIN_PEOPLE_PER_SLOT, 12]);
  });

  it("uma pessoa em dois aparelhos conta uma vez; sessões recentes ou futuras ainda não contam", () => {
    const twice = people("qui", 1, 1, 1);
    const recent = [{ id: "hoje", webinar_id: "w", starts_at: "2026-10-20T08:00:00Z" }];
    const [result] = suggestSlots(
      [...sessions, ...recent],
      [...twice, ...twice, ...people("hoje", 50, 50, 50)],
      tz,
      NOW,
    );
    expect(result).toMatchObject({ ready: false, missingSlots: 2 });
    if (!result || result.ready) return;
    expect(result.slots).toHaveLength(1);
    expect(result.slots[0]).toMatchObject({ people: 1, buyers: 1 });
  });

  it("só compara horários do mesmo webinar: a oferta mais barata não decide a hora", () => {
    // A (barato) vende muito à quinta às 14h e ao domingo às 10h; B (caro) vende pouco ao
    // sábado às 20h e à sexta às 20h. Juntos, a quinta de A ganhava a tudo.
    const two = [
      { id: "a-qui", webinar_id: "A", starts_at: "2026-10-08T13:00:00Z" },
      { id: "a-dom", webinar_id: "A", starts_at: "2026-10-11T09:00:00Z" },
      { id: "b-sab", webinar_id: "B", starts_at: "2026-10-10T19:00:00Z" },
      { id: "b-sex", webinar_id: "B", starts_at: "2026-10-09T19:00:00Z" },
    ];
    const result = suggestSlots(
      two,
      [
        ...people("a-qui", 50, 30, 10),
        ...people("a-dom", 50, 30, 15),
        ...people("b-sab", 40, 20, 2),
        ...people("b-sex", 40, 20, 1),
      ],
      tz,
      NOW,
    );
    expect(result.map((r) => r.webinarId)).toEqual(["A", "B"]);
    const [a, b] = result;
    if (!a?.ready || !b?.ready) throw new Error("os dois webinars deviam sugerir");
    expect(a.best.map(slotLabel)).toEqual(["Domingo às 10:00", "Quinta-feira às 14:00"]);
    expect(b.best.map(slotLabel)).toEqual(["Sábado às 20:00", "Sexta-feira às 20:00"]);
    expect(b.best.every((s) => s.webinarId === "B")).toBe(true);
  });

  it("a hora certa: 20:00 e 20:45 são horários diferentes", () => {
    const [result] = suggestSlots(
      [
        { id: "x", webinar_id: "w", starts_at: "2026-10-09T19:00:00Z" },
        { id: "y", webinar_id: "w", starts_at: "2026-10-02T19:45:00Z" },
      ],
      [...people("x", 30, 10, 1), ...people("y", 30, 20, 3)],
      tz,
      NOW,
    );
    if (!result?.ready) throw new Error("devia sugerir");
    expect(result.best.map(slotLabel)).toEqual(["Sexta-feira às 20:45", "Sexta-feira às 20:00"]);
  });

  it("quem se inscreveu em duas sessões e comprou conta como compra só numa", () => {
    // A compra é por pessoa e webinar. A pessoa p0 está nas duas sessões e só assistiu
    // ao vivo à de terça: a compra fica na terça.
    const both = (session: string, attended: boolean): AgendaFact => ({
      person_id: "p0",
      webinar_session_id: session,
      attended,
      viewing_mode: "live",
      purchased: true,
    });
    const [result] = suggestSlots(sessions, [both("qui", false), both("ter", true)], tz, NOW);
    if (!result || result.ready) throw new Error("com uma pessoa não sugere");
    const byDay = Object.fromEntries(result.slots.map((s) => [s.weekday, s.buyers]));
    expect(byDay).toEqual({ 2: 1, 4: 0 });
  });

  it("sem sessões não há nada para mostrar", () => {
    expect(suggestSlots([], [], tz, NOW)).toEqual([]);
  });
});

describe("monthEntries", () => {
  const base = { timezone: "Africa/Luanda", title: "Fórmula" };

  it("repetição: só os dias que ainda vêm, nas horas certas", () => {
    const weekly = {
      ...base,
      id: "r",
      recurrence_enabled: true,
      recurrence_days: [4],
      recurrence_times: ["14:00", "20:00"],
    };
    const days = monthEntries([weekly], [], 2026, 10, NOW);
    // Quintas de Outubro de 2026 depois de dia 20: 22 e 29.
    expect([...days.keys()].sort((a, b) => a - b)).toEqual([22, 29]);
    expect(days.get(22)!.map((e) => new Date(e.startMs).toISOString())).toEqual([
      "2026-10-22T13:00:00.000Z",
      "2026-10-22T19:00:00.000Z",
    ]);
  });

  it("sessões reais do passado aparecem e não se repetem com a data única", () => {
    const single = { ...base, id: "s", scheduled_at: "2026-10-08T13:00:00Z" };
    const sessions = [{ id: "x", webinar_id: "s", starts_at: "2026-10-08T13:00:00Z" }];
    const days = monthEntries([single], sessions, 2026, 10, NOW);
    expect(days.get(8)).toHaveLength(1);
    expect(monthEntries([single], sessions, 2026, 11, NOW).size).toBe(0);
  });

  it("rascunhos e just in time não marcam dias", () => {
    const draft = { ...base, id: "d", status: "draft", scheduled_at: "2026-10-25T13:00:00Z" };
    const jit = { ...base, id: "j", schedule_mode: "jit" };
    expect(monthEntries([draft, jit], [], 2026, 10, NOW).size).toBe(0);
  });
});

describe("scheduleSummary", () => {
  it("descreve cada forma de horário numa linha", () => {
    expect(scheduleSummary({ schedule_mode: "jit", jit_interval_minutes: 15 })).toBe(
      "A cada 15 min",
    );
    expect(
      scheduleSummary({
        recurrence_enabled: true,
        recurrence_days: [1, 3, 5],
        recurrence_times: ["20:00"],
      }),
    ).toBe("Seg, Qua e Sex às 20:00");
    expect(scheduleSummary({ recurrence_enabled: true, recurrence_start_time: "09:30" })).toBe(
      "Todos os dias às 09:30",
    );
    expect(scheduleSummary({})).toBe("Sem horário");
  });
});
