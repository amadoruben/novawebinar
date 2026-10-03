import { describe, expect, it } from "vitest";
import { lifecycleLabel, sessionState, webinarLifecycle } from "./schedule";

const H = 3_600_000;
const start = Date.parse("2026-10-12T19:00:00Z");
const single = { schedule_mode: "scheduled", scheduled_at: "2026-10-12T19:00:00Z", timezone: "UTC", duration_seconds: 3600 };

describe("ciclo de vida de uma sessão com data única", () => {
  it("agendada antes da hora, em andamento até ao fim, terminada depois", () => {
    expect(lifecycleLabel(webinarLifecycle(single, start - H))).toBe("Agendado");
    expect(lifecycleLabel(webinarLifecycle(single, start + H / 2))).toBe("Em andamento");
    expect(lifecycleLabel(webinarLifecycle(single, start + H))).toBe("Terminado");
  });

  it("a hora de fim definida manda sobre a duração do vídeo", () => {
    const withEnd = { ...single, session_end_time: "21:30" };
    const at = start + 2 * H;
    expect(webinarLifecycle(withEnd, at)).toMatchObject({ kind: "session", state: "live" });
    expect(webinarLifecycle(withEnd, start + 2.5 * H)).toMatchObject({ state: "finished" });
  });

  it("sem duração nem hora de fim não se inventa o fim", () => {
    const unknown = { ...single, duration_seconds: 0 };
    const lifecycle = webinarLifecycle(unknown, start + 10 * H);
    expect(lifecycle).toMatchObject({ kind: "session", state: "live", endMs: null });
    expect(lifecycleLabel(lifecycle)).toBe("Iniciado");
  });

  it("um webinar inactivo não tem sessão a decorrer", () => {
    expect(webinarLifecycle({ ...single, status: "draft" }, start + H / 2)).toEqual({ kind: "draft" });
  });
});

describe("sem sessão global", () => {
  it("sem horário é sob demanda: nunca termina para todos", () => {
    expect(webinarLifecycle({ timezone: "UTC", duration_seconds: 3600 }, start)).toEqual({ kind: "on_demand" });
  });

  it("just in time recomeça para quem chega: não tem um fim global", () => {
    expect(webinarLifecycle({ schedule_mode: "jit", jit_interval_minutes: 15 }, start)).toEqual({
      kind: "jit",
      intervalMinutes: 15,
    });
  });
});

describe("repetição automática", () => {
  it("depois de uma sessão terminar, mostra a próxima e guarda o fim da anterior", () => {
    const daily = {
      recurrence_enabled: true,
      recurrence_pattern: "daily",
      recurrence_start_time: "19:00",
      timezone: "UTC",
      duration_seconds: 3600,
    };
    const lifecycle = webinarLifecycle(daily, start + 2 * H);
    expect(lifecycle).toMatchObject({ kind: "session", state: "scheduled", lastEndedMs: start + H });
    expect(lifecycle.kind === "session" && lifecycle.startMs).toBe(start + 24 * H);
  });
});

describe("regra do fim, igual à do varrimento da base de dados", () => {
  it("termina exactamente à hora prevista", () => {
    expect(sessionState(start, start + H, start + H - 1)).toBe("live");
    expect(sessionState(start, start + H, start + H)).toBe("finished");
    expect(sessionState(start, null, start + 100 * H)).toBe("live");
  });
});
